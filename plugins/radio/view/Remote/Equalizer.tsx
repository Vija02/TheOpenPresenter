import { cn } from "@repo/ui";

export const Equalizer = ({ className }: { className?: string }) => (
  <div className={cn("pl-radio--equalizer", className)} aria-hidden>
    <span />
    <span />
    <span />
  </div>
);
