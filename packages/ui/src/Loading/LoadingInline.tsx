import { Center } from "@chakra-ui/react";
import { Oval } from "react-loader-spinner";

import { DeferredLoad } from "../DeferredLoad";

type PropTypes = { defer?: boolean; size?: number; p?: number };

export function LoadingInline({ defer = true, size = 20, p = 5 }: PropTypes) {
  const Component = (
    <Center p={p}>
      <Oval color="black" secondaryColor="gray" height={size} width={size} />
    </Center>
  );

  if (defer) {
    return <DeferredLoad>{Component}</DeferredLoad>;
  }

  return Component;
}
