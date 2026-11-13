"use client";

// The employee's point of view: what is assigned to me, in what order, and one
// big button to start working. Built mobile first.

import {
  AlarmClock,
  CalendarClock,
  Check,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  Avatar,
  Btn,
  EASE,
  Empty,
  Panel,
  PriorityBadge,
  Ring,
  Segmented,
} from "@/components/kit";
import { TaskCard, useStartTask } from "@/components/task-card";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  dailyTrend,
  elapsedSeconds,
  employeeToday,
  idx,
  isOverdue,
  queueFor,
  sortTasks,
  summarize,
  tasksForDay,
} from "@/lib/selectors";
import { actions, useDb, useMe, useNow } from "@/lib/store";
import {
  dateKey,
  dayStart,
  fmtClock,
  fmtDue,
  fmtDuration,
  fmtKey,
  fmtKeyLong,
  fmtTime,
  greeting,
  MIN,
  ms,
} from "@/lib/time";
import { PRIORITY_COLOR, ROLE_LABEL, type Task } from "@/lib/types";
import { openDemo } from "@/lib/ui";
import { cn } from "@/lib/utils";

const first = (name: string) => name.split(" ")[0];

// --- My Day -------------------------------------------------------------------

export function MyDay() {
  const db = useDb();
  const me = useMe();
  const working = idx(db).openByEmployee.has(me.id);
  const now = useNow(working);
  const today = employeeToday(db, me.id, now);
  const queue = useMemo(() => queueFor(db, me.id), [db, me.id]);
  const { start, dialog } = useStartTask();
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const begin = (id: string) => {
    setBrowsing(false);
    setCelebrate(null);
    start(id);
  };
  const finish = (id: string) => {
    if (actions.completeTask(id)) setCelebrate(id);
  };

  const mode = celebrate
    ? "done"
    : today.current && !browsing
      ? "focus"
      : "day";
  return (
    <div className="mx-auto max-w-2xl">
      {/* New screen mounts immediately: animation never delays a control. */}
      <motion.div
        key={
          mode === "focus"
            ? `focus-${today.current?.id}`
            : mode === "done"
              ? `done-${celebrate}`
              : "day"
        }
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: EASE }}
      >
        {mode === "done" && celebrate && (
          <DoneScreen
            taskId={celebrate}
            next={queue[0]}
            onStart={begin}
            onClose={() => setCelebrate(null)}
          />
        )}
        {mode === "focus" && today.current && (
          <FocusMode
            task={today.current}
            now={now}
            onDone={finish}
            onBrowse={() => setBrowsing(true)}
          />
        )}
        {mode === "day" && (
          <>
            <p className="eyebrow">{fmtKeyLong(dateKey(now))}</p>
            <h1 className="display mt-2 text-4xl md:text-5xl">
              {greeting(now)}, {first(me.name)}
            </h1>
            <p className="mt-2 text-lg text-paper/65">
              Here&rsquo;s your mission for today.
            </p>

            <dl className="mt-6 grid grid-cols-3 gap-2.5">
              {[
                ["Tasks Remaining", String(today.remaining), ""],
                [
                  "Tasks Completed",
                  String(today.completed_today),
                  "text-brand",
                ],
                ["Time Tracked", fmtDuration(today.tracked_seconds), ""],
              ].map(([k, v, tone]) => (
                <div
                  key={k}
                  className="glass rounded-2xl p-3 text-center sm:p-4"
                >
                  <dd
                    className={cn(
                      "tnum font-display text-[1.75rem] leading-none font-bold italic sm:text-4xl",
                      tone,
                    )}
                  >
                    {v}
                  </dd>
                  <dt className="mt-1.5 text-[10px] font-semibold tracking-[0.12em] text-paper/50 uppercase sm:text-[11px]">
                    {k}
                  </dt>
                </div>
              ))}
            </dl>

            {today.current && (
              <button
                type="button"
                onClick={() => setBrowsing(false)}
                className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-brand/50 bg-brand/12 p-3.5 text-left"
              >
                <span className="live-dot size-2.5 shrink-0 rounded-full bg-brand text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold tracking-[0.16em] text-brand uppercase">
                    Working now
                  </span>
                  <span className="block truncate text-sm font-semibold">
                    {today.current.title}
                  </span>
                </span>
                <span className="tnum font-mono text-lg text-brand">
                  {fmtClock(elapsedSeconds(db, today.current.id, now))}
                </span>
              </button>
            )}

            <h2 className="eyebrow mt-8 mb-3">Your priority queue</h2>
            {queue.length === 0 ? (
              <Empty
                icon={<Check className="size-7" />}
                title="All done for now"
                hint="You have no open tasks. New assignments from your manager will appear here."
              />
            ) : (
              <>
                <HeroTask
                  task={queue[0]}
                  now={now}
                  onStart={begin}
                  onOpen={() => setBrowsing(false)}
                />
                <ul className="mt-3 space-y-2.5">
                  {queue.slice(1).map((t) => (
                    <QueueRow
                      key={t.id}
                      task={t}
                      now={now}
                      onStart={begin}
                      onOpen={() => setBrowsing(false)}
                    />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </motion.div>
      {dialog}
    </div>
  );
}

const isNew = (t: Task, now: number) =>
  t.status === "pending" && now - ms(t.created_at) < 60 * MIN;

function Meta({ task, now }: { task: Task; now: number }) {
  const db = useDb();
  const overdue = isOverdue(task, now);
  const tracked = elapsedSeconds(db, task.id, now);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-paper/55">
      <span
        className={cn(
          "flex items-center gap-1.5",
          overdue && "font-semibold text-crit",
        )}
      >
        <CalendarClock className="size-3.5" /> {overdue ? "Overdue · " : "Due "}
        {fmtDue(task.due_at, now)}
      </span>
      {task.estimated_duration ? (
        <span className="flex items-center gap-1.5">
          <Timer className="size-3.5" />{" "}
          {fmtDuration(task.estimated_duration * 60)}
        </span>
      ) : null}
      {tracked > 0 && (
        <span className="tnum font-mono text-warn">
          {fmtClock(tracked)} tracked
        </span>
      )}
    </div>
  );
}

function HeroTask({
  task,
  now,
  onStart,
  onOpen,
}: {
  task: Task;
  now: number;
  onStart: (id: string) => void;
  onOpen: () => void;
}) {
  const db = useDb();
  const color = PRIORITY_COLOR[task.priority];
  const by = idx(db).userById.get(task.assigned_by);
  const running = task.status === "in_progress";
  return (
    <motion.div
      layout
      className="glass relative overflow-hidden rounded-3xl p-5"
      style={{
        boxShadow: `inset 0 0 0 1px ${color}60, 0 34px 90px -46px ${color}`,
      }}
    >
      <span
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: color }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Up next</span>
        <PriorityBadge priority={task.priority} />
        {isNew(task, now) && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold tracking-wider text-ink uppercase">
            New
          </span>
        )}
      </div>
      <h3 className="display mt-3 text-3xl text-balance">{task.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-paper/65">
        {task.description}
      </p>
      <div className="mt-3">
        <Meta task={task} now={now} />
      </div>
      {by && (
        <p className="mt-2 text-xs text-paper/45">Assigned by {by.name}</p>
      )}
      <button
        type="button"
        onClick={() => (running ? onOpen() : onStart(task.id))}
        className="relative mt-5 flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand text-xl font-bold text-ink shadow-[0_18px_50px_-16px_rgb(34_199_63/85%)] transition active:scale-[0.98]"
      >
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl ring-2 ring-brand"
          animate={{ scale: [1, 1.05, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Play className="size-6 fill-current" />
        {running
          ? "Open timer"
          : task.status === "paused"
            ? "Resume task"
            : "Start task"}
      </button>
    </motion.div>
  );
}

function QueueRow({
  task,
  now,
  onStart,
  onOpen,
}: {
  task: Task;
  now: number;
  onStart: (id: string) => void;
  onOpen: () => void;
}) {
  const running = task.status === "in_progress";
  return (
    <motion.li
      layout
      className="glass relative flex items-center gap-3 overflow-hidden rounded-2xl p-3.5 pl-5"
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: PRIORITY_COLOR[task.priority] }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {isNew(task, now) && (
            <span className="text-[10px] font-bold tracking-wider text-brand uppercase">
              New
            </span>
          )}
          {task.status === "paused" && (
            <span className="text-[10px] font-bold tracking-wider text-warn uppercase">
              Paused
            </span>
          )}
        </div>
        <p className="mt-1.5 truncate text-[15px] font-semibold">
          {task.title}
        </p>
        <div className="mt-1">
          <Meta task={task} now={now} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => (running ? onOpen() : onStart(task.id))}
        aria-label={`${running ? "Open timer for" : task.status === "paused" ? "Resume" : "Start"} ${task.title}`}
        className="grid size-14 shrink-0 place-items-center rounded-full border border-brand/50 bg-brand/14 text-brand transition hover:bg-brand hover:text-ink active:scale-95"
      >
        <Play className="size-5 fill-current" />
      </button>
    </motion.li>
  );
}

function FocusMode({
  task,
  now,
  onDone,
  onBrowse,
}: {
  task: Task;
  now: number;
  onDone: (id: string) => void;
  onBrowse: () => void;
}) {
  const db = useDb();
  const elapsed = elapsedSeconds(db, task.id, now);
  const est = (task.estimated_duration ?? 0) * 60;
  const over = est > 0 && elapsed > est;
  const progress = est > 0 ? Math.min(1, elapsed / est) : (elapsed % 60) / 60;
  const color = over ? "#ffc24b" : "#22c73f";
  return (
    <div className="flex flex-col items-center text-center">
      <p className="eyebrow flex items-center gap-2.5">
        <span className="live-dot size-2 rounded-full bg-brand text-brand" />{" "}
        Working now
      </p>
      <h1 className="display mt-3 text-4xl text-balance md:text-5xl">
        {task.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <PriorityBadge priority={task.priority} />
        <span
          className={cn(
            "text-xs",
            isOverdue(task, now) ? "font-semibold text-crit" : "text-paper/55",
          )}
        >
          Due {fmtDue(task.due_at, now)}
        </span>
      </div>

      {over && (
        <p
          role="alert"
          className="mt-5 flex items-center gap-2 rounded-full border border-warn/45 bg-warn/12 px-4 py-2 text-sm font-semibold text-warn"
        >
          <AlarmClock className="size-4 shrink-0" /> Over the time allowed. Your manager has been alerted.
        </p>
      )}

      <div className="relative mt-8">
        <motion.div
          aria-hidden="true"
          className="absolute -inset-10 rounded-full blur-3xl"
          style={{ background: `${color}2e` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        <Ring value={progress} size={272} stroke={12} color={color}>
          <div>
            <p
              className="tnum font-mono text-[3.4rem] leading-none font-semibold tracking-tight"
              role="timer"
              aria-live="off"
            >
              {fmtClock(elapsed)}
            </p>
            <p className="mt-3 text-sm text-paper/55">
              {est === 0
                ? "active time"
                : over
                  ? `${fmtDuration(elapsed - est)} over the ${fmtDuration(est)} allowed`
                  : `of ${fmtDuration(est)} allowed`}
            </p>
          </div>
        </Ring>
      </div>

      <div className="glass mt-8 w-full rounded-2xl p-4 text-left">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-paper/45 uppercase">
          Instructions
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-paper/80">
          {task.description}
        </p>
      </div>

      <div className="mt-5 grid w-full grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => actions.pauseTask(task.id)}
          className="glass flex h-16 items-center justify-center gap-2.5 rounded-2xl text-lg font-semibold transition active:scale-[0.97]"
        >
          <Pause className="size-5 fill-current" /> Pause
        </button>
        <button
          type="button"
          onClick={() => onDone(task.id)}
          className="flex h-16 items-center justify-center gap-2.5 rounded-2xl bg-brand text-lg font-bold text-ink shadow-[0_18px_50px_-16px_rgb(34_199_63/85%)] transition active:scale-[0.97]"
        >
          <Check className="size-6" /> Done
        </button>
      </div>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-5 text-sm text-paper/50 underline-offset-4 hover:text-paper hover:underline"
      >
        See my other tasks
      </button>
    </div>
  );
}

function DoneScreen({
  taskId,
  next,
  onStart,
  onClose,
}: {
  taskId: string;
  next?: Task;
  onStart: (id: string) => void;
  onClose: () => void;
}) {
  const db = useDb();
  const now = useNow();
  const task = idx(db).taskById.get(taskId);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  if (!task) return null;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mt-4 grid size-28 place-items-center">
        {[0, 1].map((n) => (
          <motion.span
            key={n}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border-2 border-brand"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 2.3, opacity: 0 }}
            transition={{ duration: 1.3, delay: n * 0.25, ease: EASE }}
          />
        ))}
        {Array.from({ length: 10 }).map((_, n) => {
          const a = (n / 10) * Math.PI * 2;
          return (
            <motion.span
              key={n}
              aria-hidden="true"
              className="absolute size-2 rounded-full bg-brand-soft"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(a) * 92,
                y: Math.sin(a) * 92,
                opacity: 0,
                scale: 0.4,
              }}
              transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
            />
          );
        })}
        <motion.div
          className="grid size-28 place-items-center rounded-full bg-brand text-ink"
          initial={{ scale: 0.3 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 14 }}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.45, delay: 0.2 }}
            />
          </svg>
        </motion.div>
      </div>
      <p className="eyebrow mt-8">Task complete</p>
      <h1 className="display mt-2 text-4xl">Nice work</h1>
      <p className="mt-2 text-paper/65">
        “{task.title}” ·{" "}
        <span className="tnum font-semibold text-paper">
          {fmtDuration(elapsedSeconds(db, task.id, now))}
        </span>{" "}
        tracked
      </p>

      {saved ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-brand-soft">
          <Check className="size-4" /> Note saved for your manager
        </p>
      ) : (
        <form
          className="mt-5 flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim() && actions.setCompletionNote(task.id, note))
              setSaved(true);
          }}
        >
          <input
            className="field"
            placeholder="Add a short note (optional)"
            aria-label="Completion note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Btn type="submit" disabled={!note.trim()}>
            Save
          </Btn>
        </form>
      )}

      {next ? (
        <div className="glass mt-6 w-full rounded-3xl p-5 text-left">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Next priority</span>
            <PriorityBadge priority={next.priority} />
          </div>
          <p className="mt-2 text-lg font-semibold">{next.title}</p>
          <div className="mt-1.5">
            <Meta task={next} now={now} />
          </div>
          <button
            type="button"
            onClick={() => onStart(next.id)}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-lg font-bold text-ink transition active:scale-[0.98]"
          >
            <Play className="size-5 fill-current" />{" "}
            {next.status === "paused" ? "Resume next task" : "Start next task"}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-paper/60">
          That was your last open task.
        </p>
      )}
      <Btn variant="subtle" className="mt-4" onClick={onClose}>
        Back to my day
      </Btn>
    </div>
  );
}

// --- My Tasks -----------------------------------------------------------------

export function MyTasks() {
  const db = useDb();
  const me = useMe();
  const [tab, setTab] = useState<"todo" | "done" | "all">("todo");
  const { todo, done } = useMemo(() => {
    const mine = idx(db).live.filter((t) => t.assigned_to === me.id);
    return {
      todo: sortTasks(mine.filter((t) => t.status !== "completed")),
      done: mine
        .filter((t) => t.status === "completed")
        .sort(
          (a, b) =>
            ms(b.completed_at ?? b.updated_at) -
            ms(a.completed_at ?? a.updated_at),
        )
        .slice(0, 30),
    };
  }, [db, me.id]);
  const list =
    tab === "todo" ? todo : tab === "done" ? done : [...todo, ...done];
  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">My tasks</p>
      <h1 className="display mt-2 text-4xl md:text-5xl">
        Everything assigned to you
      </h1>
      <p className="mt-2 text-sm text-paper/60">
        Sorted by priority, then deadline. Tap a task for details and timer
        controls.
      </p>
      <Segmented
        id="my-tasks"
        className="mt-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: "todo", label: `To do · ${todo.length}` },
          { value: "done", label: `Completed · ${done.length}` },
          { value: "all", label: "All" },
        ]}
      />
      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <Empty
            icon={<ListChecks className="size-6" />}
            title="Nothing here"
            hint="Tasks you are assigned will show up in this list."
          />
        )}
        <AnimatePresence initial={false}>
          {list.map((t) => (
            <TaskCard key={t.id} task={t} hideAssignee />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- My Progress ---------------------------------------------------------------

export function MyProgress() {
  const db = useDb();
  const me = useMe();
  const working = idx(db).openByEmployee.has(me.id);
  const now = useNow(working);
  const key = dateKey(now);
  const data = useMemo(() => {
    const mine = (t: Task) => t.assigned_to === me.id;
    const start = dayStart(key);
    return {
      week: dailyTrend(db, now, 7, mine),
      history: idx(db)
        .live.filter(
          (t) => mine(t) && t.completed_at && ms(t.completed_at) >= start,
        )
        .sort((a, b) => ms(b.completed_at!) - ms(a.completed_at!)),
    };
    // `now` only matters once per day here; the key covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, me.id, key]);
  const s = summarize(
    db,
    tasksForDay(db, key).filter((t) => t.assigned_to === me.id),
    now,
  );
  const today = employeeToday(db, me.id, now);
  const max = Math.max(1, ...data.week.map((d) => d.completed));

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">My progress</p>
      <h1 className="display mt-2 text-4xl md:text-5xl">Your day so far</h1>
      <p className="mt-2 text-sm text-paper/60">
        This summary builds itself from your tasks. You never need to write a
        report.
      </p>

      <div className="glass mt-6 flex flex-wrap items-center gap-5 rounded-3xl p-5">
        <Ring value={s.completion_rate / 100} size={128} stroke={11}>
          <div className="text-center">
            <p className="tnum font-display text-4xl leading-none font-bold italic">
              {Math.round(s.completion_rate)}%
            </p>
            <p className="mt-1 text-[10px] tracking-wider text-paper/50 uppercase">
              complete
            </p>
          </div>
        </Ring>
        <dl className="grid min-w-[200px] flex-1 grid-cols-2 gap-x-4 gap-y-4">
          {[
            ["Tasks completed", String(s.completed)],
            ["Tasks remaining", String(s.assigned - s.completed)],
            ["Active task time", fmtDuration(today.tracked_seconds)],
            [
              "Average task duration",
              s.avg_seconds ? fmtDuration(s.avg_seconds) : "—",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dd className="tnum font-display text-3xl leading-none font-bold italic">
                {v}
              </dd>
              <dt className="mt-1 text-[11px] tracking-wider text-paper/50 uppercase">
                {k}
              </dt>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-2 text-xs text-paper/45">
        Counts cover tasks due today. Active task time is the time with a timer
        running; it is not attendance or total working hours.
      </p>

      <Panel title="Last 7 days" className="mt-5">
        <div className="flex h-36 items-end gap-2">
          {data.week.map((d, n) => (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="tnum text-xs font-semibold text-paper/75">
                {d.completed}
              </span>
              <motion.div
                className={cn(
                  "w-full rounded-t-lg",
                  n === data.week.length - 1 ? "bg-brand" : "bg-brand/35",
                )}
                initial={{ height: 0 }}
                animate={{
                  height: `${Math.max(4, (d.completed / max) * 100)}%`,
                }}
                transition={{ duration: 0.7, delay: n * 0.05, ease: EASE }}
              />
              <span className="text-[10px] text-paper/45">
                {fmtKey(d.date).split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-paper/45">Tasks completed per day.</p>
      </Panel>

      <Panel title="Completed today" className="mt-5">
        {data.history.length === 0 ? (
          <Empty
            title="Nothing completed yet"
            hint="Finished tasks appear here with the time you tracked."
          />
        ) : (
          <ul className="space-y-1">
            {data.history.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <Check className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {t.title}
                  </span>
                  <span className="block text-xs text-paper/45">
                    Finished at {fmtTime(t.completed_at!)}
                  </span>
                </span>
                <span className="tnum font-mono text-sm text-paper/75">
                  {fmtDuration(elapsedSeconds(db, t.id, now))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// --- Profile -------------------------------------------------------------------

export function Profile() {
  const db = useDb();
  const me = useMe();
  const i = idx(db);
  const dept = me.department_id ? i.deptById.get(me.department_id) : null;
  const manager = me.manager_id ? i.userById.get(me.manager_id) : null;
  const restaurant = db.restaurants.find((r) => r.id === me.restaurant_id);
  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">Profile</p>
      <div className="glass mt-3 flex flex-wrap items-center gap-5 rounded-3xl p-5">
        <Avatar user={me} size={84} />
        <div className="min-w-0">
          <h1 className="display text-4xl">{me.name}</h1>
          <p className="mt-1.5 text-sm text-paper/65">
            {me.title}
            {dept ? ` · ${dept.name}` : ""}
            {restaurant ? ` · ${restaurant.name}` : ""}
          </p>
          {manager && (
            <p className="mt-0.5 text-xs text-paper/45">
              Reports to {manager.name}
            </p>
          )}
        </div>
      </div>

      <Panel
        title="What you can do"
        icon={<ShieldCheck className="size-5" />}
        className="mt-5"
      >
        <p className="mb-3 text-xs text-paper/50">
          Access level: {ROLE_LABEL[me.role]}
        </p>
        <ul className="space-y-2">
          {ROLE_PERMISSIONS[me.role].map((p) => (
            <li
              key={p}
              className="flex items-start gap-2.5 text-sm text-paper/80"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-brand" /> {p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-paper/45">
          You cannot see other employees&rsquo; reports or the executive
          dashboards.
        </p>
      </Panel>

      <Panel title="Demo environment" className="mt-5">
        <p className="text-sm text-paper/65">
          This is a demonstration with fictional people and tasks. Switch to
          another profile to see the same data as a manager or executive, or
          reset the demo to its original state.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={openDemo}>
            <Users className="size-4" /> Switch profile
          </Btn>
          <Btn variant="subtle" onClick={openDemo}>
            <RotateCcw className="size-4" /> Reset demo
          </Btn>
        </div>
      </Panel>
    </div>
  );
}
