// Logical entities for Arena OS. Field names follow the database naming in the
// implementation plan (snake_case) so the local demo store maps 1:1 onto
// Supabase tables later. All timestamps are ISO-8601 strings in UTC.

export type Role = "owner" | "ceo" | "gm" | "manager" | "employee";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "paused" | "completed";

export interface User {
  id: string;
  name: string;
  role: Role;
  title: string;
  department_id: string | null;
  manager_id: string | null;
  avatar: string; // hue (0-360) used to draw the initials avatar
  active_status: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  short: string;
  manager_id: string;
  description: string;
  display_order: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  department_id: string;
  assigned_by: string;
  assigned_to: string | null;
  priority: Priority;
  status: TaskStatus;
  due_at: string;
  estimated_duration: number | null; // minutes
  category: string | null;
  internal_notes: string | null;
  completion_note: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  display_order: number | null; // manual rank inside a priority level
  deleted_at: string | null; // soft delete keeps historical reports intact
}

export interface TaskTimeSession {
  id: string;
  task_id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null; // null while the timer is running
  duration_seconds: number;
}

export type ActivityAction =
  | "assigned"
  | "started"
  | "paused"
  | "resumed"
  | "completed"
  | "reopened"
  | "reassigned"
  | "priority_changed"
  | "edited"
  | "overdue"
  | "removed"
  | "escalated"
  | "report_submitted";

export interface TaskActivityLog {
  id: string;
  task_id: string | null;
  actor_id: string;
  action: ActivityAction;
  previous_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface EmployeeReportRow {
  user_id: string;
  name: string;
  title: string;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  delayed: number;
  active_seconds: number;
  avg_seconds: number;
  completion_rate: number;
}

export interface DepartmentTotals {
  department_id: string;
  department_name: string;
  from: string; // business date
  to: string;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  delayed: number;
  completion_rate: number;
  active_seconds: number;
  avg_seconds: number;
}

export interface DepartmentSnapshot extends DepartmentTotals {
  employees: EmployeeReportRow[];
  follow_up: { task_id: string; title: string; reason: string }[];
}

export interface DailyReport {
  id: string;
  report_date: string; // Asia/Beirut business date, YYYY-MM-DD
  department_id: string;
  submitted_by: string;
  submitted_at: string;
  status: "submitted" | "reviewed";
  generated_snapshot: DepartmentSnapshot;
  manager_notes: string;
}

export interface ExecutiveSnapshot {
  date: string;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completion_rate: number;
  active_seconds: number;
  departments: DepartmentTotals[];
  overdue_critical: { task_id: string; title: string; department_name: string }[];
  missing_departments: string[];
}

export interface ExecutiveReport {
  id: string;
  report_date: string;
  submitted_by: string;
  submitted_at: string;
  department_report_ids: string[];
  generated_snapshot: ExecutiveSnapshot;
  executive_notes: string;
}

export interface Database {
  version: number;
  seeded_at: string;
  users: User[];
  departments: Department[];
  tasks: Task[];
  sessions: TaskTimeSession[];
  logs: TaskActivityLog[];
  daily_reports: DailyReport[];
  executive_reports: ExecutiveReport[];
}

export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
export const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};
export const PRIORITY_COLOR: Record<Priority, string> = {
  critical: "#ff4d5e",
  high: "#ffa53c",
  medium: "#5aa9ff",
  low: "#8b958f",
};
export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  paused: "Paused",
  completed: "Completed",
};
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  ceo: "CEO",
  gm: "General Manager",
  manager: "Department Manager",
  employee: "Employee",
};
