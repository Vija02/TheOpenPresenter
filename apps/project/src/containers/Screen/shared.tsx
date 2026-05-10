export const formatSeconds = (v: number) => `${v}s`;
export const parseSeconds = (s: string) => parseFloat(s.replace(/s\s*$/i, ""));
