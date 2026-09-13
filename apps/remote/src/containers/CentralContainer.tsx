import "./CentralContainer.css";
import MainBody from "./MainBody";
import Sidebar from "./Sidebar";
import PreviewWindow from "./Sidebar/PreviewWindow";

const CentralContainer = () => {
  return (
    <div className="rt--central-container">
      <Sidebar />
      <MainBody />
      <PreviewWindow />
    </div>
  );
};

export default CentralContainer;
