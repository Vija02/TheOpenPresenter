import { FcGoogle } from "react-icons/fc";
import { SiCanva } from "react-icons/si";

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
  icon: <SiCanva className="size-10 text-[#00C4CC]" />,
};
