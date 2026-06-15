import { electronAPI } from "./electronAPI";

/** Invoke a main-process IPC handler (see src/main/ipc.ts). */
export const invoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> => electronAPI.invoke<T>(cmd, args);

export type UnlistenFn = () => void;

/** Subscribe to a main-process event. Returns an unsubscribe function. */
export const listen = async <T = unknown>(
  event: string,
  handler: (e: { payload: T }) => void,
): Promise<UnlistenFn> =>
  electronAPI.listen<T>(event, (payload) => handler({ payload }));
