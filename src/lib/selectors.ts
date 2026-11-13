// Read side: every number on screen is derived here from tasks, time sessions
// and activity logs. Nothing is hard-coded.

import { canViewTask, isCompanyWide } from "./permissions";
import { addDays, dateKey, dayStart, fmtDuration, MIN, ms } from "./time";
import type {
  Database,
  Department,
  DepartmentSnapshot,
  DepartmentTotals,
  EmployeeReportRow,
  ExecutiveSnapshot,
  Task,
  TaskActivityLog,
  TaskTimeSession,
  User,
} from "./types";
import { PRIORITY_LABEL, PRIORITY_RANK } from "./types";

export const PAUSED_TOO_LONG_MIN = 45;

interface Index {
  userById: Map<string, User>;
  deptById: Map<string, Department>;
  taskById: Map<string, Task>;
  live: Task[]; // not deleted
  byDay: Map<string, Task[]>; // business date of due_at
  dayOf: Map<string, string>;
  closedSeconds: Map<string, number>;
  openByTask: Map<string, TaskTimeSession>;
  openByEmployee: Map<string, TaskTimeSession>;
  lastEnded: Map<string, number>;
  sessionsByEmployee: Map<string, TaskTimeSession[]>;
  escalated: Map<string, TaskActivityLog>;
}

const cache = new WeakMap<Database, Index>();

export function idx(db: Database): Index {
  const hit = cache.get(db);
  if (hit) return hit;
  const i: Index = {
    userById: new Map(db.users.map((u) => [u.id, u])),
    deptById: new Map(db.departments.map((d) => [d.id, d])),
    taskById: new Map(),
    live: [],
    byDay: new Map(),
    dayOf: new Map(),
    closedSeconds: new Map(),
    openByTask: new Map(),
    openByEmployee: new Map(),
    lastEnded: new Map(),
    sessionsByEmployee: new Map(),
    escalated: new Map(),
  };
  for (const t of db.tasks) {
    i.taskById.set(t.id, t);
    if (t.deleted_at) continue;
    i.live.push(t);
    const k = dateKey(t.due_at);
    i.dayOf.set(t.id, k);
    const list = i.byDay.get(k);
    if (list) list.push(t);
    else i.byDay.set(k, [t]);
  }
  for (const s of db.sessions) {
    const list = i.sessionsByEmployee.get(s.employee_id);
    if (list) list.push(s);
    else i.sessionsByEmployee.set(s.employee_id, [s]);
    if (s.ended_at === null) {
      i.openByTask.set(s.task_id, s);
      i.openByEmployee.set(s.employee_id, s);
    } else {
      i.closedSeconds.set(s.task_id, (i.closedSeconds.get(s.task_id) ?? 0) + s.duration_seconds);
      const e = ms(s.ended_at);
      if (e > (i.lastEnded.get(s.task_id) ?? 0)) i.lastEnded.set(s.task_id, e);
    }
  }
  for (const l of db.logs) if (l.action === "escalated" && l.task_id) i.escalated.set(l.task_id, l);
  cache.set(db, i);
  return i;
}

/** Active working time for a task. Paused time is never counted. */
export function elapsedSeconds(db: Database, taskId: string, now: number): number {
  const i = idx(db);
  const open = i.openByTask.get(taskId);
  const running = open ? Math.max(0, (now - ms(open.started_at)) / 1000) : 0;
  return (i.closedSeconds.get(taskId) ?? 0) + running;
}

export const isOverdue = (t: Task, now: number) => t.status !== "completed" && ms(t.due_at) < now;

/** Priority first, then manual rank, then earliest deadline, then assignment order. */
export function compareTasks(a: Task, b: Task): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p) return p;
  const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  const d = ms(a.due_at) - ms(b.due_at);
  if (d) return d;
  return ms(a.created_at) - ms(b.created_at);
}

export const sortTasks = (tasks: Task[]) => [...tasks].sort(compareTasks);

export const tasksForDay = (db: Database, key: string) => idx(db).byDay.get(key) ?? [];

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/** Tasks whose deadline falls inside a business-date range. */
export function tasksInRange(db: Database, from: string, to: string, pred?: (t: Task) => boolean): Task[] {
  const out: Task[] = [];
  for (const k of daysBetween(from, to)) for (const t of tasksForDay(db, k)) if (!pred || pred(t)) out.push(t);
  return out;
}

export type Period = "day" | "week" | "month";
export function rangeFor(period: Period, anchor: string): { from: string; to: string } {
  return { from: addDays(anchor, period === "day" ? 0 : period === "week" ? -6 : -29), to: anchor };
}

/** The working set for task boards: everything due today plus anything still open. */
export function boardTasks(db: Database, viewer: User, now: number): Task[] {
  const today = dateKey(now);
  const i = idx(db);
  return i.live.filter((t) => canViewTask(viewer, t) && (t.status !== "completed" || i.dayOf.get(t.id) === today));
}

/** An employee's open tasks in the order they should be worked. */
export function queueFor(db: Database, userId: string): Task[] {
  return sortTasks(idx(db).live.filter((t) => t.assigned_to === userId && t.status !== "completed"));
}

export interface Summary {
  assigned: number;
  completed: number;
  pending: number; // open and not yet due
  overdue: number;
  delayed: number; // overdue now, or completed after the deadline
  in_progress: number;
  paused: number;
  completion_rate: number; // completed / assigned x 100
  active_seconds: number;
  avg_seconds: number; // completed task duration / completed tasks
}

export function summarize(db: Database, tasks: Task[], now: number): Summary {
  const s: Summary = {
    assigned: tasks.length,
    completed: 0,
    pending: 0,
    overdue: 0,
    delayed: 0,
    in_progress: 0,
    paused: 0,
    completion_rate: 0,
    active_seconds: 0,
    avg_seconds: 0,
  };
  let done = 0;
  for (const t of tasks) {
    const el = elapsedSeconds(db, t.id, now);
    s.active_seconds += el;
    if (t.status === "completed") {
      s.completed++;
      done += el;
      if (t.completed_at && ms(t.completed_at) > ms(t.due_at)) s.delayed++;
      continue;
    }
    if (t.status === "in_progress") s.in_progress++;
    if (t.status === "paused") s.paused++;
    if (ms(t.due_at) < now) {
      s.overdue++;
      s.delayed++;
    } else s.pending++;
  }
  s.active_seconds = Math.round(s.active_seconds);
  s.completion_rate = s.assigned ? (s.completed / s.assigned) * 100 : 0;
  s.avg_seconds = s.completed ? Math.round(done / s.completed) : 0;
  return s;
}

export function employeeRow(db: Database, user: User, tasks: Task[], now: number): EmployeeReportRow {
  const s = summarize(db, tasks, now);
  return {
    user_id: user.id,
    name: user.name,
    title: user.title,
    assigned: s.assigned,
    completed: s.completed,
    pending: s.pending,
    overdue: s.overdue,
    delayed: s.delayed,
    active_seconds: s.active_seconds,
    avg_seconds: s.avg_seconds,
    completion_rate: s.completion_rate,
  };
}

/** Report rows for every employee the viewer is allowed to see. */
export function employeeRows(db: Database, users: User[], from: string, to: string, now: number): EmployeeReportRow[] {
  const ids = new Set(users.map((u) => u.id));
  const byUser = new Map<string, Task[]>();
  for (const t of tasksInRange(db, from, to, (x) => !!x.assigned_to && ids.has(x.assigned_to))) {
    const list = byUser.get(t.assigned_to!);
    if (list) list.push(t);
    else byUser.set(t.assigned_to!, [t]);
  }
  return users.map((u) => employeeRow(db, u, byUser.get(u.id) ?? [], now));
}

function followUpReason(db: Database, t: Task, now: number): string | null {
  if (t.status === "completed") return null;
  if (!t.assigned_to) return "No one is assigned";
  if (ms(t.due_at) < now) return `Overdue by ${fmtDuration((now - ms(t.due_at)) / 1000)}`;
  const pausedFor = pausedMinutes(db, t, now);
  if (pausedFor >= PAUSED_TOO_LONG_MIN) return `Paused for ${fmtDuration(pausedFor * 60)}`;
  return null;
}

function pausedMinutes(db: Database, t: Task, now: number): number {
  if (t.status !== "paused") return 0;
  const last = idx(db).lastEnded.get(t.id);
  return last ? (now - last) / MIN : 0;
}

export function departmentTotals(db: Database, deptId: string, from: string, to: string, now: number): DepartmentTotals {
  const s = summarize(
    db,
    tasksInRange(db, from, to, (t) => t.department_id === deptId),
    now,
  );
  return {
    department_id: deptId,
    department_name: idx(db).deptById.get(deptId)?.name ?? deptId,
    from,
    to,
    assigned: s.assigned,
    completed: s.completed,
    pending: s.pending,
    overdue: s.overdue,
    delayed: s.delayed,
    completion_rate: s.completion_rate,
    active_seconds: s.active_seconds,
    avg_seconds: s.avg_seconds,
  };
}

export function departmentSnapshot(db: Database, deptId: string, from: string, to: string, now: number): DepartmentSnapshot {
  const tasks = tasksInRange(db, from, to, (t) => t.department_id === deptId);
  const people = db.users.filter((u) => u.department_id === deptId && u.active_status);
  const employees = people
    .map((u) =>
      employeeRow(
        db,
        u,
        tasks.filter((t) => t.assigned_to === u.id),
        now,
      ),
    )
    .filter((r, n) => r.assigned > 0 || people[n].role === "employee");
  const follow_up = sortTasks(tasks)
    .map((t) => ({ task_id: t.id, title: t.title, reason: followUpReason(db, t, now) }))
    .filter((f): f is { task_id: string; title: string; reason: string } => f.reason !== null)
    .slice(0, 8);
  return { ...departmentTotals(db, deptId, from, to, now), employees, follow_up };
}

export function executiveSnapshot(db: Database, date: string, now: number): ExecutiveSnapshot {
  const tasks = tasksForDay(db, date);
  const s = summarize(db, tasks, now);
  const i = idx(db);
  const submitted = new Set(db.daily_reports.filter((r) => r.report_date === date).map((r) => r.department_id));
  return {
    date,
    assigned: s.assigned,
    completed: s.completed,
    pending: s.pending,
    overdue: s.overdue,
    completion_rate: s.completion_rate,
    active_seconds: s.active_seconds,
    departments: db.departments.map((d) => departmentTotals(db, d.id, date, date, now)),
    overdue_critical: tasks
      .filter((t) => t.priority === "critical" && isOverdue(t, now))
      .map((t) => ({ task_id: t.id, title: t.title, department_name: i.deptById.get(t.department_id)?.name ?? "" })),
    missing_departments: db.departments.filter((d) => !submitted.has(d.id)).map((d) => d.name),
  };
}

export interface CompanyKpis {
  employees: number;
  working: number;
  assigned: number;
  in_progress: number;
  completed: number;
  overdue: number;
  overdue_earlier: number;
  completion_rate: number;
  tracked_seconds: number;
}

export function companyKpis(db: Database, now: number): CompanyKpis {
  const today = dateKey(now);
  const i = idx(db);
  const s = summarize(db, tasksForDay(db, today), now);
  const overdue = i.live.filter((t) => isOverdue(t, now));
  return {
    employees: db.users.filter((u) => u.active_status).length,
    working: i.openByEmployee.size,
    assigned: s.assigned,
    in_progress: i.live.filter((t) => t.status === "in_progress").length,
    completed: s.completed,
    overdue: overdue.length,
    overdue_earlier: overdue.filter((t) => i.dayOf.get(t.id) !== today).length,
    completion_rate: s.completion_rate,
    tracked_seconds: s.active_seconds,
  };
}

export interface DepartmentNode {
  id: string;
  name: string;
  short: string;
  employees: number;
  assigned: number; // due today
  completed: number;
  completion: number; // 0-100
  active: number; // people with a timer running
  overdue: number; // all open overdue work
  pending: number;
  tracked_seconds: number;
}

/** Health follows overdue work, not the clock: none = on track, 1-2 = behind, 3+ = at risk. */
export type Health = "ok" | "behind" | "risk";
export const healthOf = (n: { overdue: number }): Health => (n.overdue === 0 ? "ok" : n.overdue <= 2 ? "behind" : "risk");
export const HEALTH_COLOR: Record<Health, string> = { ok: "#22c73f", behind: "#ffc24b", risk: "#ff4d5e" };

export function departmentNodes(db: Database, now: number): DepartmentNode[] {
  const today = dateKey(now);
  const i = idx(db);
  return db.departments.map((d) => {
    const s = summarize(
      db,
      tasksForDay(db, today).filter((t) => t.department_id === d.id),
      now,
    );
    let active = 0;
    for (const sess of i.openByEmployee.values()) if (i.taskById.get(sess.task_id)?.department_id === d.id) active++;
    return {
      id: d.id,
      name: d.name,
      short: d.short,
      employees: db.users.filter((u) => u.department_id === d.id && u.active_status).length,
      assigned: s.assigned,
      completed: s.completed,
      completion: s.completion_rate,
      active,
      overdue: i.live.filter((t) => t.department_id === d.id && isOverdue(t, now)).length,
      pending: s.pending,
      tracked_seconds: s.active_seconds,
    };
  });
}

export interface AttentionItem {
  id: string;
  kind: "critical_overdue" | "unassigned" | "paused_long" | "unresolved" | "bottleneck" | "escalated";
  severity: "critical" | "warning";
  title: string;
  detail: string;
  task_id?: string;
  department_id?: string;
  user_id?: string;
}

/** Plain, rule-based list of what needs a manager's attention. */
export function attentionItems(db: Database, now: number, deptIds?: string[]): AttentionItem[] {
  const i = idx(db);
  const inScope = (deptId: string) => !deptIds || deptIds.includes(deptId);
  const name = (id: string | null) => (id ? (i.userById.get(id)?.name ?? "Someone") : "No one");
  const dept = (id: string) => i.deptById.get(id)?.name ?? id;
  const out: AttentionItem[] = [];
  const open = i.live.filter((t) => t.status !== "completed" && inScope(t.department_id));

  for (const t of sortTasks(open)) {
    const late = ms(t.due_at) < now;
    const esc = i.escalated.get(t.id);
    if (esc) {
      out.push({
        id: `esc-${t.id}`,
        kind: "escalated",
        severity: "critical",
        title: t.title,
        detail: `Escalated to the General Manager by ${name(esc.actor_id)}${esc.new_value ? `: ${esc.new_value}` : "."}`,
        task_id: t.id,
        department_id: t.department_id,
      });
    }
    if (t.priority === "critical" && late) {
      out.push({
        id: `co-${t.id}`,
        kind: "critical_overdue",
        severity: "critical",
        title: t.title,
        detail: `Critical task overdue by ${fmtDuration((now - ms(t.due_at)) / 1000)}. ${name(t.assigned_to)} is assigned (${dept(t.department_id)}).`,
        task_id: t.id,
        department_id: t.department_id,
      });
    }
    if (!t.assigned_to && (t.priority === "critical" || t.priority === "high")) {
      out.push({
        id: `un-${t.id}`,
        kind: "unassigned",
        severity: t.priority === "critical" ? "critical" : "warning",
        title: t.title,
        detail: `${PRIORITY_LABEL[t.priority]} task in ${dept(t.department_id)} has no one assigned.`,
        task_id: t.id,
        department_id: t.department_id,
      });
    }
    const paused = pausedMinutes(db, t, now);
    if (paused >= PAUSED_TOO_LONG_MIN) {
      out.push({
        id: `pl-${t.id}`,
        kind: "paused_long",
        severity: "warning",
        title: t.title,
        detail: `Paused for ${fmtDuration(paused * 60)} by ${name(t.assigned_to)} (${dept(t.department_id)}).`,
        task_id: t.id,
        department_id: t.department_id,
      });
    }
  }

  const overdueByUser = new Map<string, number>();
  const overdueByDept = new Map<string, number>();
  const openByDept = new Map<string, number>();
  for (const t of open) {
    openByDept.set(t.department_id, (openByDept.get(t.department_id) ?? 0) + 1);
    if (ms(t.due_at) >= now) continue;
    overdueByDept.set(t.department_id, (overdueByDept.get(t.department_id) ?? 0) + 1);
    if (t.assigned_to) overdueByUser.set(t.assigned_to, (overdueByUser.get(t.assigned_to) ?? 0) + 1);
  }
  for (const [userId, count] of overdueByUser) {
    if (count < 2 || i.openByEmployee.has(userId)) continue;
    const u = i.userById.get(userId);
    if (!u) continue;
    out.push({
      id: `ur-${userId}`,
      kind: "unresolved",
      severity: "warning",
      title: u.name,
      detail: `${count} overdue tasks and no task running right now.`,
      user_id: userId,
      department_id: u.department_id ?? undefined,
    });
  }
  for (const [deptId, count] of overdueByDept) {
    if (count < 3) continue;
    const share = Math.round((count / (openByDept.get(deptId) ?? count)) * 100);
    out.push({
      id: `bn-${deptId}`,
      kind: "bottleneck",
      severity: count >= 5 ? "critical" : "warning",
      title: dept(deptId),
      detail: `${count} overdue tasks, ${share}% of this department's open work.`,
      department_id: deptId,
    });
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}

export interface TrendPoint {
  date: string;
  assigned: number;
  completed: number;
  overdue: number;
  rate: number;
  hours: number;
}

export function dailyTrend(db: Database, now: number, days = 14, pred?: (t: Task) => boolean): TrendPoint[] {
  const today = dateKey(now);
  return daysBetween(addDays(today, -(days - 1)), today).map((date) => {
    const tasks = pred ? tasksForDay(db, date).filter(pred) : tasksForDay(db, date);
    const s = summarize(db, tasks, now);
    return {
      date,
      assigned: s.assigned,
      completed: s.completed,
      overdue: s.overdue,
      rate: Math.round(s.completion_rate),
      hours: Math.round((s.active_seconds / 3600) * 10) / 10,
    };
  });
}

export interface EmployeeToday {
  current: Task | null; // running task
  paused: Task | null;
  status: "working" | "paused" | "idle";
  tracked_seconds: number; // active time logged today
  completed_today: number;
  remaining: number;
  overdue: number;
}

export function employeeToday(db: Database, userId: string, now: number): EmployeeToday {
  const i = idx(db);
  const start = dayStart(dateKey(now));
  let tracked = 0;
  for (const s of i.sessionsByEmployee.get(userId) ?? []) {
    const begun = ms(s.started_at);
    if (s.ended_at === null) tracked += Math.max(0, (now - Math.max(begun, start)) / 1000);
    else if (begun >= start) tracked += s.duration_seconds;
  }
  const mine = i.live.filter((t) => t.assigned_to === userId);
  const open = i.openByEmployee.get(userId);
  const current = open ? (i.taskById.get(open.task_id) ?? null) : null;
  const paused = current ? null : (sortTasks(mine.filter((t) => t.status === "paused"))[0] ?? null);
  return {
    current,
    paused,
    status: current ? "working" : paused ? "paused" : "idle",
    tracked_seconds: Math.round(tracked),
    completed_today: mine.filter((t) => t.completed_at && ms(t.completed_at) >= start).length,
    remaining: mine.filter((t) => t.status !== "completed").length,
    overdue: mine.filter((t) => isOverdue(t, now)).length,
  };
}

export interface FeedEntry {
  log: TaskActivityLog;
  actor: User | null;
  text: string;
  tone: "brand" | "warn" | "crit" | "muted" | "info";
  task: Task | null;
}

function describe(db: Database, log: TaskActivityLog): FeedEntry {
  const i = idx(db);
  const task = log.task_id ? (i.taskById.get(log.task_id) ?? null) : null;
  const actor = i.userById.get(log.actor_id) ?? null;
  const title = task ? `“${task.title}”` : "a task";
  const who = (id: string | null) => (id ? (i.userById.get(id)?.name ?? "someone") : "no one");
  const label = (p: string | null) => PRIORITY_LABEL[p as keyof typeof PRIORITY_LABEL] ?? p ?? "";
  let text = "";
  let tone: FeedEntry["tone"] = "muted";
  switch (log.action) {
    case "assigned":
      text = log.new_value ? `assigned ${title} to ${who(log.new_value)}` : `created ${title} without an assignee`;
      tone = "info";
      break;
    case "started":
      text = `started ${title}`;
      tone = "brand";
      break;
    case "resumed":
      text = `resumed ${title}`;
      tone = "brand";
      break;
    case "paused":
      text = `paused ${title}`;
      tone = "warn";
      break;
    case "completed":
      text = `completed ${title}`;
      tone = "brand";
      break;
    case "reopened":
      text = `reopened ${title}`;
      tone = "warn";
      break;
    case "reassigned":
      text = `reassigned ${title} from ${who(log.previous_value)} to ${who(log.new_value)}`;
      tone = "info";
      break;
    case "priority_changed":
      text = `changed ${title} from ${label(log.previous_value)} to ${label(log.new_value)}`;
      tone = "info";
      break;
    case "edited":
      text = `updated ${title}`;
      break;
    case "overdue":
      text = `${title} became overdue`;
      tone = "crit";
      break;
    case "removed":
      text = `removed ${title}`;
      break;
    case "escalated":
      text = `escalated ${title} to the General Manager`;
      tone = "crit";
      break;
    case "report_submitted":
      text =
        log.new_value === "executive"
          ? "submitted the consolidated executive report"
          : `submitted the ${i.deptById.get(log.new_value ?? "")?.name ?? "department"} daily report`;
      tone = "info";
      break;
  }
  return { log, actor: log.action === "overdue" ? null : actor, text, tone, task };
}

/** Newest-first activity the viewer is allowed to see. */
export function feed(db: Database, viewer: User, limit = 30, deptId?: string): FeedEntry[] {
  const i = idx(db);
  const wide = isCompanyWide(viewer);
  const visible = db.logs.filter((l) => {
    if (l.task_id) {
      const t = i.taskById.get(l.task_id);
      if (!t) return false;
      if (deptId && t.department_id !== deptId) return false;
      return wide || (viewer.role === "manager" ? t.department_id === viewer.department_id : t.assigned_to === viewer.id);
    }
    if (l.action !== "report_submitted") return false;
    if (deptId && l.new_value !== deptId) return false;
    return wide || (viewer.role === "manager" && l.new_value === viewer.department_id);
  });
  return visible
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, limit)
    .map((l) => describe(db, l));
}

export function taskLogs(db: Database, taskId: string, limit = 6): FeedEntry[] {
  return db.logs
    .filter((l) => l.task_id === taskId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit)
    .map((l) => describe(db, l));
}
