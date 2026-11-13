// Write side: pure functions that take the database and return a new one.
// Each one checks permissions and valid state transitions, and records an
// activity log entry. The store is the only caller.

import {
  canAssign,
  canEscalate,
  canManageTask,
  canRunTimer,
  canSubmitDepartmentReport,
  canSubmitExecutiveReport,
} from "./permissions";
import { departmentSnapshot, executiveSnapshot, idx } from "./selectors";
import { iso, ms } from "./time";
import type { ActivityAction, Database, Priority, Task, TaskActivityLog, TaskTimeSession, User } from "./types";

export class DomainError extends Error {}

const fail = (message: string): never => {
  throw new DomainError(message);
};

const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function entry(
  now: number,
  task_id: string | null,
  actor_id: string,
  action: ActivityAction,
  previous_value: string | null = null,
  new_value: string | null = null,
): TaskActivityLog {
  return { id: uid("l"), task_id, actor_id, action, previous_value, new_value, created_at: iso(now) };
}

function getTask(db: Database, id: string): Task {
  const t = idx(db).taskById.get(id);
  if (!t || t.deleted_at) return fail("This task no longer exists.");
  return t;
}

const patch = (db: Database, id: string, change: Partial<Task>, now: number): Task[] =>
  db.tasks.map((t) => (t.id === id ? { ...t, ...change, updated_at: iso(now) } : t));

const closeOpen = (sessions: TaskTimeSession[], taskId: string, now: number): TaskTimeSession[] =>
  sessions.map((s) =>
    s.task_id === taskId && s.ended_at === null
      ? { ...s, ended_at: iso(now), duration_seconds: Math.max(0, Math.round((now - ms(s.started_at)) / 1000)) }
      : s,
  );

export interface NewTaskInput {
  title: string;
  description: string;
  department_id: string;
  assigned_to: string;
  priority: Priority;
  due_at: string;
  estimated_duration?: number | null;
  category?: string | null;
  internal_notes?: string | null;
}

export function createTask(db: Database, actor: User, now: number, input: NewTaskInput): Database {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 3) fail("Give the task a title.");
  if (!description) fail("Add a short description so the task is clear.");
  if (!idx(db).deptById.has(input.department_id)) fail("Choose a department.");
  if (!input.assigned_to) fail("Choose who should do this task.");
  if (!canAssign(db, actor, input.assigned_to, input.department_id))
    fail("You are not allowed to assign tasks to this person.");
  if (Number.isNaN(ms(input.due_at))) fail("Set a due date and time.");
  const task: Task = {
    id: uid("t"),
    title,
    description,
    department_id: input.department_id,
    assigned_by: actor.id,
    assigned_to: input.assigned_to,
    priority: input.priority,
    status: "pending",
    due_at: input.due_at,
    estimated_duration: input.estimated_duration ?? null,
    category: input.category?.trim() || null,
    internal_notes: input.internal_notes?.trim() || null,
    completion_note: null,
    created_at: iso(now),
    updated_at: iso(now),
    completed_at: null,
    display_order: null,
    deleted_at: null,
  };
  return {
    ...db,
    tasks: [...db.tasks, task],
    logs: [...db.logs, entry(now, task.id, actor.id, "assigned", null, input.assigned_to)],
  };
}

export function pauseTask(db: Database, actor: User, now: number, taskId: string): Database {
  const task = getTask(db, taskId);
  if (!canRunTimer(actor, task)) fail("Only the assigned team member can pause this task.");
  if (task.status !== "in_progress") fail("This task is not running.");
  return {
    ...db,
    tasks: patch(db, taskId, { status: "paused" }, now),
    sessions: closeOpen(db.sessions, taskId, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "paused")],
  };
}

/** Start a pending task or resume a paused one. One running task per person. */
export function startTask(db: Database, actor: User, now: number, taskId: string, pauseCurrent = false): Database {
  const task = getTask(db, taskId);
  if (!canRunTimer(actor, task)) fail("Only the assigned team member can run this task's timer.");
  if (task.status === "completed") fail("Completed tasks can only be reopened by a manager.");
  if (task.status === "in_progress") fail("This task is already running.");
  let next = db;
  const open = idx(db).openByEmployee.get(actor.id);
  if (open) {
    if (!pauseCurrent) fail("You already have a task running. Pause it first.");
    next = pauseTask(next, actor, now, open.task_id);
  }
  const session: TaskTimeSession = {
    id: uid("s"),
    task_id: taskId,
    employee_id: actor.id,
    started_at: iso(now),
    ended_at: null,
    duration_seconds: 0,
  };
  return {
    ...next,
    tasks: patch(next, taskId, { status: "in_progress" }, now),
    sessions: [...next.sessions, session],
    logs: [...next.logs, entry(now, taskId, actor.id, task.status === "paused" ? "resumed" : "started")],
  };
}

export function completeTask(db: Database, actor: User, now: number, taskId: string, note?: string): Database {
  const task = getTask(db, taskId);
  if (!canRunTimer(actor, task)) fail("Only the assigned team member can complete this task.");
  if (task.status === "completed") fail("This task is already completed.");
  if (task.status === "pending") fail("Start the task before marking it done.");
  return {
    ...db,
    tasks: patch(db, taskId, { status: "completed", completed_at: iso(now), completion_note: note?.trim() || null }, now),
    sessions: closeOpen(db.sessions, taskId, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "completed")],
  };
}

export function setCompletionNote(db: Database, actor: User, now: number, taskId: string, note: string): Database {
  const task = getTask(db, taskId);
  if (!canRunTimer(actor, task)) fail("Only the assigned team member can add a note.");
  if (task.status !== "completed") fail("Notes are added when a task is completed.");
  return { ...db, tasks: patch(db, taskId, { completion_note: note.trim() || null }, now) };
}

export function reopenTask(db: Database, actor: User, now: number, taskId: string): Database {
  const task = getTask(db, taskId);
  if (!canManageTask(actor, task)) fail("Only an authorised manager can reopen a completed task.");
  if (task.status !== "completed") fail("Only completed tasks can be reopened.");
  const hadTime = (idx(db).closedSeconds.get(taskId) ?? 0) > 0;
  return {
    ...db,
    tasks: patch(db, taskId, { status: hadTime ? "paused" : "pending", completed_at: null }, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "reopened")],
  };
}

export function reassignTask(db: Database, actor: User, now: number, taskId: string, userId: string): Database {
  const task = getTask(db, taskId);
  if (!canManageTask(actor, task)) fail("You are not allowed to reassign this task.");
  if (task.status === "completed") fail("Reopen the task before reassigning it.");
  if (!canAssign(db, actor, userId, task.department_id)) fail("You cannot assign this task to that person.");
  if (task.assigned_to === userId) return db;
  return {
    ...db,
    // A running timer stops with the previous owner; their tracked time is kept.
    tasks: patch(db, taskId, { assigned_to: userId, status: task.status === "in_progress" ? "paused" : task.status }, now),
    sessions: closeOpen(db.sessions, taskId, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "reassigned", task.assigned_to, userId)],
  };
}

export function changePriority(db: Database, actor: User, now: number, taskId: string, priority: Priority): Database {
  const task = getTask(db, taskId);
  if (!canManageTask(actor, task)) fail("You are not allowed to change this task's priority.");
  if (task.priority === priority) return db;
  return {
    ...db,
    tasks: patch(db, taskId, { priority, display_order: null }, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "priority_changed", task.priority, priority)],
  };
}

export function updateTask(
  db: Database,
  actor: User,
  now: number,
  taskId: string,
  change: Partial<Pick<Task, "title" | "description" | "due_at" | "estimated_duration" | "category" | "internal_notes">>,
): Database {
  const task = getTask(db, taskId);
  if (!canManageTask(actor, task)) fail("You are not allowed to edit this task.");
  if (change.title !== undefined && change.title.trim().length < 3) fail("Give the task a title.");
  if (change.due_at !== undefined && Number.isNaN(ms(change.due_at))) fail("Set a valid due date and time.");
  return {
    ...db,
    tasks: patch(db, taskId, change, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "edited", null, Object.keys(change).join(", "))],
  };
}

/** Soft delete: the row stays, so past reports and logs keep their meaning. */
export function removeTask(db: Database, actor: User, now: number, taskId: string): Database {
  const task = getTask(db, taskId);
  if (!canManageTask(actor, task)) fail("You are not allowed to remove this task.");
  if (task.status === "completed") fail("Completed tasks stay on record and cannot be removed.");
  return {
    ...db,
    tasks: patch(db, taskId, { deleted_at: iso(now) }, now),
    sessions: closeOpen(db.sessions, taskId, now),
    logs: [...db.logs, entry(now, taskId, actor.id, "removed")],
  };
}

/** Manual order inside one priority level. `orderedIds` is the new top-to-bottom order. */
export function reorderTasks(db: Database, actor: User, now: number, orderedIds: string[]): Database {
  const tasks = orderedIds.map((id) => getTask(db, id));
  if (tasks.some((t) => !canManageTask(actor, t))) fail("You are not allowed to reorder these tasks.");
  if (new Set(tasks.map((t) => t.priority)).size > 1) fail("Tasks can only be reordered inside one priority level.");
  const rank = new Map(orderedIds.map((id, n) => [id, n]));
  return {
    ...db,
    tasks: db.tasks.map((t) => (rank.has(t.id) ? { ...t, display_order: rank.get(t.id)!, updated_at: iso(now) } : t)),
  };
}

export function escalateTask(db: Database, actor: User, now: number, taskId: string, reason: string): Database {
  const task = getTask(db, taskId);
  if (!canEscalate(actor, task)) fail("Only the department manager can escalate this task.");
  if (idx(db).escalated.has(taskId)) fail("This task is already escalated to the General Manager.");
  return { ...db, logs: [...db.logs, entry(now, taskId, actor.id, "escalated", null, reason.trim() || null)] };
}

export function submitDailyReport(
  db: Database,
  actor: User,
  now: number,
  deptId: string,
  date: string,
  notes: string,
): Database {
  if (!canSubmitDepartmentReport(actor, deptId)) fail("Only this department's manager can submit its report.");
  const existing = db.daily_reports.find((r) => r.department_id === deptId && r.report_date === date);
  const report = {
    id: existing?.id ?? uid("dr"),
    report_date: date,
    department_id: deptId,
    submitted_by: actor.id,
    submitted_at: iso(now),
    status: "submitted" as const,
    // Frozen copy of the numbers at submission time.
    generated_snapshot: departmentSnapshot(db, deptId, date, date, now),
    manager_notes: notes.trim(),
  };
  return {
    ...db,
    daily_reports: existing
      ? db.daily_reports.map((r) => (r.id === existing.id ? report : r))
      : [...db.daily_reports, report],
    logs: [...db.logs, entry(now, null, actor.id, "report_submitted", null, deptId)],
  };
}

export function reviewDailyReport(db: Database, actor: User, _now: number, reportId: string): Database {
  if (actor.role !== "gm") fail("Only the General Manager marks department reports as reviewed.");
  return {
    ...db,
    daily_reports: db.daily_reports.map((r) => (r.id === reportId ? { ...r, status: "reviewed" as const } : r)),
  };
}

export function submitExecutiveReport(db: Database, actor: User, now: number, date: string, notes: string): Database {
  if (!canSubmitExecutiveReport(actor)) fail("Only the General Manager submits the executive report.");
  const included = db.daily_reports.filter((r) => r.report_date === date);
  if (included.length === 0) fail("No department has submitted a report for this day yet.");
  const existing = db.executive_reports.find((r) => r.report_date === date);
  const report = {
    id: existing?.id ?? uid("er"),
    report_date: date,
    submitted_by: actor.id,
    submitted_at: iso(now),
    department_report_ids: included.map((r) => r.id),
    generated_snapshot: executiveSnapshot(db, date, now),
    executive_notes: notes.trim(),
  };
  return {
    ...db,
    daily_reports: db.daily_reports.map((r) => (r.report_date === date ? { ...r, status: "reviewed" as const } : r)),
    executive_reports: existing
      ? db.executive_reports.map((r) => (r.id === existing.id ? report : r))
      : [...db.executive_reports, report],
    logs: [...db.logs, entry(now, null, actor.id, "report_submitted", null, "executive")],
  };
}

/** Adds a "became overdue" activity entry once per task when its deadline passes. */
export function syncOverdue(db: Database, now: number): Database {
  const logged = new Set<string>();
  for (const l of db.logs) if (l.action === "overdue" && l.task_id) logged.add(l.task_id);
  const fresh = idx(db).live.filter((t) => t.status !== "completed" && ms(t.due_at) < now && !logged.has(t.id));
  if (fresh.length === 0) return db;
  return {
    ...db,
    logs: [...db.logs, ...fresh.map((t) => entry(ms(t.due_at), t.id, t.assigned_to ?? t.assigned_by, "overdue"))],
  };
}
