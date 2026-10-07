type TRPCErrorLike = {
  message: string;
  data?: { code?: string } | null;
};

export const readableError = (
  error: TRPCErrorLike | null | undefined,
  fallback: string,
): string => {
  if (!error) return fallback;
  if (error.data?.code === "UNAUTHORIZED") {
    return "You need to be logged in to do this.";
  }
  if (!error.message || /^[A-Z_]+$/.test(error.message)) return fallback;
  return error.message;
};
