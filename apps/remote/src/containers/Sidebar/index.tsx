import { useIsMobile } from "../../hooks/useIsMobile";
import SidebarMobile from "./SidebarMobile";
import SidebarWeb from "./SidebarWeb";

const SidebarWrapper = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <SidebarMobile />;
  } else {
    return <SidebarWeb />;
  }
};
export default SidebarWrapper;
