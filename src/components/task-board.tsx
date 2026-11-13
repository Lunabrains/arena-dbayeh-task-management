"use client";

import { FilterX, Search } from "lucide-react";
import { useMemo } from "react";
import { Btn, Chip, Empty } from "@/components/kit";
import { TaskCard } from "@/components/task-card";
import { isCompanyWide } from "@/lib/permissions";
import { boardTasks, idx, isOverdue, overTimeSeconds, sortTasks } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import { PRIORITIES, PRIORITY_COLOR, PRIORITY_LABEL, type Database, type Priority, type Task } from "@/lib/types";
import { NO_FILTERS, resetBoard, setBoard, useUi, type BoardQuick } from "@/lib/ui";
import { cn } from "@/lib/utils";

const QUICK: { value: BoardQuick; label: string; tone?: "crit" | "warn" }[] = [
  { value: "open", label: "All open" },
  { value: "overdue", label: "Overdue", tone: "crit" },
  { value: "over_time", label: "Over time allowed", tone: "warn" },
  { value: "in_progress", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "pending", label: "Not started" },
  { value: "unassigned", label: "Unassigned" },
  { value: "done", label: "Completed today" },
  { value: "all", label: "Everything" },
];

function matchesQuick(q: BoardQuick, t: Task, db: Database, now: number): boolean {
  const open = t.status !== "completed";
  switch (q) {
    case "open":
      return open;
    case "overdue":
      return isOverdue(t, now);
    case "over_time":
      return open && overTimeSeconds(db, t, now) > 0;
    case "in_progress":
      return t.status === "in_progress";
    case "paused":
      return t.status === "paused";
    case "pending":
      return t.status === "pending";
    case "unassigned":
      return open && !t.assigned_to;
    case "done":
      return !open;
    case "all":
      return true;
  }
}

const select = "field h-10 w-auto min-w-[150px] flex-1 py-0 pr-8 sm:flex-none";

/**
 * Priority lanes (Critical, High, Medium, Low) with filters for status,
 * person, department, priority and restaurant. Filters live in the shared
 * interface state so alerts and tiles elsewhere can jump straight to a view.
 */
export function TaskBoard() {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const f = useUi((s) => s.board);
  const wide = isCompanyWide(me);
  const i = idx(db);

  const all = useMemo(() => boardTasks(db, me, now), [db, me, now]);

  // People who appear on these tasks, for the "who" filter.
  const people = useMemo(() => {
    const ids = new Set(all.map((t) => t.assigned_to).filter((id): id is string => !!id));
    return db.users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, db.users]);
  const outlets = useMemo(
    () => db.restaurants.filter((r) => people.some((u) => u.restaurant_id === r.id)),
    [db.restaurants, people],
  );

  const { lanes, counts } = useMemo(() => {
    const users = idx(db).userById;
    const needle = f.q.trim().toLowerCase();
    // Everything except the status filter, so each status chip can show its count.
    const base = all.filter((t) => {
      const who = t.assigned_to ? users.get(t.assigned_to) : undefined;
      if (f.assignee && t.assigned_to !== f.assignee) return false;
      if (f.dept && t.department_id !== f.dept) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.restaurant && who?.restaurant_id !== f.restaurant) return false;
      if (!needle) return true;
      return `${t.title} ${who?.name ?? "unassigned"} ${t.category ?? ""}`.toLowerCase().includes(needle);
    });
    const counts = Object.fromEntries(
      QUICK.map((q) => [q.value, base.filter((t) => matchesQuick(q.value, t, db, now)).length]),
    ) as Record<BoardQuick, number>;
    const shown = base.filter((t) => matchesQuick(f.quick, t, db, now));
    return { lanes: PRIORITIES.map((p) => sortTasks(shown.filter((t) => t.priority === p))), counts };
  }, [all, db, now, f]);

  const total = lanes.reduce((n, l) => n + l.length, 0);
  const filtered = f.assignee || f.dept || f.priority || f.restaurant || f.q || f.quick !== NO_FILTERS.quick;

  return (
    <div>
      <div className="no-print mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {QUICK.map((q) => {
          const on = f.quick === q.value;
          const n = counts[q.value];
          return (
            <Chip
              key={q.value}
              active={on}
              onClick={() => setBoard({ quick: q.value })}
              className={cn(
                !on && n > 0 && q.tone === "crit" && "border-crit/40 text-crit",
                !on && n > 0 && q.tone === "warn" && "border-warn/40 text-warn",
              )}
            >
              {q.label}
              <span className={cn("tnum rounded-full px-1.5 text-[10px]", on ? "bg-brand/25" : "bg-white/10")}>{n}</span>
            </Chip>
          );
        })}
      </div>

      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <select
          className={select}
          aria-label="Filter by assignee"
          value={f.assignee}
          onChange={(e) => setBoard({ assignee: e.target.value })}
        >
          <option value="">Everyone</option>
          {people.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.title}
            </option>
          ))}
        </select>
        {wide && (
          <select
            className={select}
            aria-label="Filter by department"
            value={f.dept}
            onChange={(e) => setBoard({ dept: e.target.value })}
          >
            <option value="">All departments</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        {outlets.length > 0 && (
          <select
            className={select}
            aria-label="Filter by restaurant"
            value={f.restaurant}
            onChange={(e) => setBoard({ restaurant: e.target.value })}
          >
            <option value="">All restaurants</option>
            {outlets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
        <select
          className={select}
          aria-label="Filter by priority"
          value={f.priority}
          onChange={(e) => setBoard({ priority: e.target.value as Priority | "" })}
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <label className="glass flex h-10 min-w-[170px] flex-1 items-center gap-2 rounded-xl px-3.5 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-paper/45" />
          <input
            value={f.q}
            onChange={(e) => setBoard({ q: e.target.value })}
            placeholder="Search task or name"
            aria-label="Search tasks"
            className="w-full bg-transparent text-sm outline-none placeholder:text-paper/40"
          />
        </label>
        {filtered && (
          <Btn size="sm" variant="subtle" onClick={resetBoard}>
            <FilterX className="size-4" /> Clear filters
          </Btn>
        )}
        <p className="tnum ml-auto text-xs text-paper/50" aria-live="polite">
          {total} {total === 1 ? "task" : "tasks"}
          {f.assignee ? ` for ${i.userById.get(f.assignee)?.name ?? ""}` : ""}
        </p>
      </div>

      {total === 0 ? (
        <Empty title="No tasks match" hint="Nothing fits these filters. Clear them or pick another status." />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {PRIORITIES.map((p, n) => {
            const ids = lanes[n].filter((t) => t.status !== "completed").map((t) => t.id);
            return (
              <section key={p} aria-label={`${PRIORITY_LABEL[p]} priority`}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold tracking-wide uppercase">
                  <span className="size-2.5 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {PRIORITY_LABEL[p]}
                  <span className="tnum rounded-full bg-white/8 px-2 py-0.5 font-sans text-xs font-semibold text-paper/60">
                    {lanes[n].length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {lanes[n].map((t) => (
                    <TaskCard key={t.id} task={t} siblings={ids} />
                  ))}
                  {lanes[n].length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-paper/40">
                      No {PRIORITY_LABEL[p].toLowerCase()} tasks
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
