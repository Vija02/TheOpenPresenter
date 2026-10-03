type TRPCErrorLike = {
  message: string;
  data?: { code?: string } | null;
};

// tRPC sends the bare error code (e.g. "UNAUTHORIZED") as the message for
// errors that the procedure did not throw itself. Only show real messages.
export const readableError = (
  error: TRPCErrorLike | null | undefined,
  fallback: string,
): string => {
  if (!error) return fallback;
  if (error.data?.code === "UNAUTHORIZED") {
    return "Log in to use this. Your session may have expired.";
  }
  if (!error.message || /^[A-Z_]+$/.test(error.message)) return fallback;
  return error.message;
};
