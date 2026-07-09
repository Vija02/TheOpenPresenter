import { useWindowWidth } from "@react-hook/window-size";

export const useIsMobile = () => {
  const windowWidth = useWindowWidth();
  return windowWidth < 768;
};
