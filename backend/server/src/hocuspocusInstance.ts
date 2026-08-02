import { Hocuspocus } from "@hocuspocus/server";

export type HocuspocusContext = {
  session_id?: string | null;
  screen_guest_session_id?: string | null;
  screen_id?: string | null;
};

export const hocuspocus = new Hocuspocus<HocuspocusContext>({
  name: "Hocuspocus Server",
});
