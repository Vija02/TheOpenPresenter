import { FcGoogle } from "react-icons/fc";

import { CanvaIconLogo } from "./CanvaLogo";

export type IntegrationBrand = {
  id: string;
  name: string;
  icon: React.ReactNode;
};

export const googleSlidesBrand: IntegrationBrand = {
  id: "googleslides",
  name: "Google Slides",
  icon: <FcGoogle className="size-10" />,
};

export const canvaBrand: IntegrationBrand = {
  id: "canva",
  name: "Canva",
  icon: <CanvaIconLogo className="size-10" />,
};
