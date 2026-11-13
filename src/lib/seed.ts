// Deterministic demo data. Every person, task and report here is fictional and
// generated from a fixed seed, positioned around the moment the demo is opened
// so the venue always looks mid-shift.

import { departmentSnapshot, executiveSnapshot } from "./selectors";
import { MANAGER_TEMPLATES, TEMPLATES, type TaskTemplate } from "./templates";
import { addDays, dateKey, dayEnd, dayStart, iso, MIN } from "./time";
import type {
  ActivityAction,
  Database,
  Department,
  Priority,
  Task,
  TaskActivityLog,
  TaskStatus,
  TaskTimeSession,
  User,
} from "./types";

export const DB_VERSION = 1;
const HOUR = 60 * MIN;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Person = [name: string, title: string];
const ORG: { id: string; name: string; short: string; description: string; manager: Person; staff: Person[] }[] = [
  { id: "ops", name: "Operations", short: "OPS", description: "Venue opening, staffing and daily floor operations.", manager: ["Rami Nassar", "Operations Manager"], staff: [["Jad Salem", "Operations Employee"], ["Elias Farah", "Operations Employee"]] },
  { id: "sales", name: "Sales & Bookings", short: "SALES", description: "Inquiries, corporate clients and booking confirmations.", manager: ["Sarah Daher", "Sales Manager"], staff: [["Nour Haddad", "Sales Executive"], ["Marc Khoury", "Sales Executive"]] },
  { id: "sports", name: "Sports Facilities", short: "SPORTS", description: "Football pitch, padel courts and sports equipment.", manager: ["Tony Mansour", "Sports Manager"], staff: [["Chris Saad", "Sports Employee"], ["Adam Elias", "Sports Employee"]] },
  { id: "events", name: "Events & Birthdays", short: "EVENTS", description: "Birthday parties, themed weekends and private events.", manager: ["Lea Nassar", "Events Manager"], staff: [["Rita Farah", "Events Coordinator"], ["Joe Haddad", "Events Employee"]] },
  { id: "restaurant", name: "Restaurant & Hospitality", short: "F&B", description: "Dining room, service stations and hygiene standards.", manager: ["Fadi Salem", "Restaurant Manager"], staff: [["Mira Daher", "Restaurant Employee"], ["Samir Khoury", "Restaurant Employee"]] },
  { id: "maint", name: "Maintenance", short: "MAINT", description: "Lighting, air-conditioning, repairs and equipment safety.", manager: ["Georges Karam", "Maintenance Manager"], staff: [["Ziad Tannous", "Maintenance Technician"], ["Hadi Rahme", "Maintenance Technician"]] },
  { id: "marketing", name: "Marketing", short: "MKT", description: "Social content, promotions and campaign updates.", manager: ["Yara Saab", "Marketing Manager"], staff: [["Carla Moussa", "Content Creator"], ["Omar Khalil", "Marketing Coordinator"]] },
  { id: "cx", name: "Customer Experience", short: "CX", description: "Feedback, complaints and front-desk service standards.", manager: ["Dana Azar", "Customer Experience Manager"], staff: [["Lynn Bitar", "Guest Relations Agent"], ["Paul Abboud", "Guest Relations Agent"]] },
];

type Slot = "done" | "done_late" | "running" | "paused" | "paused_long" | "pending" | "overdue";
type Plan = [Slot, Priority?][];

// One plan per employee, in ORG order. The first employee (the demo "Employee"
// profile) starts with nothing running so the Start flow is clean.
const PLANS: Plan[] = [
  [["done"], ["done"], ["pending", "high"], ["pending", "medium"], ["pending", "low"]],
  [["done"], ["running"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["done_late"], ["paused"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["running"], ["overdue", "critical"], ["pending"], ["pending"]],
  [["done"], ["done"], ["running"], ["pending"], ["pending"]],
  [["done"], ["done"], ["done"], ["paused_long"], ["pending"]],
  [["done"], ["running"], ["pending"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["done_late"], ["overdue"], ["pending"], ["pending"]],
  [["done"], ["done"], ["running"], ["pending"], ["pending"]],
  [["done"], ["running"], ["pending"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["running"], ["overdue", "critical"], ["overdue"], ["pending"]],
  [["done_late"], ["paused_long"], ["overdue", "high"], ["overdue"], ["pending"]],
  [["done"], ["done"], ["running"], ["pending"], ["pending"]],
  [["done"], ["paused"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["done"], ["running"], ["pending"], ["pending"], ["pending"]],
  [["done"], ["done_late"], ["pending"], ["pending"], ["pending"]],
];

const MANAGER_SLOTS: Slot[] = ["pending", "done", "running", "pending", "done", "overdue", "pending", "paused"];

const MANAGER_NOTES = [
  "All priority tasks closed before the evening peak.",
  "Two tasks slipped past their deadline; both are closed now.",
  "Smooth day. Team fully staffed.",
  "Handover notes shared with the evening shift.",
  "One follow-up carried to tomorrow morning.",
];
const EXEC_NOTES = [
  "All departments reported. No critical issues open.",
  "Maintenance backlog is the main risk; extra cover arranged.",
  "Strong day across the venue. Weekend preparation on track.",
  "Events and Restaurant handled the evening peak well.",
];

export function buildSeed(nowMs: number): Database {
  const now = Math.floor(nowMs / MIN) * MIN;
  const today = dateKey(now);
  const S = dayStart(today);
  const E = dayEnd(today);
  const rand = rng(20261113);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const shuffled = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let n = a.length - 1; n > 0; n--) {
      const k = Math.floor(rand() * (n + 1));
      [a[n], a[k]] = [a[k], a[n]];
    }
    return a;
  };
  let counter = 0;
  const id = (p: string) => `${p}_${(++counter).toString(36)}`;
  const priority = (): Priority => {
    const r = rand();
    return r < 0.12 ? "critical" : r < 0.4 ? "high" : r < 0.8 ? "medium" : "low";
  };

  // --- People ---------------------------------------------------------------
  const joined = iso(S - 400 * 24 * HOUR);
  const users: User[] = [];
  const addUser = (uid: string, name: string, role: User["role"], title: string, dept: string | null, manager: string | null) => {
    const u: User = { id: uid, name, role, title, department_id: dept, manager_id: manager, avatar: String((users.length * 47 + 130) % 360), active_status: true, created_at: joined };
    users.push(u);
    return u;
  };
  const owner = addUser("u_owner", "Alex Haddad", "owner", "Owner", null, null);
  addUser("u_ceo", "Maya Khoury", "ceo", "Chief Executive Officer", null, owner.id);
  const gm = addUser("u_gm", "Karim Mansour", "gm", "General Manager", null, "u_ceo");
  const departments: Department[] = [];
  const staff: User[] = [];
  const managers: User[] = [];
  ORG.forEach((d, n) => {
    const m = addUser(`m_${d.id}`, d.manager[0], "manager", d.manager[1], d.id, gm.id);
    managers.push(m);
    departments.push({ id: d.id, name: d.name, short: d.short, manager_id: m.id, description: d.description, display_order: n });
    d.staff.forEach((p, k) => staff.push(addUser(`e_${d.id}_${k + 1}`, p[0], "employee", p[1], d.id, m.id)));
  });

  // --- Tasks ----------------------------------------------------------------
  const tasks: Task[] = [];
  const sessions: TaskTimeSession[] = [];
  const logs: TaskActivityLog[] = [];
  const log = (task_id: string | null, actor_id: string, action: ActivityAction, at: number, prev: string | null = null, next: string | null = null) =>
    logs.push({ id: id("l"), task_id, actor_id, action, previous_value: prev, new_value: next, created_at: iso(at) });
  const session = (task_id: string, employee_id: string, start: number, end: number | null) =>
    sessions.push({ id: id("s"), task_id, employee_id, started_at: iso(start), ended_at: end === null ? null : iso(end), duration_seconds: end === null ? 0 : Math.round((end - start) / 1000) });
  const push = (tid: string, tpl: TaskTemplate, dept: string, by: User, to: User | null, pr: Priority, status: TaskStatus, due: number, created: number, completed: number | null) => {
    tasks.push({
      id: tid, title: tpl.title, description: tpl.description, department_id: dept, assigned_by: by.id, assigned_to: to?.id ?? null,
      priority: pr, status, due_at: iso(due), estimated_duration: tpl.est, category: tpl.category, internal_notes: null, completion_note: null,
      created_at: iso(created), updated_at: iso(completed ?? created), completed_at: completed === null ? null : iso(completed), display_order: null, deleted_at: null,
    });
    log(tid, by.id, "assigned", created, null, to?.id ?? null);
    if (status !== "completed" && due < now) log(tid, to?.id ?? by.id, "overdue", due);
  };

  const lo = S + MIN;
  const hi = E - 10 * MIN;
  const inDay = (v: number) => clamp(v, lo, hi);

  function addToday(dept: string, to: User, by: User, slot: Slot, tpl: TaskTemplate, pr: Priority) {
    const tid = id("t");
    const duration = tpl.est * MIN * between(0.6, 1.3);
    let due = now;
    let status: TaskStatus = "pending";
    let completed: number | null = null;
    let first = now;
    switch (slot) {
      case "done":
      case "done_late": {
        completed = clamp(now - between(20, 360) * MIN, lo, now - MIN);
        first = completed - duration;
        session(tid, to.id, first, completed);
        due = slot === "done" ? inDay(completed + between(10, 120) * MIN) : Math.max(lo, completed - between(10, 50) * MIN);
        status = "completed";
        break;
      }
      case "running": {
        const start = now - between(4, 35) * MIN;
        first = start;
        if (rand() < 0.35) {
          const pausedAt = start - between(5, 20) * MIN;
          first = pausedAt - between(4, 12) * MIN;
          session(tid, to.id, first, pausedAt);
        }
        session(tid, to.id, start, null);
        due = inDay(now + between(15, 120) * MIN);
        status = "in_progress";
        break;
      }
      case "paused":
      case "paused_long": {
        const end = now - (slot === "paused" ? between(8, 30) : between(70, 140)) * MIN;
        first = end - between(5, 25) * MIN;
        session(tid, to.id, first, end);
        due = inDay(now + (slot === "paused" ? between(20, 150) : between(-30, 60)) * MIN);
        status = "paused";
        break;
      }
      case "pending":
        due = inDay(now + between(40, 360) * MIN);
        break;
      case "overdue":
        due = clamp(now - between(25, 170) * MIN, lo, now - 5 * MIN);
        break;
    }
    const created = Math.min(S + between(6, 8.5) * HOUR, first - 10 * MIN, now - 5 * MIN);
    push(tid, tpl, dept, by, to, pr, status, due, created, completed);
    const mine = sessions.filter((s) => s.task_id === tid);
    mine.forEach((s, n) => {
      log(tid, to.id, n === 0 ? "started" : "resumed", Date.parse(s.started_at));
      if (s.ended_at && !(status === "completed" && n === mine.length - 1)) log(tid, to.id, "paused", Date.parse(s.ended_at));
    });
    if (completed !== null) log(tid, to.id, "completed", completed);
  }

  staff.forEach((person, n) => {
    const dept = person.department_id!;
    const manager = managers.find((m) => m.department_id === dept)!;
    const pool = shuffled(TEMPLATES[dept]);
    PLANS[n].forEach(([slot, forced], k) => addToday(dept, person, k % 4 === 3 ? gm : manager, slot, pool[k % pool.length], forced ?? priority()));
  });
  managers.forEach((m, n) => addToday(m.department_id!, m, gm, MANAGER_SLOTS[n], MANAGER_TEMPLATES[n % MANAGER_TEMPLATES.length], n === 5 ? "high" : priority()));
  addToday("ops", gm, owner, "pending", { title: "Prepare weekly operations briefing for ownership", description: "Summarise the week's performance, open risks and next week's priorities.", est: 45, category: "Management" }, "high");

  // Two urgent tasks nobody has picked up yet.
  [
    { dept: "maint", tpl: TEMPLATES.maint[2], pr: "critical" as Priority, mins: 50 },
    { dept: "events", tpl: TEMPLATES.events[2], pr: "high" as Priority, mins: 95 },
  ].forEach((u) => push(id("t"), u.tpl, u.dept, gm, null, u.pr, "pending", inDay(now + u.mins * MIN), now - between(15, 40) * MIN, null));

  // --- 14 days of history ---------------------------------------------------
  let lingering = 0;
  for (let d = 14; d >= 1; d--) {
    const day = addDays(today, -d);
    const dS = dayStart(day);
    const dE = dayEnd(day);
    const roughDay = d % 5 === 0 ? 0.14 : 0;
    for (const person of staff) {
      const dept = person.department_id!;
      const manager = managers.find((m) => m.department_id === dept)!;
      const pool = shuffled(TEMPLATES[dept]);
      const count = 2 + (rand() < 0.55 ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const tpl = pool[k];
        const tid = id("t");
        const due = dS + between(9, 22) * HOUR;
        const created = dS + between(6, 8.5) * HOUR;
        const stays = d <= 3 && lingering < 6 && rand() < (dept === "maint" ? 0.3 : 0.05);
        if (stays) {
          const pr: Priority = lingering === 0 ? "critical" : lingering === 1 ? "high" : priority();
          lingering++;
          push(tid, tpl, dept, manager, person, pr, "pending", due, created, null);
          continue;
        }
        const late = rand() < (dept === "maint" ? 0.4 : dept === "events" ? 0.24 : 0.12) + roughDay;
        const completed = clamp(late ? due + between(10, 120) * MIN : due - between(5, 90) * MIN, created + 20 * MIN, Math.min(dE - MIN, now - MIN));
        const start = Math.max(created + 5 * MIN, completed - tpl.est * MIN * between(0.6, 1.4));
        session(tid, person.id, start, completed);
        push(tid, tpl, dept, manager, person, priority(), "completed", due, created, completed);
        log(tid, person.id, "completed", completed);
      }
    }
  }

  const db: Database = { version: DB_VERSION, seeded_at: iso(now), users, departments, tasks, sessions, logs, daily_reports: [], executive_reports: [] };

  // --- Submitted reports for every past day ---------------------------------
  for (let d = 14; d >= 1; d--) {
    const day = addDays(today, -d);
    const end = dayEnd(day);
    const ids: string[] = [];
    for (const dep of departments) {
      const at = Math.min(dayStart(day) + between(21.5, 23.4) * HOUR, now - MIN);
      const rid = id("dr");
      ids.push(rid);
      db.daily_reports.push({ id: rid, report_date: day, department_id: dep.id, submitted_by: dep.manager_id, submitted_at: iso(at), status: "reviewed", generated_snapshot: departmentSnapshot(db, dep.id, day, day, end), manager_notes: pick(MANAGER_NOTES) });
      log(null, dep.manager_id, "report_submitted", at, null, dep.id);
    }
    const at = Math.min(dayStart(day) + 23.7 * HOUR, now - MIN / 2);
    db.executive_reports.push({ id: id("er"), report_date: day, submitted_by: gm.id, submitted_at: iso(at), department_report_ids: ids, generated_snapshot: executiveSnapshot(db, day, end), executive_notes: pick(EXEC_NOTES) });
    log(null, gm.id, "report_submitted", at, null, "executive");
  }

  logs.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return db;
}

/** The profiles offered on the demo login screen. */
export const DEMO_PROFILES: { userId: string; label: string }[] = [
  { userId: "u_owner", label: "Owner" },
  { userId: "u_ceo", label: "CEO" },
  { userId: "u_gm", label: "General Manager" },
  { userId: "m_ops", label: "Operations Manager" },
  { userId: "m_sales", label: "Sales Manager" },
  { userId: "m_events", label: "Events Manager" },
  { userId: "m_sports", label: "Sports Manager" },
  { userId: "m_restaurant", label: "Restaurant Manager" },
  { userId: "e_ops_1", label: "Employee" },
];
