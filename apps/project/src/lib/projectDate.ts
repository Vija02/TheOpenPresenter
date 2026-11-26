import { format } from "date-fns";

export {
  comingSunday,
  fromProjectDateValue,
  fromProjectTimeValue,
  toProjectDateValue,
  toProjectTimeValue,
} from "@repo/lib";

/** "10:30" or "10:30:00" → "10:30 AM", for showing a time to people */
export const formatTimeLabel = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return format(new Date(2000, 0, 1, h, m), "h:mm a");
};
