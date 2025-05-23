import SidebarMobile from "./SidebarMobile";
import SidebarWeb from "./SidebarWeb";

const SidebarWrapper = () => {
  return (
    <>
      <div className="hidden desktop:flex h-screen relative">
        <SidebarWeb />
      </div>
      <div className="desktop:hidden h-screen flex relative">
        <SidebarMobile />
      </div>
    </>
  );
};
export default SidebarWrapper;
