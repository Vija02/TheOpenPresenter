import { create } from "zustand";

interface State {
  awarenessData: any[];
}

export const awarenessStore = create<State>()(() => ({
  awarenessData: [],
}));
