import { createStore, useStore } from "zustand";

export type MobileSidebarState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

export const mobileSidebarStore = createStore<MobileSidebarState>((set) => ({
  isOpen: false,
  open: () => set(() => ({ isOpen: true })),
  close: () => set(() => ({ isOpen: false })),
}));

export const useMobileSidebar = () => useStore(mobileSidebarStore);
