import { useIsSmallPhone } from "../../hooks/useIsSmallPhone";
import { MobileDrawer } from "./MobileDrawer";
import SidebarMobile from "./SidebarMobile";
import SidebarWeb from "./SidebarWeb";
import "./index.css";

const SidebarWrapper = () => {
  const isSmallPhone = useIsSmallPhone();

  return (
    <>
      <div className="rt--sidebar-wrapper-web">
        <SidebarWeb />
      </div>
      {isSmallPhone ? (
        <MobileDrawer />
      ) : (
        <div className="rt--sidebar-wrapper-mobile">
          <SidebarMobile />
        </div>
      )}
    </>
  );
};
export default SidebarWrapper;
