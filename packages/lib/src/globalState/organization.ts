import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  lastSelectedOrganizationId: string | null;
  setLastSelectedOrganizationId: (orgId: string) => void;
}

export const useLastSelectedOrganizationId = create<State>()(
  persist(
    (set) => ({
      lastSelectedOrganizationId: null,
      setLastSelectedOrganizationId: (orgId: string) =>
        set({ lastSelectedOrganizationId: orgId }),
    }),
    {
      name: "lastSelectedOrganizationId",
    },
  ),
);
