export function formatDuration(seconds: number) {
  const timeStr = new Date(seconds * 1000).toISOString().slice(11, 19);
  return timeStr.startsWith("00:") ? timeStr.slice(3) : timeStr;
}
