"use client";

import {
  Activity,
  CircleCheck,
  Clock,
  Gauge,
  ListChecks,
  Play,
  Radar,
  Rocket,
  TriangleAlert,
  Users,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActivityFeed, AttentionPanel } from "@/components/activity";
import { ArenaMap } from "@/components/arena-scene";
import { DepartmentSheet } from "@/components/department";
import { Btn, Chip, PageHeader, Panel, Stat } from "@/components/kit";
import { canCreateTasks } from "@/lib/permissions";
import { companyKpis, departmentNodes, HEALTH_COLOR, healthOf } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import { fmtDuration, greeting } from "@/lib/time";
import { openComposer, showOnBoard } from "@/lib/ui";
import { cn } from "@/lib/utils";

export default function CommandCenterPage() {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const k = useMemo(() => companyKpis(db, now), [db, now]);
  const nodes = useMemo(() => departmentNodes(db, now), [db, now]);
  const [dept, setDept] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <PageHeader
        eyebrow="Executive Command Center"
        title={
          <>
            {greeting(now)}, {me.name.split(" ")[0]}
          </>
        }
        sub="One live view of every department: who is working, what is done, and what needs you."
      >
        {canCreateTasks(me) && (
          <Btn variant="primary" size="lg" onClick={() => openComposer()}>
            <Rocket className="size-5" /> Deploy task
          </Btn>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total employees" value={k.employees} icon={<Users className="size-4" />} sub="across 8 departments" />
        <Stat label="Working now" value={k.working} tone="brand" icon={<Zap className="size-4" />} sub="with a task timer running" />
        <Stat label="Tasks assigned today" value={k.assigned} icon={<ListChecks className="size-4" />} sub="due today" />
        <Stat label="In progress" value={k.in_progress} tone="brand" icon={<Play className="size-4" />} sub="running right now" />
        <Stat label="Completed" value={k.completed} icon={<CircleCheck className="size-4" />} sub="of today's tasks" />
        <Stat
          label="Overdue"
          value={k.overdue}
          tone={k.overdue ? "crit" : "default"}
          icon={<TriangleAlert className="size-4" />}
          sub={k.overdue_earlier ? `${k.overdue_earlier} from earlier days · open the list` : "past deadline · open the list"}
          onClick={() => {
            showOnBoard({ quick: "overdue" });
            router.push("/tasks");
          }}
        />
        <Stat
          label="Completion rate"
          value={k.completion_rate}
          format={(n) => `${Math.round(n)}%`}
          icon={<Gauge className="size-4" />}
          sub="completed ÷ assigned today"
        />
        <Stat label="Tracked time" text={fmtDuration(k.tracked_seconds)} icon={<Clock className="size-4" />} sub="active task time today" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel
          title="Arena operations map"
          icon={<Radar className="size-5" />}
          right={
            <p className="hidden items-center gap-3 text-[11px] text-paper/50 sm:flex">
              {[
                ["#22c73f", "No overdue"],
                ["#ffc24b", "1-2 overdue"],
                ["#ff4d5e", "3+ overdue"],
              ].map(([c, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: c }} /> {l}
                </span>
              ))}
            </p>
          }
        >
          <ArenaMap nodes={nodes} selectedId={dept} onSelect={setDept} className="h-[380px] md:h-[440px]" />
          <p className="mt-2 text-xs text-paper/45">Select a department to open its tasks, people and performance. Node size shows today&rsquo;s workload, the arc shows completion, moving dots show people working.</p>
        </Panel>

        <Panel title="Needs attention" icon={<TriangleAlert className="size-5" />}>
          <AttentionPanel onDept={setDept} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Live activity"
          icon={<Activity className="size-5" />}
          right={
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-brand uppercase">
              <span className="live-dot size-1.5 rounded-full bg-brand" /> Live
            </span>
          }
        >
          <ActivityFeed limit={12} />
        </Panel>

        <Panel title="Departments today">
          <ul className="space-y-1.5">
            {nodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setDept(n.id)}
                  className={cn(
                    "w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5",
                    dept === n.id && "bg-white/6",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{n.name}</span>
                    <span className="tnum flex shrink-0 items-center gap-3 text-xs text-paper/55">
                      {n.active > 0 && <span className="text-brand">{n.active} working</span>}
                      {n.overdue > 0 && <span className="font-semibold text-crit">{n.overdue} overdue</span>}
                      <span>
                        {n.completed}/{n.assigned}
                      </span>
                      <span className="w-9 text-right font-semibold text-paper">{Math.round(n.completion)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${n.completion}%`, background: HEALTH_COLOR[healthOf(n)] }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="no-print mt-3 flex flex-wrap gap-1.5 border-t border-white/8 pt-3">
            {nodes.map((n) => (
              <Chip key={n.id} active={dept === n.id} onClick={() => setDept(n.id)}>
                {n.short}
              </Chip>
            ))}
          </div>
        </Panel>
      </div>

      <DepartmentSheet deptId={dept} onClose={() => setDept(null)} />
    </>
  );
}
