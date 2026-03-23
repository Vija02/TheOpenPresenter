import { createContext, useContext } from "react";

import { MediaPicker } from "../../types";

const defaultValue: MediaPicker = {
  show: (_options) => Promise.resolve(null),
};

export const MediaPickerContext = createContext<MediaPicker>(defaultValue);

export const useMediaPicker = () => {
  return useContext(MediaPickerContext);
};
