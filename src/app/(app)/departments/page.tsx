"use client";

import { TriangleAlert, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { DepartmentSheet } from "@/components/department";
import { Avatar, EASE, PageHeader, Ring } from "@/components/kit";
import { departmentNodes, HEALTH_COLOR, healthOf, idx } from "@/lib/selectors";
import { useDb, useNow } from "@/lib/store";

export default function DepartmentsPage() {
  const db = useDb();
  const now = useNow();
  const nodes = useMemo(() => departmentNodes(db, now), [db, now]);
  const [dept, setDept] = useState<string | null>(null);
  const i = idx(db);

  return (
    <>
      <PageHeader
        eyebrow="Departments"
        title="Eight teams, one venue"
        sub="Today's progress in each department. Open one to see its people, queue and activity."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {nodes.map((n, k) => {
          const d = i.deptById.get(n.id)!;
          const manager = i.userById.get(d.manager_id);
          return (
            <motion.button
              key={n.id}
              type="button"
              onClick={() => setDept(n.id)}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: k * 0.04, ease: EASE }}
              whileHover={{ y: -4 }}
              className="glass rounded-3xl p-5 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{n.short}</p>
                  <h2 className="display mt-1.5 text-2xl">{n.name}</h2>
                </div>
                <Ring value={n.completion / 100} size={64} stroke={6} color={HEALTH_COLOR[healthOf(n)]}>
                  <span className="tnum font-display text-base font-bold italic">{Math.round(n.completion)}%</span>
                </Ring>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-paper/55">{d.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Assigned", n.assigned],
                  ["Done", n.completed],
                  ["Pending", n.pending],
                ].map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-white/[0.035] py-2">
                    <dd className="tnum font-display text-xl font-bold italic">{v}</dd>
                    <dt className="text-[10px] tracking-wider text-paper/45 uppercase">{label}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-paper/65">
                  <Avatar user={manager} size={24} />
                  <span className="truncate">{manager?.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {n.active > 0 && (
                    <span className="flex items-center gap-1 text-brand">
                      <Zap className="size-3.5" /> {n.active}
                    </span>
                  )}
                  {n.overdue > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-crit">
                      <TriangleAlert className="size-3.5" /> {n.overdue}
                    </span>
                  )}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
      <DepartmentSheet deptId={dept} onClose={() => setDept(null)} />
    </>
  );
}
