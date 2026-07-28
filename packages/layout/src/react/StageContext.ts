import { createContext, useContext } from "react";

import { StageMetrics } from "../geometry/scale";

const EMPTY_METRICS: StageMetrics = {
  containerWidth: 0,
  containerHeight: 0,
  boxWidth: 0,
  boxHeight: 0,
  offsetX: 0,
  offsetY: 0,
  unit: 0,
};

export const StageContext = createContext<StageMetrics>(EMPTY_METRICS);

export const useStage = (): StageMetrics => useContext(StageContext);

export const useStageReady = (): boolean => useStage().boxWidth > 0;
