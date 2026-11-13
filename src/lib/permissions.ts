// Central permissions layer. Every screen and every store action goes through
// these helpers, so hiding a button is never the only protection. In production
// the same rules belong in Supabase row-level security.

import type { Database, Role, Task, User } from "./types";
import { ROLE_RANK } from "./types";

export const RESTAURANT_DEPT = "restaurant";

export const isExec = (u: User) => u.role === "owner" || u.role === "ceo";
export const isCompanyWide = (u: User) => isExec(u) || u.role === "gm";

/**
 * Chain of command: Owner > CEO > General Manager > Department Manager >
 * Employee. A department manager's chain is their own department only.
 */
export function isBeneath(actor: User, target: User): boolean {
  if (ROLE_RANK[target.role] <= ROLE_RANK[actor.role]) return false;
  return actor.role !== "manager" || target.department_id === actor.department_id;
}

export function visibleDepartmentIds(db: Database, u: User): string[] {
  if (isCompanyWide(u)) return db.departments.map((d) => d.id);
  return u.department_id ? [u.department_id] : [];
}

export function canViewDepartment(u: User, deptId: string): boolean {
  return isCompanyWide(u) || (u.role === "manager" && u.department_id === deptId);
}

export const canViewRestaurants = (u: User) =>
  isCompanyWide(u) || (u.role === "manager" && u.department_id === RESTAURANT_DEPT);

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

/**
 * Who `actor` may assign a task to inside a department: everyone beneath them
 * in the chain of command. The Owner can assign straight to a waiter; the CEO
 * and General Manager (who sit above the departments) appear in every one.
 */
export function assignableUsers(db: Database, actor: User, deptId: string): User[] {
  if (actor.role === "manager" && actor.department_id !== deptId) return [];
  return db.users.filter(
    (u) => u.active_status && isBeneath(actor, u) && (u.department_id === deptId || u.department_id === null),
  );
}

export function canAssign(db: Database, actor: User, assigneeId: string, deptId: string): boolean {
  return assignableUsers(db, actor, deptId).some((u) => u.id === assigneeId);
}

/**
 * Edit, reassign, reprioritise, reorder, reopen or remove a task. Allowed when
 * the task sits with someone beneath the actor (or with no one yet); never for
 * a task assigned to the actor themselves or to someone above them.
 */
export function canManageTask(db: Database, actor: User, t: Task): boolean {
  if (t.deleted_at || actor.role === "employee" || t.assigned_to === actor.id) return false;
  if (actor.role === "manager" && t.department_id !== actor.department_id) return false;
  if (!t.assigned_to) return true;
  const assignee = db.users.find((u) => u.id === t.assigned_to);
  return assignee ? isBeneath(actor, assignee) : true;
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
  icon:
    | "radar"
    | "tasks"
    | "rocket"
    | "send"
    | "network"
    | "users"
    | "reports"
    | "settings"
    | "sun"
    | "target"
    | "trend"
    | "user"
    | "building"
    | "utensils";
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

const RESTAURANTS_NAV: NavItem = { href: "/restaurants", label: "Restaurants", icon: "utensils" };

/** Navigation for a person. Restaurants appears for company-wide roles and the restaurant manager. */
export function navFor(u: User): NavItem[] {
  const base = NAV[u.role];
  if (!canViewRestaurants(u)) return base;
  const at = base.findIndex((n) => n.href === "/departments" || n.href === "/department") + 1;
  return [...base.slice(0, at), RESTAURANTS_NAV, ...base.slice(at)];
}

export const homeFor = (role: Role) => NAV[role][0].href;

export function canAccessRoute(u: User, path: string): boolean {
  return navFor(u).some((n) => path === n.href || path.startsWith(`${n.href}/`));
}

/** Plain-language permission summary shown on the role selector and profile. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: [
    "Sees every department, employee and task",
    "Assigns tasks to anyone in the company",
    "Reviews and exports all reports",
  ],
  ceo: [
    "Company-wide visibility in real time",
    "Assigns tasks to anyone beneath the CEO",
    "Reviews and exports all reports",
  ],
  gm: [
    "Runs daily operations across all departments",
    "Assigns tasks to managers and all staff",
    "Submits the daily executive report",
  ],
  manager: [
    "Sees only their own department",
    "Assigns tasks and time limits to their team",
    "Submits the daily department report",
  ],
  employee: [
    "Sees only their own tasks",
    "Starts, pauses and completes tasks",
    "Gets an alert when a task runs over its time",
  ],
};
