"use client";

import { ListFilter, Rocket, Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EmployeeCard } from "@/components/department";
import { Avatar, Btn, Empty, PageHeader, Ring } from "@/components/kit";
import { TaskCard } from "@/components/task-card";
import { assignableDepartmentIds, canViewRestaurants, RESTAURANT_DEPT } from "@/lib/permissions";
import { HEALTH_COLOR, healthOf, idx, restaurantSummary } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import type { Restaurant } from "@/lib/types";
import { openComposer, showOnBoard } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Each restaurant with its waiters: who is working, what is waiting, what is late. */
export default function RestaurantsPage() {
  const db = useDb();
  const me = useMe();
  const dept = idx(db).deptById.get(RESTAURANT_DEPT);
  const manager = dept ? idx(db).userById.get(dept.manager_id) : undefined;
  const outlets = db.restaurants.filter((r) => r.department_id === RESTAURANT_DEPT);
  const mayAssign = assignableDepartmentIds(db, me).includes(RESTAURANT_DEPT);

  if (!canViewRestaurants(me)) return <Empty title="No access" hint="Your role cannot open the restaurants." />;
  return (
    <>
      <PageHeader
        eyebrow="Restaurants"
        title="Restaurants & waiters"
        sub="Every restaurant with its waiters: who is serving now, what is waiting and what is running late. Assign a task to any waiter from here."
      >
        {mayAssign && (
          <Btn variant="primary" size="lg" onClick={() => openComposer({ department_id: RESTAURANT_DEPT })}>
            <Rocket className="size-5" /> Assign to a waiter
          </Btn>
        )}
      </PageHeader>

      {manager && (
        <p className="mb-5 flex items-center gap-2.5 text-sm text-paper/60">
          <Avatar user={manager} size={28} />
          <span>
            Managed by <span className="font-semibold text-paper/90">{manager.name}</span>, {manager.title}
          </span>
        </p>
      )}

      {outlets.length === 0 ? (
        <Empty icon={<Utensils className="size-6" />} title="No restaurants yet" />
      ) : (
        <div className="space-y-5">
          {outlets.map((r) => (
            <RestaurantPanel key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </>
  );
}

function RestaurantPanel({ restaurant }: { restaurant: Restaurant }) {
  const db = useDb();
  const now = useNow();
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const s = useMemo(() => restaurantSummary(db, restaurant.id, now), [db, restaurant.id, now]);
  const open = s.tasks.filter((t) => t.status !== "completed");
  const shown = showAll ? open : open.slice(0, 4);
  const idsFor = (p: string) => open.filter((t) => t.priority === p).map((t) => t.id);

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
        <Ring value={s.completion / 100} size={76} stroke={7} color={HEALTH_COLOR[healthOf(s)]}>
          <span className="tnum font-display text-lg font-bold italic">{Math.round(s.completion)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Restaurant</p>
          <h2 className="display mt-1 text-3xl">{restaurant.name}</h2>
          <p className="mt-1.5 text-sm text-paper/55">{restaurant.description}</p>
        </div>
        <Btn
          size="sm"
          className="no-print"
          onClick={() => {
            showOnBoard({ restaurant: restaurant.id });
            router.push("/tasks");
          }}
        >
          <ListFilter className="size-4" /> Filter on task board
        </Btn>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2.5 lg:grid-cols-6">
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <dt className="text-[10px] font-semibold tracking-[0.14em] text-paper/50 uppercase">{k}</dt>
            <dd className={cn("tnum mt-1 font-display text-3xl font-bold italic", tone)}>{v}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 mb-3 font-display text-lg font-bold tracking-wide uppercase">Waiters</h3>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {s.waiters.map((u) => (
          <EmployeeCard key={u.id} user={u} />
        ))}
      </div>

      <h3 className="mt-5 mb-3 font-display text-lg font-bold tracking-wide uppercase">Open tasks · {open.length}</h3>
      {open.length === 0 ? (
        <Empty title="Nothing waiting" hint="Every task for this restaurant is completed." />
      ) : (
        <>
          <div className="grid items-start gap-3 md:grid-cols-2">
            {shown.map((t) => (
              <TaskCard key={t.id} task={t} siblings={idsFor(t.priority)} />
            ))}
          </div>
          {open.length > 4 && (
            <Btn size="sm" variant="subtle" className="no-print mt-3" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${open.length}`}
            </Btn>
          )}
        </>
      )}
    </section>
  );
}
