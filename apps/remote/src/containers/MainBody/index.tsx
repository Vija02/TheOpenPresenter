import { Scene } from "@repo/base-plugin";
import { useData, usePluginData } from "@repo/shared";
import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";

import { useNavigateWithParams } from "../../hooks/useNavigateWithParams";
import Footer from "../Footer";
import { EmptyScene } from "./EmptyScene";
import SceneRenderer from "./SceneRenderer";
import "./index.css";

const MainBody = () => {
  const [location] = useLocation();
  const navigate = useNavigateWithParams();

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

  // On load, select the scene that is active if available
  useEffect(() => {
    const currentScene = mainState.renderer["1"]?.currentScene;
    if (!selectedScene) {
      if (currentScene) {
        navigate(`/${currentScene}`, { replace: true });
      } else if (scenes.length > 0) {
        navigate(`/${scenes[0]![0]}`, { replace: true });
      }
    }
  }, [mainState.renderer, navigate, scenes, selectedScene]);

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
        {scenes.length === 0 && <EmptyScene />}
      </div>
      <Footer />
    </div>
  );
};

export default MainBody;
