"use client";

import { ChevronDown, Eye, ListFilter, Plus, TriangleAlert, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActivityFeed, AttentionPanel } from "@/components/activity";
import { Avatar, Btn, EASE, Empty, Panel, PriorityBadge, Ring, StatusBadge } from "@/components/kit";
import { TaskCard, TrackedTime } from "@/components/task-card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { assignableDepartmentIds, canAssign, canViewDepartment, canViewUser } from "@/lib/permissions";
import {
  boardTasks,
  departmentNodes,
  employeeToday,
  HEALTH_COLOR,
  healthOf,
  idx,
  isOverdue,
  queueFor,
  restaurantSummary,
  sortTasks,
} from "@/lib/selectors";
import { switchProfile, useDb, useMe, useNow } from "@/lib/store";
import { fmtDue, fmtDuration } from "@/lib/time";
import type { Restaurant, User } from "@/lib/types";
import { openComposer, showOnBoard } from "@/lib/ui";
import { cn } from "@/lib/utils";

const STATUS_CHIP = {
  working: "bg-brand/15 text-brand",
  paused: "bg-warn/15 text-warn",
  idle: "bg-white/8 text-paper/55",
} as const;
const STATUS_TEXT = { working: "Working", paused: "Paused", idle: "No task running" } as const;

/** One person: what they are doing now, time today, and their queue. */
export function EmployeeCard({ user }: { user: User }) {
  const db = useDb();
  const me = useMe();
  const working = idx(db).openByEmployee.has(user.id);
  const now = useNow(working);
  const [open, setOpen] = useState(false);
  const today = employeeToday(db, user.id, now);
  const queue = useMemo(() => (open ? queueFor(db, user.id) : []), [open, db, user.id]);
  const mayAssign = user.department_id ? canAssign(db, me, user.id, user.department_id) : false;
  const focus = today.current ?? today.paused;
  const outlet = db.restaurants.find((r) => r.id === user.restaurant_id);

  if (!canViewUser(me, user)) return null;
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={cn("glass rounded-2xl p-4", working && "ring-1 ring-brand/40")}
    >
      <div className="flex items-center gap-3">
        <Avatar user={user} size={44} live={working} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs text-paper/55">
            {user.title}
            {outlet ? ` · ${outlet.name}` : ""}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase", STATUS_CHIP[today.status])}>
          {STATUS_TEXT[today.status]}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-paper/45 uppercase">Current task</p>
        {focus ? (
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium">{focus.title}</p>
            <TrackedTime task={focus} className={cn("shrink-0 text-sm", working ? "text-brand" : "text-warn")} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-paper/50">Nothing in progress</p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Time today", fmtDuration(today.tracked_seconds)],
          ["Done today", String(today.completed_today)],
          ["Remaining", String(today.remaining)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.03] py-2">
            <dd className="tnum font-display text-xl font-bold italic">{v}</dd>
            <dt className="text-[10px] tracking-wider text-paper/45 uppercase">{k}</dt>
          </div>
        ))}
      </dl>
      {today.overdue > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-crit">
          <TriangleAlert className="size-3.5" /> {today.overdue} overdue
        </p>
      )}

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        {mayAssign && (
          <Btn size="sm" variant="primary" onClick={() => openComposer({ department_id: user.department_id!, assigned_to: user.id })}>
            <Plus className="size-3.5" /> Assign task
          </Btn>
        )}
        <Btn size="sm" onClick={() => switchProfile(user.id)} title="Demo shortcut: open this person's own screen">
          <Eye className="size-3.5" /> See their screen
        </Btn>
        <Btn size="sm" variant="subtle" className="ml-auto" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Queue <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </Btn>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {queue.length === 0 && <li className="pt-3 text-xs text-paper/50">No open tasks.</li>}
            {queue.map((t, n) => (
              <li key={t.id} className={cn("flex items-center gap-2 py-2 text-sm", n === 0 ? "mt-3 border-t border-white/8 pt-3" : "border-t border-white/5")}>
                <span className="tnum w-4 shrink-0 text-xs text-paper/35">{n + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <PriorityBadge priority={t.priority} />
                <span className={cn("hidden shrink-0 text-xs sm:block", isOverdue(t, now) ? "font-semibold text-crit" : "text-paper/45")}>
                  {fmtDue(t.due_at, now)}
                </span>
                <span className="hidden sm:block">
                  <StatusBadge status={t.status} />
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/** A department in one workspace: numbers, people, attention, tasks. */
export function DepartmentView({ deptId, wide }: { deptId: string; wide?: boolean }) {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const dept = idx(db).deptById.get(deptId);
  const node = useMemo(() => departmentNodes(db, now).find((n) => n.id === deptId), [db, now, deptId]);
  const tasks = sortTasks(boardTasks(db, me, now).filter((t) => t.department_id === deptId));
  const scope = useMemo(() => [deptId], [deptId]);

  if (!dept || !node || !canViewDepartment(me, deptId)) {
    return <Empty title="No access" hint="Your role cannot open this department." />;
  }
  const manager = idx(db).userById.get(dept.manager_id);
  const people = db.users.filter((u) => u.department_id === deptId && u.active_status && u.role === "employee");
  // A department can contain restaurants; their waiters are shown under each one.
  const outlets = db.restaurants.filter((r) => r.department_id === deptId);
  const unplaced = people.filter((u) => !outlets.some((r) => r.id === u.restaurant_id));
  const open = tasks.filter((t) => t.status !== "completed");
  const done = tasks.filter((t) => t.status === "completed");
  const mayAssign = assignableDepartmentIds(db, me).includes(deptId);
  const idsFor = (p: string) => open.filter((t) => t.priority === p).map((t) => t.id);

  const tiles: [string, string, string?][] = [
    ["Employees", String(node.employees)],
    ["Active now", String(node.active), "text-brand"],
    ["Assigned today", String(node.assigned)],
    ["Completed", String(node.completed), "text-brand-soft"],
    ["Pending", String(node.pending)],
    ["Overdue", String(node.overdue), node.overdue ? "text-crit" : undefined],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Ring value={node.completion / 100} size={84} stroke={8}>
          <span className="tnum font-display text-xl font-bold italic">{Math.round(node.completion)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Department</p>
          <h2 className="display mt-1 text-3xl md:text-4xl">{dept.name}</h2>
          <p className="mt-1.5 text-sm text-paper/55">
            {dept.description} Managed by <span className="font-semibold text-paper/85">{manager?.name}</span>.
          </p>
        </div>
        {mayAssign && (
          <Btn variant="primary" size="lg" className="no-print" onClick={() => openComposer({ department_id: deptId })}>
            <Plus className="size-5" /> Assign Task
          </Btn>
        )}
      </div>

      <dl className={cn("grid grid-cols-3 gap-2.5", wide && "lg:grid-cols-6")}>
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="glass rounded-2xl p-3">
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-paper/50 uppercase">{k}</dt>
            <dd className={cn("tnum mt-1 font-display text-3xl font-bold italic", tone)}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-paper/45">
        Completion rate {Math.round(node.completion)}% of tasks due today · {fmtDuration(node.tracked_seconds)} active
        task time today.
      </p>

      <div className={cn("grid gap-5", wide && "xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
        <div className="space-y-5">
          {outlets.map((r) => (
            <RestaurantPanel key={r.id} restaurant={r} wide={wide} />
          ))}
          {unplaced.length > 0 && (
            <Panel title={outlets.length ? "Other team members" : "Team"} icon={<Users className="size-5" />}>
              <div className={cn("grid gap-3", wide && "md:grid-cols-2")}>
                {unplaced.map((u) => (
                  <EmployeeCard key={u.id} user={u} />
                ))}
              </div>
            </Panel>
          )}
          <Panel title={`Open tasks · ${open.length}`}>
            {open.length === 0 ? (
              <Empty title="Queue is clear" hint="Every task for this department is completed." />
            ) : (
              <div className={cn("grid items-start gap-3", wide && "md:grid-cols-2")}>
                {open.map((t) => (
                  <TaskCard key={t.id} task={t} siblings={idsFor(t.priority)} />
                ))}
              </div>
            )}
          </Panel>
          {done.length > 0 && (
            <Panel title={`Completed today · ${done.length}`}>
              <div className={cn("grid items-start gap-3", wide && "md:grid-cols-2")}>
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </Panel>
          )}
        </div>
        <div className="space-y-5">
          <Panel title="Needs attention" icon={<TriangleAlert className="size-5" />}>
            <AttentionPanel deptIds={scope} />
          </Panel>
          <Panel title="Department activity">
            <ActivityFeed limit={10} deptId={deptId} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** One restaurant inside its department: live numbers and its waiters. */
export function RestaurantPanel({ restaurant, wide }: { restaurant: Restaurant; wide?: boolean }) {
  const db = useDb();
  const now = useNow();
  const router = useRouter();
  const s = useMemo(() => restaurantSummary(db, restaurant.id, now), [db, restaurant.id, now]);
  const tiles: [string, number, string?][] = [
    ["Waiters", s.waiters.length],
    ["Working now", s.working, "text-brand"],
    ["Open tasks", s.open],
    ["Overdue", s.overdue, s.overdue ? "text-crit" : undefined],
    ["Over time allowed", s.over_time, s.over_time ? "text-warn" : undefined],
    ["Done today", s.completed_today, "text-brand-soft"],
  ];
  return (
    <section className="glass rounded-3xl p-4 md:p-5" aria-label={restaurant.name}>
      <div className="flex flex-wrap items-center gap-4">
        <Ring value={s.completion / 100} size={68} stroke={7} color={HEALTH_COLOR[healthOf(s)]}>
          <span className="tnum font-display text-base font-bold italic">{Math.round(s.completion)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Restaurant</p>
          <h3 className="display mt-1 text-2xl md:text-3xl">{restaurant.name}</h3>
          <p className="mt-1 text-sm text-paper/55">{restaurant.description}</p>
        </div>
        <Btn
          size="sm"
          className="no-print"
          onClick={() => {
            showOnBoard({ restaurant: restaurant.id });
            router.push("/tasks");
          }}
        >
          <ListFilter className="size-4" /> Its tasks
        </Btn>
      </div>

      <dl className={cn("mt-4 grid grid-cols-3 gap-2.5", wide && "lg:grid-cols-6")}>
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-paper/50 uppercase">{k}</dt>
            <dd className={cn("tnum mt-1 font-display text-3xl font-bold italic", tone)}>{v}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-5 mb-3 flex items-center gap-2 font-display text-base font-bold tracking-wide uppercase">
        <Users className="size-4 text-brand" /> Waiters
      </h4>
      <div className={cn("grid items-start gap-3", wide && "md:grid-cols-2")}>
        {s.waiters.map((u) => (
          <EmployeeCard key={u.id} user={u} />
        ))}
      </div>
    </section>
  );
}

/** Slide-over department panel used by the command center and the department list. */
export function DepartmentSheet({ deptId, onClose }: { deptId: string | null; onClose: () => void }) {
  return (
    <Sheet open={deptId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="glass-solid gap-0 overflow-y-auto border-l border-white/10 p-5 pt-12 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">Department details</SheetTitle>
        {deptId && <DepartmentView deptId={deptId} />}
      </SheetContent>
    </Sheet>
  );
}
