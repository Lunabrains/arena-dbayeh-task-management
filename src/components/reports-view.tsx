"use client";

// Reports: every figure is derived from tasks, time sessions and activity logs
// through the selectors. Submitted reports show their frozen snapshot.

import {
  Activity,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Clock,
  Download,
  FileText,
  Flag,
  Gauge,
  Hourglass,
  Info,
  ListChecks,
  Printer,
  Send,
  ShieldCheck,
  Siren,
  Timer,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Avatar, Btn, Chip, EASE, Empty, PageHeader, Panel, Ring, Segmented, Stat } from "@/components/kit";
import {
  DAILY_REPORT_HEADER,
  DEPARTMENT_HEADER,
  EMPLOYEE_HEADER,
  EXECUTIVE_REPORT_HEADER,
  dailyReportCsvRow,
  downloadCsv,
  employeeCsvRow,
  executiveReportCsvRow,
  rangeSlug,
  reportMeta,
  totalsCsvRow,
  type CsvRows,
} from "@/lib/export";
import {
  canSubmitDepartmentReport,
  canSubmitExecutiveReport,
  canViewDepartment,
  canViewReports,
  canViewUser,
  isCompanyWide,
} from "@/lib/permissions";
import {
  attentionItems,
  daysBetween,
  departmentSnapshot,
  departmentTotals,
  employeeRows,
  executiveSnapshot,
  idx,
  rangeFor,
  summarize,
  tasksForDay,
  tasksInRange,
  type AttentionItem,
  type Period,
} from "@/lib/selectors";
import { actions, useDb, useMe, useNow } from "@/lib/store";
import { addDays, dateKey, fmtDuration, fmtKey, fmtKeyLong, fmtKeyShort, fmtTime } from "@/lib/time";
import type {
  DailyReport,
  Database,
  Department,
  DepartmentSnapshot,
  DepartmentTotals,
  EmployeeReportRow,
  ExecutiveReport,
  Task,
  User,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "executive" | "departments" | "employees" | "submissions";
type ChartMode = "rate" | "volume";
type SortKey = "name" | "assigned" | "completed" | "pending" | "overdue" | "active_seconds" | "avg_seconds" | "completion_rate";
interface Sort {
  key: SortKey;
  dir: 1 | -1;
}

const TAB_TITLE: Record<Tab, string> = {
  executive: "Executive report",
  departments: "Department report",
  employees: "Employee report",
  submissions: "Report submissions",
};

const TICK = "rgba(244,246,243,0.55)";
const GRID = "rgba(255,255,255,0.06)";
// Today and yesterday can still be submitted; older days are read-only.
const SUBMIT_WINDOW_DAYS = 1;

const rateColor = (rate: number) => (rate >= 75 ? "#22c73f" : rate >= 45 ? "#ffc24b" : "#ff4d5e");
const pct = (n: number) => `${Math.round(n)}%`;

const PRINT_CSS = `@media print {
  .rv-chart text { fill: #333 !important; }
  .rv-chart .recharts-cartesian-grid line { stroke: #ddd !important; }
}`;

/** People whose performance the viewer may see in reports. */
function reportPeople(db: Database, me: User, deptId?: string | null): User[] {
  const wide = isCompanyWide(me);
  return db.users.filter(
    (u) =>
      u.active_status &&
      (u.role === "employee" || (u.role === "manager" && (wide || u.id === me.id))) &&
      canViewUser(me, u) &&
      (!deptId || u.department_id === deptId),
  );
}

interface TrendRow {
  date: string;
  label: string;
  assigned: number;
  completed: number;
  overdue: number;
  rate: number;
}

/** One point per business day, starting at the first day that has tasks. */
function trendPoints(db: Database, from: string, to: string, now: number, pred?: (t: Task) => boolean): TrendRow[] {
  const rows = daysBetween(from, to).map((date) => {
    const tasks = pred ? tasksForDay(db, date).filter(pred) : tasksForDay(db, date);
    const s = summarize(db, tasks, now);
    return {
      date,
      label: fmtKeyShort(date),
      assigned: s.assigned,
      completed: s.completed,
      overdue: s.overdue,
      rate: Math.round(s.completion_rate),
    };
  });
  const first = rows.findIndex((r) => r.assigned > 0);
  return first <= 0 ? rows : rows.slice(first);
}

// --- Screen ------------------------------------------------------------------

export function ReportsView() {
  const db = useDb();
  const me = useMe();
  const now = useNow();
  const today = dateKey(now);
  const wide = isCompanyWide(me);
  const i = idx(db);

  const [period, setPeriod] = useState<Period>("day");
  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [deptPick, setDeptPick] = useState<string | null>(null);
  const [empDept, setEmpDept] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("rate");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: 1 });

  const minDay = useMemo(() => {
    let m = today;
    for (const k of idx(db).byDay.keys()) if (k < m) m = k;
    return m;
  }, [db, today]);
  const anchor = !picked || picked > today ? today : picked < minDay ? minDay : picked;
  const { from, to } = useMemo(() => rangeFor(period, anchor), [period, anchor]);
  const awaiting = useMemo(() => db.daily_reports.filter((r) => r.status === "submitted").length, [db]);

  const tabs = useMemo<{ value: Tab; label: ReactNode }[]>(() => {
    if (!wide) {
      return [
        { value: "submissions", label: "Daily report" },
        { value: "departments", label: "My department" },
        { value: "employees", label: "My team" },
      ];
    }
    return [
      { value: "executive", label: "Executive" },
      { value: "departments", label: "Departments" },
      { value: "employees", label: "Employees" },
      {
        value: "submissions",
        label: (
          <span className="inline-flex items-center gap-1.5">
            Submissions
            {awaiting > 0 && (
              <span className="tnum rounded-full bg-crit px-1.5 text-[10px] leading-4 font-bold text-white">{awaiting}</span>
            )}
          </span>
        ),
      },
    ];
  }, [wide, awaiting]);
  const active: Tab = tab && tabs.some((t) => t.value === tab) ? tab : tabs[0].value;
  const deptId = wide
    ? deptPick && i.deptById.has(deptPick)
      ? deptPick
      : db.departments[0].id
    : (me.department_id ?? db.departments[0].id);

  if (!canViewReports(me)) {
    return (
      <Empty
        icon={<FileText className="size-6" />}
        title="Reports are for managers"
        hint="Your own numbers are on My Progress."
      />
    );
  }

  const rangeText =
    period === "day"
      ? anchor === today
        ? `Today, ${fmtKey(anchor)}`
        : fmtKey(anchor)
      : `${fmtKeyShort(from)} to ${fmtKeyShort(to)}`;

  function exportCsv() {
    const span = rangeSlug(from, to);
    const nameOf = (id: string) => i.userById.get(id)?.name ?? "";
    const deptOf = (userId: string) => i.deptById.get(i.userById.get(userId)?.department_id ?? "")?.name ?? "";
    let rows: CsvRows;
    let file: string;
    if (active === "executive") {
      rows = [
        ...reportMeta("Executive summary", from, to),
        DEPARTMENT_HEADER,
        ...db.departments.map((d) => totalsCsvRow(d.name, departmentTotals(db, d.id, from, to, now))),
        totalsCsvRow("Company total", summarize(db, tasksInRange(db, from, to), now)),
      ];
      file = `arena-os-executive-${span}`;
    } else if (active === "departments") {
      const snap = departmentSnapshot(db, deptId, from, to, now);
      rows = [
        ...reportMeta(`Department report: ${snap.department_name}`, from, to),
        DEPARTMENT_HEADER,
        totalsCsvRow(snap.department_name, snap),
        [],
        EMPLOYEE_HEADER,
        ...snap.employees.map((r) => employeeCsvRow(r, snap.department_name)),
        [],
        ["Tasks requiring follow-up", "Reason"],
        ...snap.follow_up.map((f) => [f.title, f.reason]),
      ];
      file = `arena-os-${deptId}-department-${span}`;
    } else if (active === "employees") {
      const people = reportPeople(db, me, wide ? empDept : null);
      rows = [
        ...reportMeta("Employee performance", from, to),
        EMPLOYEE_HEADER,
        ...employeeRows(db, people, from, to, now).map((r) => employeeCsvRow(r, deptOf(r.user_id))),
      ];
      file = `arena-os-employees-${span}`;
    } else {
      const inRange = (d: string) => d >= from && d <= to;
      const daily = db.daily_reports
        .filter((r) => inRange(r.report_date) && canViewDepartment(me, r.department_id))
        .sort((a, b) => (a.report_date < b.report_date ? 1 : a.report_date > b.report_date ? -1 : 0));
      rows = [
        ...reportMeta("Report submissions", from, to),
        DAILY_REPORT_HEADER,
        ...daily.map((r) => dailyReportCsvRow(r, nameOf(r.submitted_by))),
      ];
      if (wide) {
        rows.push(
          [],
          EXECUTIVE_REPORT_HEADER,
          ...db.executive_reports
            .filter((r) => inRange(r.report_date))
            .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))
            .map((r) => executiveReportCsvRow(r, nameOf(r.submitted_by))),
        );
      }
      file = `arena-os-submissions-${span}`;
    }
    downloadCsv(file, rows);
    toast.success("CSV exported.");
  }

  const stepClass =
    "grid size-8 place-items-center rounded-full text-paper/70 transition hover:bg-white/10 hover:text-paper disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      <PageHeader
        eyebrow={wide ? "Company reporting" : (i.deptById.get(deptId)?.name ?? "Department reporting")}
        title="Daily Reports"
        sub="Every figure is calculated live from tasks, timers and activity logs. Nothing is typed in by hand."
      >
        <Btn onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Btn>
        <Btn onClick={() => window.print()}>
          <Printer className="size-4" />
          Print / PDF
        </Btn>
      </PageHeader>

      <p className="mb-4 hidden text-sm print:block">
        {TAB_TITLE[active]} · {period === "day" ? fmtKeyLong(anchor) : `${fmtKeyLong(from)} to ${fmtKeyLong(to)}`} ·
        Asia/Beirut business dates · Demonstration data
      </p>

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented id="reports-tab" value={active} onChange={setTab} options={tabs} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            id="reports-period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
          <div className="glass flex items-center rounded-full p-1">
            <button
              type="button"
              aria-label="Previous day"
              disabled={anchor <= minDay}
              onClick={() => setPicked(addDays(anchor, -1))}
              className={stepClass}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="tnum min-w-36 px-2 text-center text-sm font-semibold" aria-live="polite">
              {rangeText}
            </span>
            <button
              type="button"
              aria-label="Next day"
              disabled={anchor >= today}
              onClick={() => setPicked(addDays(anchor, 1))}
              className={stepClass}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {anchor !== today && (
            <Btn size="sm" variant="subtle" onClick={() => setPicked(null)}>
              Back to today
            </Btn>
          )}
        </div>
      </div>

      <motion.div
        key={`${active}|${period}|${anchor}|${active === "departments" ? deptId : ""}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="space-y-4"
      >
        {active === "executive" && (
          <ExecutiveSection
            db={db}
            now={now}
            from={from}
            to={to}
            anchor={anchor}
            period={period}
            mode={chartMode}
            setMode={setChartMode}
            onOpenDepartment={(id) => {
              setDeptPick(id);
              setTab("departments");
            }}
            onOpenSubmissions={() => setTab("submissions")}
          />
        )}
        {active === "departments" && (
          <DepartmentsSection
            db={db}
            me={me}
            now={now}
            from={from}
            to={to}
            anchor={anchor}
            period={period}
            deptId={deptId}
            wide={wide}
            onPick={setDeptPick}
            onOpenSubmissions={() => setTab("submissions")}
          />
        )}
        {active === "employees" && (
          <EmployeesSection
            db={db}
            me={me}
            now={now}
            from={from}
            to={to}
            wide={wide}
            empDept={empDept}
            setEmpDept={setEmpDept}
            sort={sort}
            onSort={(key) =>
              setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }))
            }
          />
        )}
        {active === "submissions" &&
          (me.role === "manager" && me.department_id ? (
            <ManagerSubmissions db={db} me={me} now={now} anchor={anchor} today={today} deptId={me.department_id} />
          ) : (
            <CompanySubmissions db={db} me={me} now={now} anchor={anchor} today={today} />
          ))}
      </motion.div>

      <RulesNote />
    </div>
  );
}

// --- Executive ---------------------------------------------------------------

function ExecutiveSection({
  db,
  now,
  from,
  to,
  anchor,
  period,
  mode,
  setMode,
  onOpenDepartment,
  onOpenSubmissions,
}: {
  db: Database;
  now: number;
  from: string;
  to: string;
  anchor: string;
  period: Period;
  mode: ChartMode;
  setMode: (m: ChartMode) => void;
  onOpenDepartment: (id: string) => void;
  onOpenSubmissions: () => void;
}) {
  const reduce = useReducedMotion();
  const i = idx(db);
  const company = useMemo(() => summarize(db, tasksInRange(db, from, to), now), [db, from, to, now]);
  const totals = useMemo(
    () => db.departments.map((d) => departmentTotals(db, d.id, from, to, now)),
    [db, from, to, now],
  );
  const chart = useMemo(
    () =>
      totals.map((t) => ({
        id: t.department_id,
        name: i.deptById.get(t.department_id)?.short ?? t.department_name,
        full: t.department_name,
        rate: Math.round(t.completion_rate),
        completed: t.completed,
        pending: t.pending,
        overdue: t.overdue,
      })),
    [totals, i],
  );
  const ranked = useMemo(
    () => totals.filter((t) => t.assigned > 0).sort((a, b) => b.completion_rate - a.completion_rate),
    [totals],
  );
  const trend = useMemo(
    () => trendPoints(db, period === "day" ? addDays(anchor, -13) : from, to, now),
    [db, period, anchor, from, to, now],
  );
  const attention = useMemo(() => attentionItems(db, now), [db, now]);
  const criticalOverdue = attention.filter((a) => a.kind === "critical_overdue");
  const bottlenecks = attention.filter((a) => a.kind !== "critical_overdue");
  const submitted = useMemo(
    () => new Map(db.daily_reports.filter((r) => r.report_date === anchor).map((r) => [r.department_id, r])),
    [db, anchor],
  );
  const exec = db.executive_reports.find((r) => r.report_date === anchor);
  const pick = (d: unknown) => {
    const id = (d as { payload?: { id?: string } } | null)?.payload?.id;
    if (id) onOpenDepartment(id);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Assigned" value={company.assigned} icon={<ListChecks className="size-4" />} sub="tasks due in this period" />
        <Stat label="Completed" value={company.completed} tone="brand" icon={<CircleCheck className="size-4" />} />
        <Stat label="Pending" value={company.pending} icon={<Hourglass className="size-4" />} sub="open, not yet due" />
        <Stat
          label="Overdue"
          value={company.overdue}
          tone={company.overdue > 0 ? "crit" : "default"}
          icon={<TriangleAlert className="size-4" />}
          sub="open past the deadline"
        />
        <Stat
          label="Completion rate"
          value={company.completion_rate}
          format={pct}
          tone={company.completion_rate >= 75 ? "brand" : company.completion_rate >= 45 ? "warn" : "crit"}
          icon={<Gauge className="size-4" />}
        />
        <Stat
          label="Active task time"
          value={company.active_seconds}
          format={fmtDuration}
          icon={<Timer className="size-4" />}
          sub="timer time, not attendance"
        />
        <Stat
          label="Avg task duration"
          value={company.avg_seconds}
          format={fmtDuration}
          icon={<Clock className="size-4" />}
          sub="per completed task"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Department comparison"
          icon={<Building2 className="size-4" />}
          right={
            <Segmented
              id="reports-chart-mode"
              className="no-print"
              value={mode}
              onChange={setMode}
              options={[
                { value: "rate", label: "Completion" },
                { value: "volume", label: "Volume" },
              ]}
            />
          }
        >
          {company.assigned === 0 ? (
            <Empty icon={<Building2 className="size-6" />} title="No tasks in this period" hint="Pick another day or a longer period." />
          ) : (
            <>
              <Keys
                items={
                  mode === "rate"
                    ? [
                        ["75% and above", "#22c73f"],
                        ["45% to 74%", "#ffc24b"],
                        ["Below 45%", "#ff4d5e"],
                      ]
                    : [
                        ["Completed", "#22c73f"],
                        ["Pending", "#5aa9ff"],
                        ["Overdue", "#ff4d5e"],
                      ]
                }
              />
              <div className="rv-chart mt-3 h-[270px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} barCategoryGap="24%">
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis
                      tick={{ fill: TICK, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={46}
                      domain={mode === "rate" ? [0, 100] : [0, "auto"]}
                      tickFormatter={(v: number) => (mode === "rate" ? `${v}%` : String(v))}
                    />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<ChartTip suffix={{ rate: "%" }} />} />
                    {mode === "rate" ? (
                      <Bar
                        dataKey="rate"
                        name="Completion rate"
                        fill="#22c73f"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={44}
                        className="cursor-pointer"
                        isAnimationActive={!reduce}
                        onClick={pick}
                      >
                        {chart.map((d) => (
                          <Cell key={d.id} fill={rateColor(d.rate)} />
                        ))}
                      </Bar>
                    ) : (
                      <>
                        <Bar dataKey="completed" name="Completed" stackId="v" fill="#22c73f" maxBarSize={44} className="cursor-pointer" isAnimationActive={!reduce} onClick={pick} />
                        <Bar dataKey="pending" name="Pending" stackId="v" fill="#5aa9ff" maxBarSize={44} className="cursor-pointer" isAnimationActive={!reduce} onClick={pick} />
                        <Bar dataKey="overdue" name="Overdue" stackId="v" fill="#ff4d5e" radius={[8, 8, 0, 0]} maxBarSize={44} className="cursor-pointer" isAnimationActive={!reduce} onClick={pick} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {ranked.length > 1 && (
                <p className="mt-3 text-xs text-paper/60">
                  Leading: <b className="text-brand-soft">{ranked[0].department_name}</b> at {pct(ranked[0].completion_rate)}. Needs
                  support: <b className="text-paper">{ranked[ranked.length - 1].department_name}</b> at{" "}
                  {pct(ranked[ranked.length - 1].completion_rate)}. Select a bar to open that department.
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Daily performance trend"
          icon={<TrendingUp className="size-4" />}
          right={
            <Keys
              items={[
                ["Completion rate", "#22c73f"],
                ["Completed", "#5aa9ff"],
                ["Overdue", "#ff4d5e"],
              ]}
            />
          }
        >
          {trend.every((p) => p.assigned === 0) ? (
            <Empty icon={<TrendingUp className="size-6" />} title="No history yet" hint="The trend fills in as days are completed." />
          ) : (
            <>
              <TrendChart data={trend} />
              <p className="mt-3 text-xs text-paper/60">
                {period === "day" ? "The 14 days up to the selected day." : "Each day in the selected period."} A task counts
                on the business day of its deadline.
              </p>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Department breakdown" icon={<ListChecks className="size-4" />}>
        <DepartmentTable totals={totals} onPick={onOpenDepartment} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Operational bottlenecks"
          icon={<Activity className="size-4" />}
          right={<span className="text-xs text-paper/50">live, right now</span>}
        >
          <AttentionList items={bottlenecks} empty="No department is holding work up right now." />
        </Panel>
        <Panel
          title="Overdue critical tasks"
          icon={<Siren className="size-4" />}
          right={<span className="text-xs text-paper/50">live, right now</span>}
        >
          <AttentionList items={criticalOverdue} empty="No critical task is past its deadline." />
        </Panel>
      </div>

      <Panel
        title="Manager submissions"
        icon={<Send className="size-4" />}
        right={
          <span className="tnum text-sm font-semibold text-paper/70">
            {submitted.size}/{db.departments.length} submitted
          </span>
        }
      >
        <p className="mb-3 text-sm text-paper/55">Daily department reports for {fmtKeyLong(anchor)}.</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {db.departments.map((d) => {
            const r = submitted.get(d.id);
            return (
              <div
                key={d.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
                  r ? "border-brand/30 bg-brand/[0.07]" : "border-white/8 bg-white/[0.025]",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full",
                    r ? "bg-brand/20 text-brand" : "bg-white/8 text-paper/45",
                  )}
                >
                  {r ? <Check className="size-4" /> : <Clock className="size-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="text-xs text-paper/55">
                    {r ? `${r.status === "reviewed" ? "Reviewed" : "Submitted"} · ${fmtTime(r.submitted_at)}` : "Not submitted yet"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
          <p className="text-sm text-paper/75">
            {exec
              ? `Executive report submitted at ${fmtTime(exec.submitted_at)} by ${i.userById.get(exec.submitted_by)?.name ?? "the General Manager"}.`
              : "The consolidated executive report has not been submitted for this day."}
          </p>
          <Btn size="sm" className="no-print" onClick={onOpenSubmissions}>
            Open submissions
            <ChevronRight className="size-3.5" />
          </Btn>
        </div>
      </Panel>
    </>
  );
}

// --- Departments -------------------------------------------------------------

function DepartmentsSection({
  db,
  me,
  now,
  from,
  to,
  anchor,
  period,
  deptId,
  wide,
  onPick,
  onOpenSubmissions,
}: {
  db: Database;
  me: User;
  now: number;
  from: string;
  to: string;
  anchor: string;
  period: Period;
  deptId: string;
  wide: boolean;
  onPick: (id: string) => void;
  onOpenSubmissions: () => void;
}) {
  const i = idx(db);
  const snap = useMemo(() => departmentSnapshot(db, deptId, from, to, now), [db, deptId, from, to, now]);
  const trend = useMemo(
    () => trendPoints(db, period === "day" ? addDays(anchor, -13) : from, to, now, (t) => t.department_id === deptId),
    [db, period, anchor, from, to, now, deptId],
  );
  const dept = i.deptById.get(deptId);
  const manager = dept ? i.userById.get(dept.manager_id) : undefined;

  if (!canViewDepartment(me, deptId)) {
    return <Empty icon={<Building2 className="size-6" />} title="Not your department" hint="You can only open reports for your own department." />;
  }

  return (
    <>
      {wide && (
        <div className="no-print flex gap-2 overflow-x-auto pb-1">
          {db.departments.map((d) => (
            <Chip key={d.id} active={d.id === deptId} onClick={() => onPick(d.id)}>
              {d.name}
            </Chip>
          ))}
        </div>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <Ring value={snap.completion_rate / 100} size={112} stroke={9} color={rateColor(snap.completion_rate)}>
            <div className="text-center">
              <p className="tnum font-display text-3xl leading-none font-bold italic">{pct(snap.completion_rate)}</p>
              <p className="mt-1 text-[10px] tracking-[0.14em] text-paper/50 uppercase">Done</p>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Department report</p>
            <h2 className="display mt-1.5 text-3xl">{snap.department_name}</h2>
            {dept && <p className="mt-2 text-sm text-paper/60">{dept.description}</p>}
            {manager && (
              <p className="mt-2.5 flex items-center gap-2 text-sm text-paper/75">
                <Avatar user={manager} size={24} />
                {manager.name} · {manager.title}
              </p>
            )}
          </div>
          {canSubmitDepartmentReport(me, deptId) && (
            <Btn variant="primary" className="no-print" onClick={onOpenSubmissions}>
              <Send className="size-4" />
              Review and submit report
            </Btn>
          )}
        </div>
        <TotalsGrid t={snap} className="mt-5" />
      </Panel>

      <Panel title="Employee breakdown" icon={<Users className="size-4" />}>
        <EmployeeTable db={db} rows={snap.employees} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Daily performance"
          icon={<TrendingUp className="size-4" />}
          right={
            <Keys
              items={[
                ["Completion rate", "#22c73f"],
                ["Completed", "#5aa9ff"],
                ["Overdue", "#ff4d5e"],
              ]}
            />
          }
        >
          {trend.every((p) => p.assigned === 0) ? (
            <Empty icon={<TrendingUp className="size-6" />} title="No tasks in this period" />
          ) : (
            <TrendChart data={trend} height={240} />
          )}
        </Panel>
        <Panel title="Tasks requiring follow-up" icon={<Flag className="size-4" />}>
          <FollowUps items={snap.follow_up} />
        </Panel>
      </div>
    </>
  );
}

// --- Employees ---------------------------------------------------------------

function EmployeesSection({
  db,
  me,
  now,
  from,
  to,
  wide,
  empDept,
  setEmpDept,
  sort,
  onSort,
}: {
  db: Database;
  me: User;
  now: number;
  from: string;
  to: string;
  wide: boolean;
  empDept: string | null;
  setEmpDept: (id: string | null) => void;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const people = useMemo(() => reportPeople(db, me, wide ? empDept : null), [db, me, wide, empDept]);
  const rows = useMemo(() => employeeRows(db, people, from, to, now), [db, people, from, to, now]);
  const sum = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ assigned: a.assigned + r.assigned, completed: a.completed + r.completed, active: a.active + r.active_seconds }),
        { assigned: 0, completed: 0, active: 0 },
      ),
    [rows],
  );

  return (
    <>
      {wide && (
        <div className="no-print flex gap-2 overflow-x-auto pb-1">
          <Chip active={!empDept} onClick={() => setEmpDept(null)}>
            All departments
          </Chip>
          {db.departments.map((d) => (
            <Chip key={d.id} active={d.id === empDept} onClick={() => setEmpDept(d.id)}>
              {d.name}
            </Chip>
          ))}
        </div>
      )}
      <Panel
        title={wide ? "Employee performance" : "My team"}
        icon={<Users className="size-4" />}
        right={
          <span className="tnum text-xs text-paper/55">
            {rows.length} people · {sum.completed}/{sum.assigned} tasks completed · {fmtDuration(sum.active)} active
          </span>
        }
      >
        <EmployeeTable db={db} rows={rows} showDept={wide && !empDept} sort={sort} onSort={onSort} />
      </Panel>
    </>
  );
}

// --- Submissions: department manager -----------------------------------------

function ManagerSubmissions({
  db,
  me,
  now,
  anchor,
  today,
  deptId,
}: {
  db: Database;
  me: User;
  now: number;
  anchor: string;
  today: string;
  deptId: string;
}) {
  const live = useMemo(() => departmentSnapshot(db, deptId, anchor, anchor, now), [db, deptId, anchor, now]);
  const existing = db.daily_reports.find((r) => r.department_id === deptId && r.report_date === anchor) ?? null;
  const past = useMemo(
    () =>
      db.daily_reports
        .filter((r) => r.department_id === deptId && r.report_date !== anchor)
        .sort((a, b) => (a.report_date < b.report_date ? 1 : -1)),
    [db, deptId, anchor],
  );
  const [notes, setNotes] = useState(existing?.manager_notes ?? "");
  const [sent, setSent] = useState(false);
  const allowed = canSubmitDepartmentReport(me, deptId);
  const open = anchor >= addDays(today, -SUBMIT_WINDOW_DAYS);
  const frozen = existing?.generated_snapshot;
  const changed =
    !!frozen && (frozen.assigned !== live.assigned || frozen.completed !== live.completed || frozen.overdue !== live.overdue);

  return (
    <>
      <Panel
        title="Daily department report"
        icon={<FileText className="size-4" />}
        right={
          existing ? (
            <Pill tone="brand">
              <Check className="size-3" />
              {existing.status === "reviewed" ? "Reviewed by the GM" : `Submitted at ${fmtTime(existing.submitted_at)}`}
            </Pill>
          ) : (
            <Pill tone="warn">Not submitted yet</Pill>
          )
        }
      >
        <p className="text-sm text-paper/60">
          {fmtKeyLong(anchor)} · {live.department_name}. Generated automatically from your team&apos;s tasks and timers, so
          nobody has to write it up.
        </p>
        <div className="mt-4">
          <SnapshotView db={db} snap={live} />
        </div>

        {allowed &&
          (open ? (
            <div className="no-print mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
              <label htmlFor="manager-notes" className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">
                Manager notes (optional)
              </label>
              <textarea
                id="manager-notes"
                className="field mt-2 min-h-20 resize-y"
                value={notes}
                maxLength={600}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the General Manager should know about this day"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-xl text-xs text-paper/55">
                  {existing
                    ? changed
                      ? "The numbers have changed since you submitted. Resubmit to send the latest figures."
                      : "Already with the General Manager. You can resubmit if anything changes."
                    : "Submitting freezes these figures and sends them to the General Manager."}
                </p>
                <Btn
                  variant="primary"
                  onClick={() => {
                    if (actions.submitDailyReport(deptId, anchor, notes)) setSent(true);
                  }}
                >
                  <Send className="size-4" />
                  {existing ? "Resubmit report" : "Submit report"}
                </Btn>
              </div>
              <AnimatePresence>{sent && <SuccessNote text="Report sent to the General Manager." />}</AnimatePresence>
            </div>
          ) : (
            <p className="mt-4 text-xs text-paper/50">
              Reports can be submitted for today and yesterday. Earlier days are read-only.
            </p>
          ))}
        {existing?.manager_notes && <NotesBlock label="Notes sent with this report" text={existing.manager_notes} className="mt-3" />}
      </Panel>

      <Panel title="Past submissions" icon={<CalendarClock className="size-4" />}>
        {past.length === 0 ? (
          <Empty icon={<CalendarClock className="size-6" />} title="No earlier reports" hint="Submitted reports are kept here." />
        ) : (
          <div className="space-y-2">
            {past.slice(0, 14).map((r) => (
              <DailyReportCard key={r.id} db={db} report={r} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

// --- Submissions: General Manager, Owner, CEO --------------------------------

function CompanySubmissions({
  db,
  me,
  now,
  anchor,
  today,
}: {
  db: Database;
  me: User;
  now: number;
  anchor: string;
  today: string;
}) {
  const i = idx(db);
  const isGm = canSubmitExecutiveReport(me);
  const reports = useMemo(
    () => new Map(db.daily_reports.filter((r) => r.report_date === anchor).map((r) => [r.department_id, r])),
    [db, anchor],
  );
  const exec = db.executive_reports.find((r) => r.report_date === anchor) ?? null;
  const preview = useMemo(() => executiveSnapshot(db, anchor, now), [db, anchor, now]);
  const history = useMemo(
    () => [...db.executive_reports].sort((a, b) => (a.report_date < b.report_date ? 1 : -1)),
    [db],
  );
  const [notes, setNotes] = useState(exec?.executive_notes ?? "");
  const [sent, setSent] = useState(false);
  const open = anchor >= addDays(today, -SUBMIT_WINDOW_DAYS);

  const departmentReports = (
    <Panel
      title="Department reports"
      icon={<Building2 className="size-4" />}
      right={
        <span className="tnum text-sm font-semibold text-paper/70">
          {reports.size}/{db.departments.length} submitted
        </span>
      }
    >
      <p className="mb-3 text-sm text-paper/60">
        {fmtKeyLong(anchor)}.{" "}
        {isGm
          ? "Open a report to review the manager's figures and notes, then mark it reviewed."
          : "What each department manager submitted. Read-only."}
      </p>
      <div className="space-y-2">
        {db.departments.map((d) => {
          const r = reports.get(d.id);
          return r ? (
            <DailyReportCard key={d.id} db={db} report={r} canReview={isGm} />
          ) : (
            <MissingRow key={d.id} dept={d} manager={i.userById.get(d.manager_id)} />
          );
        })}
      </div>
    </Panel>
  );

  const executiveReports = (
    <Panel
      title={isGm ? "Executive reports sent" : "Executive reports"}
      icon={<FileText className="size-4" />}
      right={<span className="tnum text-xs text-paper/55">{history.length} on record</span>}
    >
      {!exec && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-warn/25 bg-warn/[0.07] px-3 py-2.5 text-sm text-warn">
          <Clock className="size-4 shrink-0" />
          {isGm
            ? `You have not sent the executive report for ${fmtKey(anchor)} yet.`
            : `The General Manager has not submitted the executive report for ${fmtKey(anchor)} yet.`}
        </p>
      )}
      {history.length === 0 ? (
        <Empty icon={<FileText className="size-6" />} title="No executive reports yet" />
      ) : (
        <div className="space-y-2">
          {history.slice(0, 15).map((r) => (
            <ExecutiveReportCard key={r.id} db={db} report={r} defaultOpen={r.report_date === anchor} />
          ))}
        </div>
      )}
    </Panel>
  );

  if (!isGm) {
    return (
      <>
        {executiveReports}
        {departmentReports}
      </>
    );
  }

  return (
    <>
      {departmentReports}

      <Panel
        title="Consolidated executive report"
        icon={<Send className="size-4" />}
        right={
          exec ? (
            <Pill tone="brand">
              <Check className="size-3" />
              Submitted at {fmtTime(exec.submitted_at)}
            </Pill>
          ) : (
            <Pill tone="warn">Not submitted yet</Pill>
          )
        }
      >
        <p className="text-sm text-paper/60">
          Combines every department report submitted for {fmtKey(anchor)} into one report for the Owner and CEO.
        </p>
        <TotalsGrid t={preview} className="mt-4" />
        {preview.missing_departments.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-xs text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>Not submitted yet: {preview.missing_departments.join(", ")}. They will be listed as missing in the report.</span>
          </p>
        )}
        {preview.overdue_critical.length > 0 && (
          <p className="mt-2 flex items-start gap-2 text-xs text-crit">
            <Siren className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {preview.overdue_critical.length} critical {preview.overdue_critical.length === 1 ? "task is" : "tasks are"} overdue:{" "}
              {preview.overdue_critical.map((t) => `${t.title} (${t.department_name})`).join("; ")}.
            </span>
          </p>
        )}

        {open ? (
          <div className="no-print mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-3.5">
            <label htmlFor="executive-notes" className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">
              Notes for the Owner and CEO (optional)
            </label>
            <textarea
              id="executive-notes"
              className="field mt-2 min-h-20 resize-y"
              value={notes}
              maxLength={800}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summary, risks and decisions needed"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-xs text-paper/55">
                {reports.size === 0
                  ? "Waiting for at least one department report before this can be sent."
                  : exec
                    ? "Already sent. Resubmit to include reports that arrived later."
                    : `${reports.size} department ${reports.size === 1 ? "report" : "reports"} will be included and marked reviewed.`}
              </p>
              <Btn
                variant="primary"
                disabled={reports.size === 0}
                onClick={() => {
                  if (actions.submitExecutiveReport(anchor, notes)) setSent(true);
                }}
              >
                <Send className="size-4" />
                {exec ? "Resubmit executive report" : "Submit consolidated executive report"}
              </Btn>
            </div>
            <AnimatePresence>{sent && <SuccessNote text="Executive report sent to the Owner and CEO." />}</AnimatePresence>
          </div>
        ) : (
          <p className="mt-4 text-xs text-paper/50">
            Executive reports can be submitted for today and yesterday. Earlier days are read-only.
          </p>
        )}
      </Panel>

      {executiveReports}
    </>
  );
}

// --- Report cards ------------------------------------------------------------

function DailyReportCard({
  db,
  report,
  canReview,
  defaultOpen,
}: {
  db: Database;
  report: DailyReport;
  canReview?: boolean;
  defaultOpen?: boolean;
}) {
  const snap = report.generated_snapshot;
  const by = idx(db).userById.get(report.submitted_by);
  return (
    <Expandable
      defaultOpen={defaultOpen}
      header={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Avatar user={by} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {snap.department_name}
              <span className="font-normal text-paper/50"> · {fmtKey(report.report_date)}</span>
            </span>
            <span className="block truncate text-xs text-paper/55">
              Submitted at {fmtTime(report.submitted_at)} by {by?.name ?? "the manager"} · {snap.completed}/{snap.assigned} tasks
            </span>
          </span>
          <span className="tnum text-sm font-bold" style={{ color: rateColor(snap.completion_rate) }}>
            {pct(snap.completion_rate)}
          </span>
          <Pill tone={report.status === "reviewed" ? "brand" : "warn"}>
            {report.status === "reviewed" ? "Reviewed" : "Awaiting review"}
          </Pill>
        </span>
      }
    >
      <p className="mb-3 text-xs text-paper/50">Figures frozen at the moment the report was submitted.</p>
      <SnapshotView db={db} snap={snap} />
      {report.manager_notes && <NotesBlock label="Manager notes" text={report.manager_notes} className="mt-3" />}
      {canReview && report.status === "submitted" && (
        <div className="no-print mt-3 flex justify-end">
          <Btn variant="primary" size="sm" onClick={() => actions.reviewDailyReport(report.id)}>
            <Check className="size-4" />
            Mark reviewed
          </Btn>
        </div>
      )}
    </Expandable>
  );
}

function ExecutiveReportCard({ db, report, defaultOpen }: { db: Database; report: ExecutiveReport; defaultOpen?: boolean }) {
  const snap = report.generated_snapshot;
  const by = idx(db).userById.get(report.submitted_by);
  return (
    <Expandable
      defaultOpen={defaultOpen}
      header={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Avatar user={by} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{fmtKeyLong(report.report_date)}</span>
            <span className="block truncate text-xs text-paper/55">
              Submitted at {fmtTime(report.submitted_at)} by {by?.name ?? "the General Manager"} ·{" "}
              {report.department_report_ids.length} department {report.department_report_ids.length === 1 ? "report" : "reports"}
            </span>
          </span>
          <span className="tnum text-sm font-bold" style={{ color: rateColor(snap.completion_rate) }}>
            {pct(snap.completion_rate)}
          </span>
        </span>
      }
    >
      <p className="mb-3 text-xs text-paper/50">Company figures frozen at the moment the report was submitted.</p>
      <TotalsGrid t={snap} />
      <div className="mt-4">
        <DepartmentTable totals={snap.departments} />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">Overdue critical tasks</p>
          {snap.overdue_critical.length === 0 ? (
            <p className="mt-2 text-sm text-paper/60">None at submission.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {snap.overdue_critical.map((t) => (
                <li key={t.task_id} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-crit" />
                  <span>
                    {t.title} <span className="text-paper/50">· {t.department_name}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">Departments not submitted</p>
          <p className="mt-2 text-sm text-paper/75">
            {snap.missing_departments.length === 0 ? "All departments reported." : snap.missing_departments.join(", ")}
          </p>
        </div>
      </div>
      {report.executive_notes && <NotesBlock label="General Manager's notes" text={report.executive_notes} className="mt-3" />}
    </Expandable>
  );
}

function MissingRow({ dept, manager }: { dept: Department; manager?: User }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 px-3.5 py-3">
      <Avatar user={manager} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{dept.name}</p>
        <p className="truncate text-xs text-paper/55">{manager ? `${manager.name} has not submitted yet` : "Not submitted yet"}</p>
      </div>
      <Pill tone="muted">
        <Clock className="size-3" />
        Missing
      </Pill>
    </div>
  );
}

// --- Shared pieces -----------------------------------------------------------

function SnapshotView({ db, snap }: { db: Database; snap: DepartmentSnapshot }) {
  return (
    <div className="space-y-4">
      <TotalsGrid t={snap} />
      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">Employee breakdown</p>
        <EmployeeTable db={db} rows={snap.employees} />
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">Tasks requiring follow-up</p>
        <FollowUps items={snap.follow_up} />
      </div>
    </div>
  );
}

function FollowUps({ items }: { items: DepartmentSnapshot["follow_up"] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5 text-sm text-paper/65">
        <ShieldCheck className="size-4 shrink-0 text-brand" />
        Nothing needs follow-up.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f.task_id} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warn" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{f.title}</p>
            <p className="text-xs text-paper/60">{f.reason}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  critical_overdue: "Critical overdue",
  unassigned: "Unassigned",
  paused_long: "Paused too long",
  unresolved: "Unresolved work",
  bottleneck: "Department bottleneck",
  escalated: "Escalated",
};

function AttentionList({ items, empty }: { items: AttentionItem[]; empty: string }) {
  if (items.length === 0) return <Empty icon={<ShieldCheck className="size-6" />} title="All clear" hint={empty} />;
  return (
    <>
      <ul className="space-y-2">
        {items.slice(0, 8).map((a) => (
          <li key={a.id} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.severity === "critical" ? "bg-crit" : "bg-warn")} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.title}</p>
              <p className="text-xs text-paper/60">
                <span className="font-semibold text-paper/75">{KIND_LABEL[a.kind]}.</span> {a.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {items.length > 8 && <p className="mt-2 text-xs text-paper/50">and {items.length - 8} more</p>}
    </>
  );
}

function Metric({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-paper/50 uppercase">{label}</p>
      <p className="tnum mt-1.5 font-display text-2xl leading-none font-bold italic" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}

function TotalsGrid({
  t,
  className,
}: {
  t: {
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
    completion_rate: number;
    active_seconds: number;
    avg_seconds?: number;
  };
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7", className)}>
      <Metric label="Assigned" value={t.assigned} />
      <Metric label="Completed" value={t.completed} color="#22c73f" />
      <Metric label="Pending" value={t.pending} />
      <Metric label="Overdue" value={t.overdue} color={t.overdue > 0 ? "#ff4d5e" : undefined} />
      <Metric label="Completion rate" value={pct(t.completion_rate)} color={t.assigned ? rateColor(t.completion_rate) : undefined} />
      <Metric label="Active task time" value={fmtDuration(t.active_seconds)} />
      {t.avg_seconds !== undefined && <Metric label="Avg task duration" value={fmtDuration(t.avg_seconds)} />}
    </div>
  );
}

function RateBar({ rate, muted }: { rate: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: muted ? "rgba(255,255,255,0.25)" : rateColor(rate) }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>
      <span className={cn("tnum w-10 text-right font-semibold", muted && "text-paper/45")}>{muted ? "n/a" : pct(rate)}</span>
    </div>
  );
}

const TH = "pb-2.5 text-[11px] font-semibold tracking-[0.12em] text-paper/50 uppercase";
const TD = "border-t border-white/[0.07] py-2.5 pr-3 align-middle";
const NUM = `${TD} tnum text-right`;

function EmployeeTable({
  db,
  rows,
  showDept,
  sort,
  onSort,
}: {
  db: Database;
  rows: EmployeeReportRow[];
  showDept?: boolean;
  sort?: Sort;
  onSort?: (key: SortKey) => void;
}) {
  const i = idx(db);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const d = typeof av === "string" || typeof bv === "string" ? String(av).localeCompare(String(bv)) : av - bv;
      return d * sort.dir;
    });
  }, [rows, sort]);

  if (rows.length === 0) return <Empty icon={<Users className="size-6" />} title="No one to show" hint="No team members match this view." />;

  const head = (key: SortKey, label: string, right = true) => (
    <th
      key={key}
      scope="col"
      aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      className={cn(TH, "pr-3", right ? "text-right" : "text-left")}
    >
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(key)}
          className="inline-flex items-center gap-1 tracking-[0.12em] uppercase transition hover:text-paper"
        >
          {label}
          {sort?.key === key && (sort.dir === 1 ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            {head("name", "Employee", false)}
            {showDept && (
              <th scope="col" className={cn(TH, "pr-3 text-left")}>
                Department
              </th>
            )}
            {head("assigned", "Assigned")}
            {head("completed", "Completed")}
            {head("pending", "Pending")}
            {head("overdue", "Overdue")}
            {head("active_seconds", "Active time")}
            {head("avg_seconds", "Avg time")}
            {head("completion_rate", "Completion")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const user = i.userById.get(r.user_id);
            return (
              <tr key={r.user_id}>
                <td className={TD}>
                  <div className="flex items-center gap-2.5">
                    <Avatar user={user} size={30} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-xs text-paper/50">{r.title}</p>
                    </div>
                  </div>
                </td>
                {showDept && <td className={cn(TD, "text-paper/70")}>{i.deptById.get(user?.department_id ?? "")?.name ?? ""}</td>}
                <td className={NUM}>{r.assigned}</td>
                <td className={NUM}>{r.completed}</td>
                <td className={NUM}>{r.pending}</td>
                <td className={cn(NUM, r.overdue > 0 && "font-semibold text-crit")}>{r.overdue}</td>
                <td className={NUM}>{fmtDuration(r.active_seconds)}</td>
                <td className={NUM}>{r.completed ? fmtDuration(r.avg_seconds) : "n/a"}</td>
                <td className={cn(TD, "pr-0")}>
                  <RateBar rate={r.completion_rate} muted={r.assigned === 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentTable({ totals, onPick }: { totals: DepartmentTotals[]; onPick?: (id: string) => void }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={cn(TH, "pr-3 text-left")}>Department</th>
            <th scope="col" className={cn(TH, "pr-3 text-right")}>Assigned</th>
            <th scope="col" className={cn(TH, "pr-3 text-right")}>Completed</th>
            <th scope="col" className={cn(TH, "pr-3 text-right")}>Pending</th>
            <th scope="col" className={cn(TH, "pr-3 text-right")}>Overdue</th>
            <th scope="col" className={cn(TH, "pr-3 text-right")}>Active time</th>
            <th scope="col" className={cn(TH, "text-right")}>Completion</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <tr key={t.department_id}>
              <td className={cn(TD, "font-semibold")}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(t.department_id)}
                    className="inline-flex items-center gap-1 text-left transition hover:text-brand-soft"
                  >
                    {t.department_name}
                    <ChevronRight className="no-print size-3.5 text-paper/40" />
                  </button>
                ) : (
                  t.department_name
                )}
              </td>
              <td className={NUM}>{t.assigned}</td>
              <td className={NUM}>{t.completed}</td>
              <td className={NUM}>{t.pending}</td>
              <td className={cn(NUM, t.overdue > 0 && "font-semibold text-crit")}>{t.overdue}</td>
              <td className={NUM}>{fmtDuration(t.active_seconds)}</td>
              <td className={cn(TD, "pr-0")}>
                <RateBar rate={t.completion_rate} muted={t.assigned === 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Expandable({ header, children, defaultOpen = false }: { header: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.04]"
      >
        <span className="min-w-0 flex-1">{header}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="no-print shrink-0 text-paper/50">
          <ChevronDown className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 p-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Pill({ tone, children }: { tone: "brand" | "warn" | "muted"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase",
        tone === "brand" && "bg-brand/15 text-brand-soft ring-1 ring-brand/35 ring-inset",
        tone === "warn" && "bg-warn/12 text-warn ring-1 ring-warn/35 ring-inset",
        tone === "muted" && "bg-white/6 text-paper/55 ring-1 ring-white/12 ring-inset",
      )}
    >
      {children}
    </span>
  );
}

function NotesBlock({ label, text, className }: { label: string; text: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border-l-2 border-brand/60 bg-white/[0.03] px-3 py-2.5", className)}>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-paper/55 uppercase">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap text-paper/85">{text}</p>
    </div>
  );
}

function SuccessNote({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      role="status"
      className="mt-3 flex items-center gap-2.5 rounded-xl border border-brand/35 bg-brand/10 px-3 py-2.5 text-sm font-semibold text-brand-soft"
    >
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.1 }}
        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-ink"
      >
        <Check className="size-4" strokeWidth={3} />
      </motion.span>
      {text}
    </motion.div>
  );
}

function Keys({ items }: { items: [label: string, color: string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-paper/60">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// --- Charts ------------------------------------------------------------------

interface TipEntry {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
}

/** Dark tooltip shared by every chart. Recharts injects active/payload/label. */
function ChartTip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: readonly TipEntry[];
  label?: string | number;
  suffix?: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const full = payload[0]?.payload?.full;
  return (
    <div className="glass-solid rounded-xl px-3 py-2 text-xs">
      <p className="mb-1 font-semibold text-paper">{typeof full === "string" ? full : label}</p>
      {payload.map((p, n) => (
        <p key={n} className="flex items-center gap-2 text-paper/70">
          <span className="size-2 rounded-full" style={{ background: p.color ?? "#22c73f" }} />
          <span>{p.name}</span>
          <span className="tnum ml-auto pl-4 font-semibold text-paper">
            {String(p.value ?? "")}
            {suffix?.[String(p.dataKey)] ?? ""}
          </span>
        </p>
      ))}
    </div>
  );
}

function TrendChart({ data, height = 270 }: { data: TrendRow[]; height?: number }) {
  const gid = useId();
  const reduce = useReducedMotion();
  return (
    <div className="rv-chart min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 0, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={`${gid}rate`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c73f" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#22c73f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} />
          <YAxis
            yAxisId="rate"
            domain={[0, 100]}
            tick={{ fill: TICK, fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
            axisLine={false}
            tickLine={false}
            width={46}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            allowDecimals={false}
            tick={{ fill: TICK, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip cursor={{ stroke: "rgba(255,255,255,0.16)" }} content={<ChartTip suffix={{ rate: "%" }} />} />
          <Bar yAxisId="count" dataKey="completed" name="Completed" fill="rgba(90,169,255,0.5)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={!reduce} />
          <Bar yAxisId="count" dataKey="overdue" name="Overdue" fill="rgba(255,77,94,0.8)" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={!reduce} />
          <Area
            yAxisId="rate"
            type="monotone"
            dataKey="rate"
            name="Completion rate"
            stroke="#22c73f"
            strokeWidth={2.5}
            fill={`url(#${gid}rate)`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={!reduce}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Rules -------------------------------------------------------------------

function RulesNote() {
  return (
    <Panel className="mt-4" title="How these numbers are calculated" icon={<Info className="size-4" />}>
      <ul className="grid gap-x-8 gap-y-2 text-sm text-paper/65 md:grid-cols-2">
        <li>
          <b className="text-paper/90">Completion rate</b> = completed tasks ÷ assigned tasks × 100.
        </li>
        <li>
          <b className="text-paper/90">Average task duration</b> = total duration of completed tasks ÷ number of completed tasks.
        </li>
        <li>A task belongs to the business day of its deadline, in Asia/Beirut time.</li>
        <li>
          <b className="text-paper/90">Active task time</b> is time with a task timer running. It is not attendance and not total
          working hours.
        </li>
        <li>Pending means open and not yet due. Overdue means still open after the deadline.</li>
        <li>A submitted report keeps a frozen copy of its figures from the moment it was sent.</li>
      </ul>
    </Panel>
  );
}
