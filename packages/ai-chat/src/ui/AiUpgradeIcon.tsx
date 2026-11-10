import { TiStarburst } from "react-icons/ti";

/**
 * Marks an AI feature that needs something first: connecting to the cloud,
 * going online, or a plan that includes AI. The one icon for it everywhere.
 */
export const AiUpgradeIcon = ({ className }: { className?: string }) => (
  <TiStarburst
    className={`shrink-0 text-purple-500 ${className ?? ""}`}
    aria-label="Needs an upgrade"
  />
);
