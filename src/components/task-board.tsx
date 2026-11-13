"use client";

import { Search } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { Chip, Empty, Segmented } from "@/components/kit";
import { TaskCard } from "@/components/task-card";
import { isCompanyWide } from "@/lib/permissions";
import { boardTasks, idx, sortTasks } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import { PRIORITIES, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/types";

type View = "open" | "done" | "all";

/** Priority lanes: Critical, High, Medium, Low. Always sorted, never a table. */
export function TaskBoard() {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const [view, setView] = useState<View>("open");
  const [dept, setDept] = useState("all");
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState("");
  const wide = isCompanyWide(me);

  const all = useMemo(() => boardTasks(db, me, now), [db, me, now]);
  const lanes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const i = idx(db);
    const shown = all.filter((t) => {
      if (view === "open" && t.status === "completed") return false;
      if (view === "done" && t.status !== "completed") return false;
      if (dept !== "all" && t.department_id !== dept) return false;
      if (mine && t.assigned_to !== me.id) return false;
      if (!needle) return true;
      const who = t.assigned_to ? (i.userById.get(t.assigned_to)?.name ?? "") : "unassigned";
      return `${t.title} ${who} ${t.category ?? ""}`.toLowerCase().includes(needle);
    });
    return PRIORITIES.map((p) => sortTasks(shown.filter((t) => t.priority === p)));
  }, [all, db, view, dept, mine, q, me.id]);

  const total = lanes.reduce((n, l) => n + l.length, 0);
  const hasMine = all.some((t) => t.assigned_to === me.id);

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2.5">
        <Segmented
          id="board-view"
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Completed today" },
            { value: "all", label: "All" },
          ]}
        />
        <label className="glass flex h-10 min-w-[180px] flex-1 items-center gap-2 rounded-full px-3.5 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-paper/45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search task or person"
            aria-label="Search tasks"
            className="w-full bg-transparent text-sm outline-none placeholder:text-paper/40"
          />
        </label>
        {hasMine && (
          <Chip active={mine} onClick={() => setMine((m) => !m)}>
            Assigned to me
          </Chip>
        )}
        <p className="tnum ml-auto text-xs text-paper/50">{total} tasks</p>
      </div>
      {wide && (
        <div className="no-print mb-5 flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={dept === "all"} onClick={() => setDept("all")}>
            All departments
          </Chip>
          {db.departments.map((d) => (
            <Chip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)}>
              {d.name}
            </Chip>
          ))}
        </div>
      )}

      {total === 0 ? (
        <Empty title="No tasks here" hint="Nothing matches these filters. Try another view or clear the search." />
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
                  <AnimatePresence initial={false}>
                    {lanes[n].map((t) => (
                      <TaskCard key={t.id} task={t} siblings={ids} />
                    ))}
                  </AnimatePresence>
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
