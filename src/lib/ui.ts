"use client";

import { create } from "zustand";
import type { Priority } from "./types";

export interface ComposerPreset {
  department_id?: string;
  assigned_to?: string;
}

/** Quick status filter on the task board. */
export type BoardQuick =
  | "open"
  | "overdue"
  | "over_time"
  | "in_progress"
  | "paused"
  | "pending"
  | "unassigned"
  | "done"
  | "all";

export interface BoardFilters {
  quick: BoardQuick;
  assignee: string; // user id, or "" for everyone
  dept: string; // department id, or ""
  priority: Priority | "";
  restaurant: string; // restaurant id, or ""
  q: string;
}

export const NO_FILTERS: BoardFilters = { quick: "open", assignee: "", dept: "", priority: "", restaurant: "", q: "" };

interface UiState {
  demoOpen: boolean;
  composer: ComposerPreset | null;
  board: BoardFilters;
}

/** Transient interface state shared across screens (never persisted). */
export const useUi = create<UiState>(() => ({ demoOpen: false, composer: null, board: NO_FILTERS }));

export const openDemo = () => useUi.setState({ demoOpen: true });
export const closeDemo = () => useUi.setState({ demoOpen: false });
export const openComposer = (preset: ComposerPreset = {}) => useUi.setState({ composer: preset });
export const closeComposer = () => useUi.setState({ composer: null });

/** Change some task-board filters and keep the rest. */
export const setBoard = (change: Partial<BoardFilters>) => useUi.setState((s) => ({ board: { ...s.board, ...change } }));
/** Replace all task-board filters, for example when jumping in from an alert. */
export const showOnBoard = (filters: Partial<BoardFilters>) => useUi.setState({ board: { ...NO_FILTERS, ...filters } });
export const resetBoard = () => useUi.setState({ board: NO_FILTERS });
