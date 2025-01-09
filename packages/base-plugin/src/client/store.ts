import { create } from "zustand";

import { AwarenessStore } from "../types";

interface State {
  awarenessData: AwarenessStore[];
}

export const awarenessStore = create<State>()(() => ({
  awarenessData: [],
}));
