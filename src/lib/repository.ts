// Persistence boundary. The demo keeps everything in the browser; swapping in a
// Supabase-backed implementation of this interface is the only change the
// store needs to go live (see README).

import type { Database } from "./types";

export interface DataRepository {
  load(): Database | null;
  save(db: Database): void;
  clear(): void;
  /** Called when another tab or device changes the data. */
  subscribe(listener: (db: Database) => void): () => void;
}

const KEY = "arena-os-demo-v1";

export const localRepository: DataRepository = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Database) : null;
    } catch {
      return null;
    }
  },
  save(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // Storage full or blocked: the demo keeps working in memory.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  },
  subscribe(listener) {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        listener(JSON.parse(e.newValue) as Database);
      } catch {
        // ignore a half-written value
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
};
