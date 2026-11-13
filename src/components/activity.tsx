"use client";

import {
  Activity,
  Check,
  ChevronRight,
  CircleCheck,
  FileText,
  Flag,
  Hourglass,
  Network,
  Pause,
  Play,
  Repeat,
  Send,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Btn, EASE, Empty } from "@/components/kit";
import { attentionItems, feed, type AttentionItem, type FeedEntry } from "@/lib/selectors";
import { useDb, useMe, useNow } from "@/lib/store";
import { fmtAgo } from "@/lib/time";
import type { ActivityAction } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_ICON: Partial<Record<ActivityAction, LucideIcon>> = {
  assigned: Send,
  started: Play,
  resumed: Play,
  paused: Pause,
  completed: Check,
  reassigned: Repeat,
  priority_changed: Flag,
  overdue: TriangleAlert,
  escalated: Flag,
  report_submitted: FileText,
};

const TONE: Record<FeedEntry["tone"], string> = {
  brand: "bg-brand/15 text-brand",
  warn: "bg-warn/15 text-warn",
  crit: "bg-crit/15 text-crit",
  info: "bg-med/15 text-med",
  muted: "bg-white/8 text-paper/60",
};

/** Live activity stream. New events slide in the moment an action happens. */
export function ActivityFeed({ limit = 14, deptId }: { limit?: number; deptId?: string }) {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const entries = useMemo(() => feed(db, me, limit, deptId), [db, me, limit, deptId]);

  if (entries.length === 0) return <Empty icon={<Activity className="size-6" />} title="No activity yet" />;
  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {entries.map((e) => {
          const Icon = ACTION_ICON[e.log.action] ?? Activity;
          return (
            <motion.li
              key={e.log.id}
              layout
              initial={{ opacity: 0, x: -18, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-3 rounded-xl px-1.5 py-2">
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", TONE[e.tone])}>
                  <Icon className="size-3.5" />
                </span>
                <p className="min-w-0 flex-1 text-sm leading-snug text-paper/70">
                  {e.actor && <span className="font-semibold text-paper">{e.actor.name} </span>}
                  {e.text}
                </p>
                <time className="tnum shrink-0 pt-0.5 text-[11px] text-paper/40">{fmtAgo(e.log.created_at, now)}</time>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

const KIND_ICON: Record<AttentionItem["kind"], LucideIcon> = {
  critical_overdue: TriangleAlert,
  unassigned: UserX,
  paused_long: Hourglass,
  unresolved: UserX,
  bottleneck: Network,
  escalated: Flag,
};

const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  critical_overdue: "Critical overdue",
  unassigned: "Unassigned",
  paused_long: "Paused too long",
  unresolved: "Unresolved work",
  bottleneck: "Bottleneck",
  escalated: "Escalated",
};

/** Rule-based list of what needs a manager. Each line says exactly why it is there. */
export function AttentionPanel({ deptIds, onDept }: { deptIds?: string[]; onDept?: (deptId: string) => void }) {
  const db = useDb();
  const now = useNow();
  const [all, setAll] = useState(false);
  const items = useMemo(() => attentionItems(db, now, deptIds), [db, now, deptIds]);

  if (items.length === 0) {
    return (
      <Empty
        icon={<CircleCheck className="size-6" />}
        title="All clear"
        hint="No overdue critical tasks, long pauses or unassigned urgent work."
      />
    );
  }
  const shown = all ? items : items.slice(0, 6);
  return (
    <div>
      <ul className="space-y-2">
        {shown.map((item) => {
          const Icon = KIND_ICON[item.kind];
          const crit = item.severity === "critical";
          const body = (
            <>
              <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", crit ? "bg-crit/15 text-crit" : "bg-warn/15 text-warn")}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-[10px] font-bold tracking-[0.16em] uppercase", crit ? "text-crit" : "text-warn")}>
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="block truncate text-sm font-semibold">{item.title}</span>
                <span className="block text-xs leading-snug text-paper/60">{item.detail}</span>
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {onDept && item.department_id ? (
                <button
                  type="button"
                  onClick={() => onDept(item.department_id!)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-left transition hover:border-white/25"
                >
                  {body}
                  <ChevronRight className="mt-2 size-4 shrink-0 text-paper/35" />
                </button>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > 6 && (
        <Btn size="sm" variant="subtle" className="mt-2" onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all ${items.length}`}
        </Btn>
      )}
    </div>
  );
}
