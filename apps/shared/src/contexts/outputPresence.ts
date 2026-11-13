import type { OutputPresence } from "@repo/base-plugin";
import { create } from "zustand";

export const useOutputPresence = create<{
  presence: OutputPresence | null;
  setPresence: (presence: OutputPresence | null) => void;
}>((set) => ({
  presence: null,
  setPresence: (presence) => set({ presence }),
}));
