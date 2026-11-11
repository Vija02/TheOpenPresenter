import { SectionedWindow } from "../shared/SectionedWindow";
import { About } from "./About";
import { Account } from "./Account";
import { RemoteAccess } from "./RemoteAccess";
import { RuntimeManager } from "./RuntimeManager";

export const SECTIONS = [
  {
    id: "server",
    label: "Account",
    hint: "Your instance and organizations",
    Component: Account,
  },
  {
    id: "runtime",
    label: "Local runtime",
    hint: "The instance that runs on this computer",
    Component: RuntimeManager,
  },
  {
    id: "remote",
    label: "Remote access",
    hint: "Reach this computer from elsewhere",
    Component: RemoteAccess,
  },
  {
    id: "about",
    label: "About",
    hint: "Versions and support",
    Component: About,
  },
] as const;

export function Settings() {
  return <SectionedWindow sections={SECTIONS} label="Settings sections" />;
}
