import SidebarMobile from "./SidebarMobile";
import SidebarWeb from "./SidebarWeb";
import "./index.css";

const SidebarWrapper = () => {
  return (
    <>
      <div className="rt--sidebar-wrapper-web">
        <SidebarWeb />
      </div>
      <div className="rt--sidebar-wrapper-mobile">
        <SidebarMobile />
      </div>
    </>
  );
};
export default SidebarWrapper;
