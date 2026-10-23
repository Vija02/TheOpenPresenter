import { useWindowWidth } from "@react-hook/window-size";

// Matches the max-[399px] classes in NewScene
const SMALL_PHONE_MAX_WIDTH = 399;

export const useIsSmallPhone = () => useWindowWidth() <= SMALL_PHONE_MAX_WIDTH;
