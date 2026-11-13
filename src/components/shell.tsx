"use client";

import {
  Bell,
  Building2,
  ChartColumn,
  ListChecks,
  LogOut,
  Network,
  Radar,
  Rocket,
  RotateCcw,
  Send,
  Settings,
  Sun,
  Target,
  TrendingUp,
  User as UserIcon,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AttentionList } from "@/components/activity";
import { ArenaMark, Avatar, Btn, EASE, Loader, Logo } from "@/components/kit";
import { TaskComposer } from "@/components/task-composer";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { canAccessRoute, homeFor, isCompanyWide, navFor, type NavItem } from "@/lib/permissions";
import { notificationsFor, type AttentionItem } from "@/lib/selectors";
import { resetDemo, signOut, switchProfile, useApp, useDb, useMe, useNow } from "@/lib/store";
import { dateKey, fmtKeyLong, fmtTime } from "@/lib/time";
import type { User } from "@/lib/types";
import { closeDemo, openDemo, showOnBoard, useUi, type BoardQuick } from "@/lib/ui";
import { cn } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], LucideIcon> = {
  radar: Radar,
  tasks: ListChecks,
  rocket: Rocket,
  send: Send,
  network: Network,
  users: Users,
  reports: ChartColumn,
  settings: Settings,
  sun: Sun,
  target: Target,
  trend: TrendingUp,
  user: UserIcon,
  building: Building2,
};

const SHORT: Record<string, string> = {
  "Command Center": "Command",
  "All Tasks": "Tasks",
  "Task Deployment": "Deploy",
  "Assign Tasks": "Assign",
  "Team Activity": "Team",
  "My Department": "My Dept",
  Departments: "Depts",
  Employees: "Team",
  "My Progress": "Progress",
  "My Tasks": "Tasks",
};

/** Gate + chrome for every signed-in screen. Access is checked here centrally. */
export function AppShell({ children }: { children: ReactNode }) {
  const ready = useApp((s) => s.ready);
  const me = useApp((s) => (s.db && s.userId ? (s.db.users.find((u) => u.id === s.userId) ?? null) : null));
  const switching = useApp((s) => s.switchingTo !== null);
  const pathname = usePathname();
  const router = useRouter();
  const allowed = me ? canAccessRoute(me, pathname) : false;

  useEffect(() => {
    if (!ready || switching) return;
    if (!me) router.replace("/");
    else if (!allowed) router.replace(homeFor(me.role));
  }, [ready, me, allowed, switching, router]);

  if (!ready || !me || !allowed) return <Loader />;

  const items = navFor(me);
  return (
    <div className="min-h-dvh">
      <Dock items={items} pathname={pathname} me={me} />
      <TopBar me={me} />
      <main className="print-root mx-auto w-full max-w-[1560px] px-4 pt-20 pb-28 md:pr-8 md:pb-12 md:pl-[104px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {children}
        </motion.div>
      </main>
      <MobileDock items={items} pathname={pathname} />
      <DemoControls />
      <TaskComposer />
    </div>
  );
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

function Dock({ items, pathname, me }: { items: NavItem[]; pathname: string; me: User }) {
  const label =
    "relative whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/dock:opacity-100 group-focus-within/dock:opacity-100";
  return (
    <nav
      aria-label="Main"
      className="no-print group/dock glass fixed top-1/2 left-4 z-40 hidden w-[60px] -translate-y-1/2 flex-col gap-1 overflow-hidden rounded-[28px] p-2 transition-[width] duration-300 ease-out focus-within:w-60 hover:w-60 md:flex"
    >
      <Link href={homeFor(me.role)} className="mb-2 flex h-11 items-center gap-3 pl-0.5" aria-label="Arena OS home">
        <ArenaMark className="h-[18px] w-[44px] shrink-0 text-paper" />
        <span className={cn(label, "display text-base")}>
          Arena <span className="text-brand">OS</span>
        </span>
      </Link>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors",
              on ? "text-brand-soft" : "text-paper/60 hover:text-paper",
            )}
          >
            {on && (
              <motion.span
                layoutId="dock-active"
                className="absolute inset-0 rounded-2xl bg-brand/14 ring-1 ring-brand/40 ring-inset"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className="relative size-5 shrink-0" />
            <span className={label}>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openDemo}
        className="mt-2 flex h-11 items-center gap-3 rounded-2xl pl-1 text-left text-sm font-semibold text-paper/70 hover:text-paper"
      >
        <Avatar user={me} size={36} />
        <span className={label}>Switch profile</span>
      </button>
    </nav>
  );
}

function MobileDock({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="no-print glass-solid fixed inset-x-3 bottom-3 z-40 flex items-stretch rounded-3xl p-1.5 md:hidden"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const on = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold",
              on ? "text-brand-soft" : "text-paper/55",
            )}
          >
            {on && <motion.span layoutId="mobile-dock-active" className="absolute inset-0 rounded-2xl bg-brand/14" />}
            <Icon className="relative size-5" />
            <span className="relative truncate">{SHORT[item.label] ?? item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TopBar({ me }: { me: User }) {
  const now = useNow();
  return (
    <header className="no-print pointer-events-none fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 bg-gradient-to-b from-ink via-ink/85 to-transparent px-4 md:pr-8 md:pl-[104px]">
      <div className="pointer-events-auto flex min-w-0 items-center gap-3">
        <Logo className="md:hidden" />
        <p className="hidden text-sm text-paper/55 md:block">
          <span className="font-semibold text-paper/85">{fmtKeyLong(dateKey(now))}</span>
          <span className="tnum mx-2 text-paper/30">·</span>
          <span className="tnum">{fmtTime(now)} Beirut</span>
        </p>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <Alerts me={me} />
        <button
          type="button"
          onClick={openDemo}
          className="flex h-8 items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3 text-[11px] font-bold tracking-[0.14em] text-warn uppercase"
          title="This is a demonstration environment with fictional sample data"
        >
          <span className="size-1.5 rounded-full bg-warn" />
          Demo<span className="hidden lg:inline"> · sample data</span>
        </button>
        <button
          type="button"
          onClick={openDemo}
          className="glass flex items-center gap-2.5 rounded-full py-1 pr-1 pl-1 sm:pr-4"
          aria-label={`Signed in as ${me.name}, ${me.title}. Switch demo profile`}
        >
          <Avatar user={me} size={32} />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold">{me.name}</span>
            <span className="block text-[11px] text-paper/55">{me.title}</span>
          </span>
        </button>
      </div>
    </header>
  );
}

/** Demo-only profile switcher and reset. Not an authentication system. */
function DemoControls() {
  const open = useUi((s) => s.demoOpen);
  const db = useDb();
  const me = useMe();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  const groups = useMemo(() => {
    const exec = db.users.filter((u) => u.role === "owner" || u.role === "ceo" || u.role === "gm");
    return [
      { label: "Executive", users: exec },
      ...db.departments.map((d) => ({
        label: d.name,
        users: db.users.filter((u) => u.department_id === d.id).sort((a, b) => (a.role === "manager" ? -1 : b.role === "manager" ? 1 : 0)),
      })),
    ];
  }, [db.users, db.departments]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          closeDemo();
          setConfirm(false);
        }
      }}
    >
      <DialogContent className="glass-solid block max-h-[88dvh] overflow-x-hidden overflow-y-auto rounded-3xl p-0 sm:max-w-2xl">
        <div className="p-5 pb-3">
          <p className="eyebrow !text-warn">Demonstration environment</p>
          <DialogTitle className="display mt-1 text-3xl">Switch profile</DialogTitle>
          <DialogDescription className="mt-2 text-paper/60">
            Every person and task here is fictional sample data. Pick a profile to see the same data from another role.
            This switcher exists only for the demo and is not a sign-in system.
          </DialogDescription>
        </div>
        <div className="space-y-4 px-5 pb-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-paper/45 uppercase">{g.label}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {g.users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      closeDemo();
                      if (u.id !== me.id) switchProfile(u.id);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-2 text-left transition",
                      u.id === me.id
                        ? "border-brand/60 bg-brand/12"
                        : "border-white/8 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.07]",
                    )}
                  >
                    <Avatar user={u} size={34} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate text-sm font-semibold">{u.name}</span>
                      <span className="block truncate text-[11px] text-paper/55">
                        {u.id === me.id ? "Current profile" : u.title}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0b0f0d] p-4">
          {confirm ? (
            <>
              <p className="min-w-0 flex-1 text-sm text-paper/75">
                Reset everything to the original sample data? Changes made in this demo will be lost.
              </p>
              <Btn size="sm" onClick={() => setConfirm(false)}>
                Cancel
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => {
                  resetDemo();
                  setConfirm(false);
                  closeDemo();
                }}
              >
                Yes, reset demo
              </Btn>
            </>
          ) : (
            <>
              <Btn size="sm" variant="subtle" onClick={() => setConfirm(true)}>
                <RotateCcw className="size-4" /> Reset demo
              </Btn>
              <Btn
                size="sm"
                variant="subtle"
                onClick={() => {
                  closeDemo();
                  signOut();
                  router.push("/");
                }}
              >
                <LogOut className="size-4" /> Back to role selection
              </Btn>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Alert bell: tasks over their time allowed, overdue work and anything else waiting on this person. */
function Alerts({ me }: { me: User }) {
  const db = useDb();
  const now = useNow();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => notificationsFor(db, me, now), [db, me, now]);
  const critical = items.some((i) => i.severity === "critical");

  const go = (item: AttentionItem) => {
    setOpen(false);
    if (me.role === "employee") {
      router.push("/my-tasks");
      return;
    }
    const quick: BoardQuick =
      item.kind === "over_time"
        ? "over_time"
        : item.kind === "unassigned"
          ? "unassigned"
          : item.kind === "paused_long"
            ? "paused"
            : item.kind === "escalated"
              ? "open"
              : "overdue";
    showOnBoard({
      quick,
      dept: isCompanyWide(me) ? (item.department_id ?? "") : "",
      assignee: item.kind === "over_time" || item.kind === "unresolved" ? (item.user_id ?? "") : "",
    });
    router.push("/tasks");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass relative grid size-10 place-items-center rounded-full"
        aria-label={items.length === 1 ? "1 alert" : `${items.length} alerts`}
      >
        <Bell className="size-[18px]" />
        {items.length > 0 && (
          <span
            className={cn(
              "tnum absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-ink",
              critical ? "bg-crit" : "bg-warn",
            )}
          >
            {items.length}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-solid block max-h-[88dvh] overflow-x-hidden overflow-y-auto rounded-3xl p-5 sm:max-w-lg">
          <p className="eyebrow">Alerts</p>
          <DialogTitle className="display mt-1 text-3xl">
            {items.length === 0 ? "All clear" : items.length === 1 ? "1 alert" : `${items.length} alerts`}
          </DialogTitle>
          <DialogDescription className="mt-1.5 mb-4 text-paper/55">
            Tasks running past their time allowed, overdue work and other items that need attention. This list updates
            by itself.
          </DialogDescription>
          <AttentionList items={items} onItem={go} limit={8} />
        </DialogContent>
      </Dialog>
    </>
  );
}
