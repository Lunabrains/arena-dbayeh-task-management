"use client";

import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { ActivityFeed } from "@/components/activity";
import { EmployeeCard } from "@/components/department";
import { Chip, PageHeader, Panel } from "@/components/kit";
import { canViewUser, isCompanyWide } from "@/lib/permissions";
import { idx } from "@/lib/selectors";
import { useDb, useMe } from "@/lib/store";

export default function TeamPage() {
  const db = useDb();
  const me = useMe();
  const wide = isCompanyWide(me);
  const [dept, setDept] = useState("all");
  const working = idx(db).openByEmployee;

  const people = useMemo(
    () =>
      db.users
        .filter((u) => u.active_status && u.department_id && u.id !== me.id && canViewUser(me, u))
        .filter((u) => dept === "all" || u.department_id === dept)
        // People with a timer running first, then managers, then by department order.
        .sort((a, b) => Number(working.has(b.id)) - Number(working.has(a.id)) || Number(b.role === "manager") - Number(a.role === "manager")),
    [db.users, me, dept, working],
  );

  return (
    <>
      <PageHeader
        eyebrow={me.role === "gm" ? "Employees" : "Team Activity"}
        title="Who is doing what, right now"
        sub="Live status for each person. “See their screen” opens the demo as that person, so you can see exactly what they see."
      />
      {wide && (
        <div className="no-print mb-5 flex gap-1.5 overflow-x-auto pb-1">
          <Chip active={dept === "all"} onClick={() => setDept("all")}>
            Everyone
          </Chip>
          {db.departments.map((d) => (
            <Chip key={d.id} active={dept === d.id} onClick={() => setDept(d.id)}>
              {d.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid items-start gap-3 md:grid-cols-2">
          {people.map((u) => (
            <EmployeeCard key={u.id} user={u} />
          ))}
        </div>
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
          <ActivityFeed limit={16} deptId={dept === "all" ? undefined : dept} />
        </Panel>
      </div>
    </>
  );
}
