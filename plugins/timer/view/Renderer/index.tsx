import { useCallback } from "react";
import Countdown, { CountdownRenderProps } from "react-countdown";

import { usePluginAPI } from "../pluginApi";

const Renderer = () => {
  const pluginApi = usePluginAPI();

  const timerDuration = pluginApi.scene.useData(
    (x) => x.pluginData.timerDuration,
  );
  const isRunning = pluginApi.renderer.useData((x) => x.isRunning);
  const timeStarted = pluginApi.renderer.useData((x) => x.timeStarted);
  const key = JSON.stringify({ timerDuration, isRunning, timeStarted });

  const renderer = useCallback(({ formatted }: CountdownRenderProps) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        // Debt: Center better
        viewBox="0 0 65 21"
        color="white"
      >
        <text x="5" y="14" fill="white">
          {formatted.hours ? `${formatted.hours}:` : ``}
          {formatted.minutes}:{formatted.seconds}
        </text>
      </svg>
    );
  }, []);

  if (!isRunning) {
    return (
      <Countdown
        key={key}
        controlled
        date={timerDuration}
        renderer={renderer}
      />
    );
  }

  return (
    <Countdown
      key={key}
      date={(timeStarted ?? new Date().getTime()) + timerDuration}
      renderer={renderer}
    />
  );
};

export default Renderer;
