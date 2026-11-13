"use client";

import { Activity, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity";
import { EmployeeCard } from "@/components/department";
import { Chip, Empty, PageHeader, Panel } from "@/components/kit";
import { canViewUser, isCompanyWide } from "@/lib/permissions";
import { employeeToday } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import { cn } from "@/lib/utils";

type Status = "all" | "working" | "paused" | "idle" | "overdue";
const STATUSES: [Status, string][] = [
  ["all", "Everyone"],
  ["working", "Working now"],
  ["paused", "Paused"],
  ["idle", "No task running"],
  ["overdue", "Has overdue tasks"],
];

export default function TeamPage() {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const wide = isCompanyWide(me);
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      db.users
        .filter((u) => u.active_status && u.department_id && u.id !== me.id && canViewUser(me, u))
        .map((u) => ({ user: u, today: employeeToday(db, u.id, now) })),
    [db, me, now],
  );

  const { shown, counts } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = rows.filter(
      (r) =>
        (!dept || r.user.department_id === dept) &&
        (!needle || `${r.user.name} ${r.user.title}`.toLowerCase().includes(needle)),
    );
    const is = (s: Status, r: (typeof rows)[number]) =>
      s === "all" || (s === "overdue" ? r.today.overdue > 0 : r.today.status === s);
    const counts = Object.fromEntries(STATUSES.map(([s]) => [s, base.filter((r) => is(s, r)).length])) as Record<Status, number>;
    const order = { working: 0, paused: 1, idle: 2 };
    const shown = base
      .filter((r) => is(status, r))
      .sort((a, b) => order[a.today.status] - order[b.today.status] || Number(b.user.role === "manager") - Number(a.user.role === "manager"));
    return { shown, counts };
  }, [rows, dept, status, q]);

  return (
    <>
      <PageHeader
        eyebrow={me.role === "gm" ? "Employees" : "Team Activity"}
        title="Who is doing what, right now"
        sub="Live status for each person. “See their screen” opens the demo as that person, so you can see exactly what they see."
      />

      <div className="no-print mb-3 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {STATUSES.map(([s, label]) => (
          <Chip
            key={s}
            active={status === s}
            onClick={() => setStatus(s)}
            className={cn(status !== s && s === "overdue" && counts.overdue > 0 && "border-crit/40 text-crit")}
          >
            {label}
            <span className={cn("tnum rounded-full px-1.5 text-[10px]", status === s ? "bg-brand/25" : "bg-white/10")}>
              {counts[s]}
            </span>
          </Chip>
        ))}
      </div>
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        {wide && (
          <select
            className="field h-10 w-auto min-w-[170px] flex-1 py-0 sm:flex-none"
            aria-label="Filter by department"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option value="">All departments</option>
            {db.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
        <label className="glass flex h-10 min-w-[170px] flex-1 items-center gap-2 rounded-xl px-3.5 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-paper/45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or role"
            aria-label="Search people"
            className="w-full bg-transparent text-sm outline-none placeholder:text-paper/40"
          />
        </label>
        <p className="tnum ml-auto text-xs text-paper/50" aria-live="polite">
          {shown.length} {shown.length === 1 ? "person" : "people"}
        </p>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {shown.length === 0 ? (
          <Empty title="No one matches" hint="Try another status or clear the search." />
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2">
            {shown.map((r) => (
              <EmployeeCard key={r.user.id} user={r.user} />
            ))}
          </div>
        )}
        <Panel
          title="Live activity"
          icon={<Activity className="size-5" />}
          className="xl:sticky xl:top-20"
          right={
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-brand uppercase">
              <span className="live-dot size-1.5 rounded-full bg-brand" /> Live
            </span>
          }
        >
          <ActivityFeed limit={16} deptId={dept || undefined} />
        </Panel>
      </div>
    </>
  );
}
