import { useHandleKeyPress } from "@repo/shared";

import "./CentralContainer.css";
import MainBody from "./MainBody";
import Sidebar from "./Sidebar";

const CentralContainer = () => {
  const handleKeyPress = useHandleKeyPress();

  return (
    <div
      className="rt--central-container"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      <Sidebar />
      <MainBody />
    </div>
  );
};

export default CentralContainer;
