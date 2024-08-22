import { Center } from "@chakra-ui/react";

import { LoadingInline } from "./LoadingInline";

type PropTypes = { defer?: boolean; size?: number; p?: number };

export function LoadingFull({ defer = false, size = 80, p = 5 }: PropTypes) {
  return (
    <Center height="100%" pt="150px">
      <LoadingInline defer={defer} size={size} p={p} />
    </Center>
  );
}
