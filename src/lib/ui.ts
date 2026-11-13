"use client";

import { create } from "zustand";

export interface ComposerPreset {
  department_id?: string;
  assigned_to?: string;
}

interface UiState {
  demoOpen: boolean;
  composer: ComposerPreset | null;
}

/** Transient interface state shared across screens (never persisted). */
export const useUi = create<UiState>(() => ({ demoOpen: false, composer: null }));

export const openDemo = () => useUi.setState({ demoOpen: true });
export const closeDemo = () => useUi.setState({ demoOpen: false });
export const openComposer = (preset: ComposerPreset = {}) => useUi.setState({ composer: preset });
export const closeComposer = () => useUi.setState({ composer: null });
