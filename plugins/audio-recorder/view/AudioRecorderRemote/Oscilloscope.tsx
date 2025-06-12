import { useEffect, useRef } from "react";

export const Oscilloscope = ({
  data,
  width = 800,
  height = 200,
  color = "#00ff00",
}: any) => {
  return (
    <div
      style={{
        height: height,
        width: width,
        backgroundColor: "#333",
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          height: `${data * 100}%`,
          backgroundColor: color,
          transition: "height 0.1s ease-out",
        }}
      />
    </div>
  );
};
