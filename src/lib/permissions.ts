// Central permissions layer. Every screen and every store action goes through
// these helpers, so hiding a button is never the only protection. In production
// the same rules belong in Supabase row-level security.

import type { Database, Role, Task, User } from "./types";

export const isExec = (u: User) => u.role === "owner" || u.role === "ceo";
export const isCompanyWide = (u: User) => isExec(u) || u.role === "gm";

export function visibleDepartmentIds(db: Database, u: User): string[] {
  if (isCompanyWide(u)) return db.departments.map((d) => d.id);
  return u.department_id ? [u.department_id] : [];
}

export function canViewDepartment(u: User, deptId: string): boolean {
  return isCompanyWide(u) || (u.role === "manager" && u.department_id === deptId);
}

export function canViewTask(u: User, t: Task): boolean {
  if (t.deleted_at) return false;
  if (isCompanyWide(u)) return true;
  if (u.role === "manager") return t.department_id === u.department_id || t.assigned_to === u.id;
  return t.assigned_to === u.id;
}

/** Whether `viewer` may see `target`'s tasks, activity and performance. */
export function canViewUser(viewer: User, target: User): boolean {
  if (viewer.id === target.id || isCompanyWide(viewer)) return true;
  return viewer.role === "manager" && target.role === "employee" && target.department_id === viewer.department_id;
}

export const canCreateTasks = (u: User) => u.role !== "employee";

export function assignableDepartmentIds(db: Database, actor: User): string[] {
  if (actor.role === "employee") return [];
  if (actor.role === "manager") return actor.department_id ? [actor.department_id] : [];
  return db.departments.map((d) => d.id);
}

/** Who `actor` may assign a task to inside a department. */
export function assignableUsers(db: Database, actor: User, deptId: string): User[] {
  const active = db.users.filter((u) => u.active_status);
  switch (actor.role) {
    case "owner":
    case "ceo":
      // Executives assign to authorised managers only.
      return active.filter((u) => u.role === "gm" || (u.role === "manager" && u.department_id === deptId));
    case "gm":
      return active.filter((u) => (u.role === "manager" || u.role === "employee") && u.department_id === deptId);
    case "manager":
      return actor.department_id === deptId
        ? active.filter((u) => u.role === "employee" && u.department_id === deptId)
        : [];
    default:
      return [];
  }
}

export function canAssign(db: Database, actor: User, assigneeId: string, deptId: string): boolean {
  return assignableUsers(db, actor, deptId).some((u) => u.id === assigneeId);
}

/** Edit, reassign, reprioritise, reorder, reopen or remove a task. */
export function canManageTask(actor: User, t: Task): boolean {
  if (t.deleted_at) return false;
  if (actor.role === "gm") return t.assigned_to !== actor.id;
  if (actor.role === "manager") return t.department_id === actor.department_id && t.assigned_to !== actor.id;
  if (isExec(actor)) return t.assigned_by === actor.id;
  return false;
}

export const canRunTimer = (actor: User, t: Task) => !t.deleted_at && t.assigned_to === actor.id;
export const canEscalate = (actor: User, t: Task) =>
  actor.role === "manager" && t.department_id === actor.department_id && t.status !== "completed";
export const canSeeInternalNotes = (actor: User) => actor.role !== "employee";
export const canSubmitDepartmentReport = (actor: User, deptId: string) =>
  actor.role === "manager" && actor.department_id === deptId;
export const canSubmitExecutiveReport = (actor: User) => actor.role === "gm";
export const canViewReports = (actor: User) => actor.role !== "employee";

export interface NavItem {
  href: string;
  label: string;
  icon: "radar" | "tasks" | "rocket" | "send" | "network" | "users" | "reports" | "settings" | "sun" | "target" | "trend" | "user" | "building";
}

const EXEC_NAV: NavItem[] = [
  { href: "/command", label: "Command Center", icon: "radar" },
  { href: "/tasks", label: "All Tasks", icon: "tasks" },
  { href: "/departments", label: "Departments", icon: "network" },
  { href: "/team", label: "Team Activity", icon: "users" },
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const NAV: Record<Role, NavItem[]> = {
  owner: EXEC_NAV,
  ceo: EXEC_NAV,
  gm: [
    { href: "/command", label: "Command Center", icon: "radar" },
    { href: "/tasks", label: "Task Deployment", icon: "rocket" },
    { href: "/departments", label: "Departments", icon: "network" },
    { href: "/team", label: "Employees", icon: "users" },
    { href: "/reports", label: "Reports", icon: "reports" },
  ],
  manager: [
    { href: "/department", label: "My Department", icon: "building" },
    { href: "/tasks", label: "Assign Tasks", icon: "send" },
    { href: "/team", label: "Team Activity", icon: "users" },
    { href: "/reports", label: "Reports", icon: "reports" },
  ],
  employee: [
    { href: "/my-day", label: "My Day", icon: "sun" },
    { href: "/my-tasks", label: "My Tasks", icon: "target" },
    { href: "/my-progress", label: "My Progress", icon: "trend" },
    { href: "/profile", label: "Profile", icon: "user" },
  ],
};

export const navFor = (role: Role) => NAV[role];
export const homeFor = (role: Role) => NAV[role][0].href;

export function canAccessRoute(u: User, path: string): boolean {
  return NAV[u.role].some((n) => path === n.href || path.startsWith(`${n.href}/`));
}

/** Plain-language permission summary shown on the role selector and profile. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: [
    "Sees every department, employee and task",
    "Reviews and exports all reports",
    "Assigns tasks to managers",
  ],
  ceo: [
    "Company-wide visibility in real time",
    "Reviews and exports all reports",
    "Assigns tasks to managers",
  ],
  gm: [
    "Runs daily operations across all departments",
    "Assigns and reassigns tasks to anyone",
    "Submits the daily executive report",
  ],
  manager: [
    "Sees only their own department",
    "Assigns tasks and sets priorities for their team",
    "Submits the daily department report",
  ],
  employee: [
    "Sees only their own tasks",
    "Starts, pauses and completes tasks",
    "Views personal progress",
  ],
};
