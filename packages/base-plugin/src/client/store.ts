import { create } from "zustand";

import { AwarenessUserData } from "../types";

interface State {
  awarenessData: { user: AwarenessUserData }[];
}

export const awarenessStore = create<State>()(() => ({
  awarenessData: [],
}));
