import { Image } from "@chakra-ui/react";

const ImageRenderView = ({ src }: { src: string }) => {
  return <Image src={src} width="100%" height="100%" objectFit="contain" />;
};

export default ImageRenderView;
