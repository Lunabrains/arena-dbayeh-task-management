// CSV export for the Reports screen. Everything here is plain data shaping;
// the numbers come from the selectors.

import { dateKey, fmtTime } from "./time";
import type { DailyReport, DepartmentTotals, EmployeeReportRow, ExecutiveReport } from "./types";

export type CsvCell = string | number | null | undefined;
export type CsvRows = CsvCell[][];

function cell(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  // Text that starts like a formula is neutralised so spreadsheets show it as text.
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: CsvRows): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Downloads `rows` as a UTF-8 CSV that opens cleanly in Excel, Numbers and Sheets. */
export function downloadCsv(filename: string, rows: CsvRows): void {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const toMinutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10;
export const toPercent = (rate: number) => Math.round(rate * 10) / 10;

/** "2026-11-13" or "2026-11-07_to_2026-11-13" for file names. */
export const rangeSlug = (from: string, to: string) => (from === to ? from : `${from}_to_${to}`);

/** Context lines placed above the table so an exported file explains itself. */
export function reportMeta(title: string, from: string, to: string): CsvRows {
  return [
    ["Arena OS report", title],
    ["Period", from === to ? from : `${from} to ${to}`],
    ["Time zone", "Asia/Beirut"],
    ["Note", "Demonstration data. Active task time is time with a timer running, not attendance or total working hours."],
    [],
  ];
}

export const EMPLOYEE_HEADER: CsvCell[] = [
  "Employee",
  "Role",
  "Department",
  "Assigned",
  "Completed",
  "Pending",
  "Overdue",
  "Delayed",
  "Active task time (min)",
  "Average task duration (min)",
  "Completion rate (%)",
];

export function employeeCsvRow(r: EmployeeReportRow, department = ""): CsvCell[] {
  return [
    r.name,
    r.title,
    department,
    r.assigned,
    r.completed,
    r.pending,
    r.overdue,
    r.delayed,
    toMinutes(r.active_seconds),
    toMinutes(r.avg_seconds),
    toPercent(r.completion_rate),
  ];
}

export const DEPARTMENT_HEADER: CsvCell[] = [
  "Department",
  "Assigned",
  "Completed",
  "Pending",
  "Overdue",
  "Delayed",
  "Completion rate (%)",
  "Active task time (min)",
  "Average task duration (min)",
];

type Totals = Pick<
  DepartmentTotals,
  "assigned" | "completed" | "pending" | "overdue" | "delayed" | "completion_rate" | "active_seconds" | "avg_seconds"
>;

export function totalsCsvRow(name: string, t: Totals): CsvCell[] {
  return [
    name,
    t.assigned,
    t.completed,
    t.pending,
    t.overdue,
    t.delayed,
    toPercent(t.completion_rate),
    toMinutes(t.active_seconds),
    toMinutes(t.avg_seconds),
  ];
}

const stamp = (iso: string) => `${dateKey(iso)} ${fmtTime(iso)}`;

export const DAILY_REPORT_HEADER: CsvCell[] = [
  "Report date",
  "Department",
  "Status",
  "Submitted at (Beirut)",
  "Submitted by",
  "Assigned",
  "Completed",
  "Pending",
  "Overdue",
  "Completion rate (%)",
  "Active task time (min)",
  "Manager notes",
];

export function dailyReportCsvRow(r: DailyReport, submittedBy: string): CsvCell[] {
  const s = r.generated_snapshot;
  return [
    r.report_date,
    s.department_name,
    r.status === "reviewed" ? "Reviewed" : "Submitted",
    stamp(r.submitted_at),
    submittedBy,
    s.assigned,
    s.completed,
    s.pending,
    s.overdue,
    toPercent(s.completion_rate),
    toMinutes(s.active_seconds),
    r.manager_notes,
  ];
}

export const EXECUTIVE_REPORT_HEADER: CsvCell[] = [
  "Report date",
  "Submitted at (Beirut)",
  "Submitted by",
  "Assigned",
  "Completed",
  "Pending",
  "Overdue",
  "Completion rate (%)",
  "Active task time (min)",
  "Department reports included",
  "Departments not submitted",
  "Overdue critical tasks",
  "Executive notes",
];

export function executiveReportCsvRow(r: ExecutiveReport, submittedBy: string): CsvCell[] {
  const s = r.generated_snapshot;
  return [
    r.report_date,
    stamp(r.submitted_at),
    submittedBy,
    s.assigned,
    s.completed,
    s.pending,
    s.overdue,
    toPercent(s.completion_rate),
    toMinutes(s.active_seconds),
    r.department_report_ids.length,
    s.missing_departments.join("; "),
    s.overdue_critical.map((t) => `${t.title} (${t.department_name})`).join("; "),
    r.executive_notes,
  ];
}
