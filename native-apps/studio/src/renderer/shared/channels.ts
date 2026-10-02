export const CHANNELS = [
  {
    value: "stable",
    label: "Stable (recommended)",
    note: "Tested releases.",
  },
  {
    value: "nightly",
    label: "Nightly (latest, may break)",
    note: "Built from the newest code. Expect rough edges.",
  },
] as const;

export type Channel = (typeof CHANNELS)[number]["value"];

export const DEFAULT_CHANNEL: Channel = CHANNELS[0].value;

/** The sentence that explains the channel currently chosen. */
export function channelNote(value: string): string {
  return CHANNELS.find((channel) => channel.value === value)?.note ?? "";
}
