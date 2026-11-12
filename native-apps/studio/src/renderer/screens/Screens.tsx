import { SectionedWindow } from "../shared/SectionedWindow";
import { Clicker } from "./Clicker";
import { VirtualScreens } from "./VirtualScreens";

export const SECTIONS = [
  {
    id: "virtual",
    label: "Virtual screens",
    hint: "Connect your monitors to virtual screens",
    Component: VirtualScreens,
  },
  {
    id: "clicker",
    label: "Capture clicker",
    hint: "Move slides with a presentation clicker",
    Component: Clicker,
  },
] as const;

export function Screens() {
  return <SectionedWindow sections={SECTIONS} label="Kiosk settings sections" />;
}
