"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import * as engine from "./engine";
import { DomainError, type NewTaskInput } from "./engine";
import { localRepository as repo } from "./repository";
import { buildSeed, DB_VERSION } from "./seed";
import { idx } from "./selectors";
import { dateKey } from "./time";
import type { Database, Priority, User } from "./types";

const PROFILE_KEY = "arena-os-profile-v1"; // per tab, so two tabs can show two roles
const PREFS_KEY = "arena-os-prefs-v1";

interface AppState {
  ready: boolean;
  db: Database | null;
  userId: string | null;
  switchingTo: string | null;
  effects: "auto" | "off";
}

export const useApp = create<AppState>(() => ({
  ready: false,
  db: null,
  userId: null,
  switchingTo: null,
  effects: "auto",
}));

// --- Clock -------------------------------------------------------------------
// One shared ticker. Timers read timestamps, so a sleeping tab or a refresh
// never loses time; the ticker only decides when to repaint.

const fastListeners = new Set<() => void>();
const slowListeners = new Set<() => void>();
let fastNow = 0;
let slowNow = 0;
let clockStarted = false;

function touchClock(notify = true) {
  fastNow = slowNow = Date.now();
  if (notify) {
    fastListeners.forEach((l) => l());
    slowListeners.forEach((l) => l());
  }
}

function startClock() {
  if (clockStarted || typeof window === "undefined") return;
  clockStarted = true;
  touchClock(false);
  setInterval(() => {
    fastNow = Date.now();
    fastListeners.forEach((l) => l());
    if (fastNow - slowNow >= 20_000) {
      slowNow = fastNow;
      slowListeners.forEach((l) => l());
    }
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) touchClock();
  });
}

/** Current time. `fast` repaints every second (live timers); otherwise every 20s. */
export function useNow(fast = false): number {
  const subscribe = useCallback(
    (cb: () => void) => {
      startClock();
      const set = fast ? fastListeners : slowListeners;
      set.add(cb);
      return () => {
        set.delete(cb);
      };
    },
    [fast],
  );
  return useSyncExternalStore(
    subscribe,
    () => {
      startClock();
      return fast ? fastNow : slowNow;
    },
    () => 0,
  );
}

// --- Boot / profile ----------------------------------------------------------

export function boot() {
  if (useApp.getState().ready) return;
  const now = Date.now();
  let db = repo.load();
  // Fresh sample data on first visit and at the start of each business day, so
  // the venue always looks mid-shift.
  if (!db || db.version !== DB_VERSION || dateKey(db.seeded_at) !== dateKey(now)) {
    db = buildSeed(now);
    repo.save(db);
  }
  db = engine.syncOverdue(db, now);
  let userId: string | null = null;
  let effects: AppState["effects"] = "auto";
  try {
    userId = sessionStorage.getItem(PROFILE_KEY);
    if (localStorage.getItem(PREFS_KEY) === "off") effects = "off";
  } catch {
    // storage blocked
  }
  if (userId && !db.users.some((u) => u.id === userId)) userId = null;
  useApp.setState({ ready: true, db, userId, effects });
  repo.subscribe((next) => useApp.setState({ db: next }));
  setInterval(() => {
    const cur = useApp.getState().db;
    if (!cur) return;
    const next = engine.syncOverdue(cur, Date.now());
    if (next !== cur) {
      useApp.setState({ db: next });
      repo.save(next);
    }
  }, 30_000);
}

/** Start the animated hand-over to another demo profile. */
export function switchProfile(userId: string) {
  useApp.setState({ switchingTo: userId });
}

export function completeSwitch(userId: string) {
  try {
    sessionStorage.setItem(PROFILE_KEY, userId);
  } catch {
    // storage blocked
  }
  useApp.setState({ userId });
}

export const clearSwitch = () => useApp.setState({ switchingTo: null });

export function signOut() {
  try {
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    // storage blocked
  }
  useApp.setState({ userId: null });
}

export function setEffects(effects: AppState["effects"]) {
  try {
    localStorage.setItem(PREFS_KEY, effects);
  } catch {
    // storage blocked
  }
  useApp.setState({ effects });
}

export function resetDemo() {
  const db = buildSeed(Date.now());
  repo.save(db);
  touchClock(false);
  useApp.setState({ db });
  toast.success("Demo reset to the original sample data.");
}

// --- Hooks -------------------------------------------------------------------

/** The database. Only call below the app shell, which waits for it to load. */
export function useDb(): Database {
  const db = useApp((s) => s.db);
  if (!db) throw new Error("Arena OS data has not loaded yet.");
  return db;
}

/** The signed-in demo profile. */
export function useMe(): User {
  const db = useDb();
  const id = useApp((s) => s.userId);
  const me = id ? idx(db).userById.get(id) : undefined;
  if (!me) throw new Error("No demo profile selected.");
  return me;
}

// --- Actions -----------------------------------------------------------------

function commit(change: (db: Database, actor: User, now: number) => Database, success?: string): boolean {
  const { db, userId } = useApp.getState();
  const actor = db && userId ? idx(db).userById.get(userId) : undefined;
  if (!db || !actor) {
    toast.error("Choose a demo profile first.");
    return false;
  }
  try {
    const next = change(db, actor, Date.now());
    if (next !== db) {
      touchClock(false);
      useApp.setState({ db: next });
      repo.save(next);
    }
    if (success) toast.success(success);
    return true;
  } catch (e) {
    if (e instanceof DomainError) {
      toast.error(e.message);
      return false;
    }
    throw e;
  }
}

export const actions = {
  createTask: (input: NewTaskInput) => commit((db, a, now) => engine.createTask(db, a, now, input)),
  startTask: (taskId: string, pauseCurrent = false) =>
    commit((db, a, now) => engine.startTask(db, a, now, taskId, pauseCurrent)),
  pauseTask: (taskId: string) => commit((db, a, now) => engine.pauseTask(db, a, now, taskId)),
  completeTask: (taskId: string, note?: string) =>
    commit((db, a, now) => engine.completeTask(db, a, now, taskId, note)),
  setCompletionNote: (taskId: string, note: string) =>
    commit((db, a, now) => engine.setCompletionNote(db, a, now, taskId, note), "Note saved."),
  reopenTask: (taskId: string) => commit((db, a, now) => engine.reopenTask(db, a, now, taskId), "Task reopened."),
  reassignTask: (taskId: string, userId: string) =>
    commit((db, a, now) => engine.reassignTask(db, a, now, taskId, userId), "Task reassigned."),
  changePriority: (taskId: string, priority: Priority) =>
    commit((db, a, now) => engine.changePriority(db, a, now, taskId, priority)),
  updateTask: (taskId: string, change: Parameters<typeof engine.updateTask>[4]) =>
    commit((db, a, now) => engine.updateTask(db, a, now, taskId, change), "Task updated."),
  removeTask: (taskId: string) => commit((db, a, now) => engine.removeTask(db, a, now, taskId), "Task removed."),
  reorderTasks: (orderedIds: string[]) => commit((db, a, now) => engine.reorderTasks(db, a, now, orderedIds)),
  escalateTask: (taskId: string, reason: string) =>
    commit((db, a, now) => engine.escalateTask(db, a, now, taskId, reason), "Escalated to the General Manager."),
  submitDailyReport: (deptId: string, date: string, notes: string) =>
    commit((db, a, now) => engine.submitDailyReport(db, a, now, deptId, date, notes), "Daily report submitted."),
  reviewDailyReport: (reportId: string) =>
    commit((db, a, now) => engine.reviewDailyReport(db, a, now, reportId), "Marked as reviewed."),
  submitExecutiveReport: (date: string, notes: string) =>
    commit((db, a, now) => engine.submitExecutiveReport(db, a, now, date, notes), "Executive report submitted."),
};
