import { SectionedWindow } from "../shared/SectionedWindow";
import { VirtualScreens } from "./VirtualScreens";

export const SECTIONS = [
  {
    id: "virtual",
    label: "Virtual screens",
    hint: "Connect your monitors to virtual screens",
    Component: VirtualScreens,
  },
] as const;

export function Screens() {
  return <SectionedWindow sections={SECTIONS} label="Virtual screens sections" />;
}
