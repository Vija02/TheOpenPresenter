import { createStore, useStore } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarSectionId = "scenes" | "output";

export type SidebarSectionsState = {
  open: Record<SidebarSectionId, boolean>;
  toggle: (id: SidebarSectionId) => void;
};

export const sidebarSectionsStore = createStore<SidebarSectionsState>()(
  persist(
    (set) => ({
      open: { scenes: true, output: false },
      toggle: (id) =>
        set((state) => ({ open: { ...state.open, [id]: !state.open[id] } })),
    }),
    {
      name: "remote-sidebar-sections",
      partialize: (state) => ({ open: state.open }),
      merge: (persisted, current) => ({
        ...current,
        open: {
          ...current.open,
          ...(persisted as Partial<SidebarSectionsState> | undefined)?.open,
        },
      }),
    },
  ),
);

export const useSidebarSections = () => useStore(sidebarSectionsStore);
