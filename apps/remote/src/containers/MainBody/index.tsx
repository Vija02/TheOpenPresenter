import { Scene } from "@repo/base-plugin";
import { useData, usePluginData } from "@repo/shared";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

import { useRendererSelection } from "../../contexts/rendererSelection";
import { useNavigateWithParams } from "../../hooks/useNavigateWithParams";
import Footer from "../Footer";
import { NewScene } from "./NewScene";
import SceneRenderer from "./SceneRenderer";
import "./index.css";

const MainBody = () => {
  const [location] = useLocation();
  const navigate = useNavigateWithParams();
  const { selectedRendererId } = useRendererSelection();

  const data = useData();
  const mainState = usePluginData().mainState!;

  const selectedScene = useMemo(
    () => (data.data[location.slice(1)] ? location.slice(1) : null),
    [data.data, location],
  );

  const scenes = useMemo(
    () =>
      Object.entries(data.data).filter(([, value]) => value.type === "scene"),
    [data.data],
  );

  // On load, figure out where the user should go
  useEffect(() => {
    // if we are already on the /new page, stop here
    if (location === "/new") return;

    const currentScene = mainState.renderer[selectedRendererId]?.currentScene;
    
    if (!selectedScene) {
      if (scenes.length === 0) {
        // if empty project then teleport them to the /new page
        navigate("/new", { replace: true });
      } else if (currentScene) {
        navigate(`/${currentScene}`, { replace: true });
      } else if (scenes.length > 0) {
        navigate(`/${scenes[0]![0]}`, { replace: true });
      }
    }
  }, [mainState.renderer, navigate, scenes, selectedRendererId, selectedScene, location]);

  return (
    <div className="rt--main-body-container">
      <div className="rt--main-body-center">
        {scenes.map(([sceneId, value]) => (
          <SceneRenderer
            key={sceneId}
            sceneId={sceneId}
            value={value as Scene}
          />
        ))}
        {location === "/new" && <NewScene />}
      </div>
      <Footer />
    </div>
  );
};

export default MainBody;