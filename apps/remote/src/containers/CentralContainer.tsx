import "./CentralContainer.css";
import MainBody from "./MainBody";
import Sidebar from "./Sidebar";

const CentralContainer = () => {
  return (
    <div className="rt--central-container">
      <Sidebar />
      <MainBody />
    </div>
  );
};

export default CentralContainer;
