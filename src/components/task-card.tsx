"use client";

import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  ChevronDown,
  Flag,
  Pause,
  Play,
  Timer,
  Trash2,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Avatar, Btn, EASE, PriorityBadge, StatusBadge } from "@/components/kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  assignableUsers,
  canEscalate,
  canManageTask,
  canRunTimer,
  canSeeInternalNotes,
} from "@/lib/permissions";
import { elapsedSeconds, idx, isOverdue, taskLogs } from "@/lib/selectors";
import { actions, useDb, useMe, useNow } from "@/lib/store";
import { fmtAgo, fmtClock, fmtDay, fmtDue, fmtDuration, fmtTime } from "@/lib/time";
import { PRIORITIES, PRIORITY_COLOR, PRIORITY_LABEL, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Live active-time clock for a task. Ticks every second only while running. */
export function TrackedTime({ task, className }: { task: Task; className?: string }) {
  const db = useDb();
  const now = useNow(task.status === "in_progress");
  return <span className={cn("tnum font-mono", className)}>{fmtClock(elapsedSeconds(db, task.id, now))}</span>;
}

/**
 * Starting a task while another one is running asks first: only one task can
 * run per person. Returns `start` plus the dialog element to render.
 */
export function useStartTask() {
  const db = useDb();
  const me = useMe();
  const [pending, setPending] = useState<string | null>(null);
  const i = idx(db);
  const open = i.openByEmployee.get(me.id);
  const running = open ? i.taskById.get(open.task_id) : undefined;
  const next = pending ? i.taskById.get(pending) : undefined;

  const start = (taskId: string) => {
    if (open && open.task_id !== taskId) {
      setPending(taskId);
      return false;
    }
    return actions.startTask(taskId);
  };

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
      <DialogContent className="glass-solid block space-y-3 rounded-3xl p-6 sm:max-w-md">
        <p className="eyebrow">One task at a time</p>
        <DialogTitle className="display text-3xl">Pause your current task?</DialogTitle>
        <DialogDescription className="text-paper/65">
          You are working on <span className="font-semibold text-paper">“{running?.title}”</span>. Pause it and start{" "}
          <span className="font-semibold text-paper">“{next?.title}”</span>? Your tracked time is saved.
        </DialogDescription>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Btn onClick={() => setPending(null)}>Keep working</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (pending) actions.startTask(pending, true);
              setPending(null);
            }}
          >
            <Pause className="size-4" /> Pause and start
          </Btn>
        </div>
      </DialogContent>
    </Dialog>
  );
  return { start, dialog, running };
}

/** Play / Pause / Resume / Done for the person the task is assigned to. */
export function TimerControls({ task }: { task: Task }) {
  const { start, dialog } = useStartTask();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "pending" && (
        <Btn variant="primary" onClick={() => start(task.id)}>
          <Play className="size-4 fill-current" /> Start
        </Btn>
      )}
      {task.status === "paused" && (
        <Btn variant="primary" onClick={() => start(task.id)}>
          <Play className="size-4 fill-current" /> Resume
        </Btn>
      )}
      {task.status === "in_progress" && (
        <Btn onClick={() => actions.pauseTask(task.id)}>
          <Pause className="size-4 fill-current" /> Pause
        </Btn>
      )}
      {(task.status === "in_progress" || task.status === "paused") && (
        <Btn variant={task.status === "in_progress" ? "primary" : "ghost"} onClick={() => actions.completeTask(task.id)}>
          <Check className="size-4" /> Done
        </Btn>
      )}
      {task.status === "completed" && (
        <p className="flex items-center gap-2 text-sm text-brand-soft">
          <Check className="size-4" /> Completed
          {task.completed_at ? ` ${fmtDay(task.completed_at)} at ${fmtTime(task.completed_at)}` : ""}
        </p>
      )}
      {dialog}
    </div>
  );
}

export function TaskCard({
  task,
  siblings,
  hideAssignee,
}: {
  task: Task;
  siblings?: string[]; // ids in the same priority lane, top to bottom, for manual reordering
  hideAssignee?: boolean;
}) {
  const db = useDb();
  const running = task.status === "in_progress";
  const now = useNow(running);
  const [open, setOpen] = useState(false);
  const i = idx(db);
  const assignee = task.assigned_to ? i.userById.get(task.assigned_to) : null;
  const dept = i.deptById.get(task.department_id);
  const overdue = isOverdue(task, now);
  const elapsed = elapsedSeconds(db, task.id, now);
  const color = PRIORITY_COLOR[task.priority];
  const done = task.status === "completed";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("glass relative overflow-hidden rounded-2xl", running && "ring-1 ring-brand/45", done && "opacity-75")}
      data-task={task.id}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="block w-full p-4 pl-5 text-left"
      >
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} overdue={overdue} />
          <ChevronDown className={cn("ml-auto size-4 shrink-0 text-paper/40 transition-transform", open && "rotate-180")} />
        </div>
        <h3 className={cn("mt-2.5 text-[15px] leading-snug font-semibold", done && "line-through decoration-paper/30")}>
          {task.title}
        </h3>
        {!hideAssignee && (
          <div className="mt-2.5 flex items-center gap-2 text-xs text-paper/60">
            <Avatar user={assignee} size={22} live={running} />
            <span className="truncate font-medium text-paper/85">{assignee?.name ?? "Unassigned"}</span>
            <span className="text-paper/30">·</span>
            <span className="truncate">{dept?.name}</span>
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-paper/55">
          <span className={cn("flex items-center gap-1.5", overdue && "font-semibold text-crit")}>
            <CalendarClock className="size-3.5" /> {fmtDue(task.due_at, now)}
          </span>
          {task.estimated_duration ? (
            <span className="flex items-center gap-1.5">
              <Timer className="size-3.5" /> {fmtDuration(task.estimated_duration * 60)} est.
            </span>
          ) : null}
          <span className={cn("tnum flex items-center gap-1.5 font-mono", running ? "text-brand" : elapsed > 0 ? "text-paper/80" : "")}>
            {running && <span className="live-dot size-1.5 rounded-full bg-brand text-brand" />}
            {fmtClock(elapsed)} tracked
          </span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <TaskDetails task={task} siblings={siblings} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function TaskDetails({ task, siblings }: { task: Task; siblings?: string[] }) {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const i = idx(db);
  const manage = canManageTask(me, task);
  const assignable = manage ? assignableUsers(db, me, task.department_id) : [];
  const pos = siblings?.indexOf(task.id) ?? -1;
  const logs = taskLogs(db, task.id, 5);
  const escalated = i.escalated.has(task.id);

  const move = (delta: number) => {
    if (!siblings || pos < 0) return;
    const next = [...siblings];
    const to = pos + delta;
    if (to < 0 || to >= next.length) return;
    [next[pos], next[to]] = [next[to], next[pos]];
    actions.reorderTasks(next);
  };

  return (
    <div className="space-y-4 border-t border-white/8 p-4 pl-5">
      <p className="text-sm leading-relaxed text-paper/75">{task.description}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {[
          ["Assigned by", i.userById.get(task.assigned_by)?.name ?? "—"],
          ["Assigned", `${fmtDay(task.created_at)} ${fmtTime(task.created_at)}`],
          ["Category", task.category ?? "—"],
          ["Due", `${fmtDay(task.due_at)} ${fmtTime(task.due_at)}`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-paper/45">{k}</dt>
            <dd className="font-medium text-paper/85">{v}</dd>
          </div>
        ))}
      </dl>

      {task.internal_notes && canSeeInternalNotes(me) && (
        <p className="rounded-xl border border-warn/25 bg-warn/8 p-3 text-xs text-paper/80">
          <span className="font-semibold text-warn">Internal note · </span>
          {task.internal_notes}
        </p>
      )}
      {task.completion_note && (
        <p className="rounded-xl border border-brand/25 bg-brand/8 p-3 text-xs text-paper/80">
          <span className="font-semibold text-brand-soft">Completion note · </span>
          {task.completion_note}
        </p>
      )}

      {canRunTimer(me, task) && <TimerControls task={task} />}

      {manage && (
        <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-paper/45 uppercase">Manage task</p>
          {task.status !== "completed" && (
            <>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => actions.changePriority(task.id, p)}
                    aria-pressed={task.priority === p}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase transition"
                    style={
                      task.priority === p
                        ? { color: "#070908", background: PRIORITY_COLOR[p] }
                        : { color: PRIORITY_COLOR[p], boxShadow: `inset 0 0 0 1px ${PRIORITY_COLOR[p]}55` }
                    }
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
              <label className="block text-xs text-paper/55">
                Assigned to
                <select
                  className="field mt-1"
                  value={task.assigned_to ?? ""}
                  onChange={(e) => e.target.value && actions.reassignTask(task.id, e.target.value)}
                >
                  {!task.assigned_to && <option value="">Choose a team member…</option>}
                  {task.assigned_to && !assignable.some((u) => u.id === task.assigned_to) && (
                    <option value={task.assigned_to}>{i.userById.get(task.assigned_to)?.name}</option>
                  )}
                  {assignable.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.title}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {siblings && siblings.length > 1 && task.status !== "completed" && (
              <>
                <Btn size="sm" onClick={() => move(-1)} disabled={pos <= 0}>
                  <ArrowUp className="size-3.5" /> Move up
                </Btn>
                <Btn size="sm" onClick={() => move(1)} disabled={pos < 0 || pos >= siblings.length - 1}>
                  <ArrowDown className="size-3.5" /> Move down
                </Btn>
              </>
            )}
            {task.status === "completed" && (
              <Btn size="sm" onClick={() => actions.reopenTask(task.id)}>
                <Undo2 className="size-3.5" /> Reopen task
              </Btn>
            )}
            {task.status !== "completed" &&
              (confirmRemove ? (
                <>
                  <Btn size="sm" variant="danger" onClick={() => actions.removeTask(task.id)}>
                    Confirm remove
                  </Btn>
                  <Btn size="sm" variant="subtle" onClick={() => setConfirmRemove(false)}>
                    Cancel
                  </Btn>
                </>
              ) : (
                <Btn size="sm" variant="subtle" onClick={() => setConfirmRemove(true)}>
                  <Trash2 className="size-3.5" /> Remove
                </Btn>
              ))}
          </div>
        </div>
      )}

      {canEscalate(me, task) &&
        (escalated ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-crit">
            <Flag className="size-3.5" /> Escalated to the General Manager
          </p>
        ) : (
          <Btn size="sm" variant="danger" onClick={() => actions.escalateTask(task.id, "")}>
            <Flag className="size-3.5" /> Escalate to General Manager
          </Btn>
        ))}

      {logs.length > 0 && (
        <ul className="space-y-1.5 border-t border-white/8 pt-3 text-xs text-paper/55">
          {logs.map((e) => (
            <li key={e.log.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                {e.actor && <span className="font-semibold text-paper/80">{e.actor.name} </span>}
                {e.text.replace(` “${task.title}”`, "").replace(`“${task.title}” `, "")}
              </span>
              <span className="shrink-0 text-paper/40">{fmtAgo(e.log.created_at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
