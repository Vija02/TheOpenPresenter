import { NetworkStatus, useApolloClient } from "@apollo/client";
import { Skeleton, Stack, Text } from "@chakra-ui/react";
import Router from "next/router";
import React, { useEffect } from "react";

import { SharedLayout } from "./SharedLayout";
import { StandardWidth } from "./StandardWidth";

export interface RedirectProps {
  href: string;
  as?: string;
  layout?: boolean;
}

export function Redirect({ href, as, layout }: RedirectProps) {
  const client = useApolloClient();
  useEffect(() => {
    Router.push(href, as);
  }, [as, href]);
  if (layout) {
    return (
      <SharedLayout
        title="Redirecting..."
        query={{
          loading: true,
          data: undefined,
          error: undefined,
          networkStatus: NetworkStatus.loading,
          client,
          refetch: (async () => {
            throw new Error("Redirecting...");
          }) as any,
        }}
      >
        <Skeleton />
      </SharedLayout>
    );
  } else {
    return (
      <StandardWidth>
        <Text fontSize="3xl" fontWeight="bold" mb={5}>
          Redirecting...
        </Text>
        <Stack>
          <Skeleton height="20px" w="80%" />
          <Skeleton height="20px" />
          <Skeleton height="20px" w="90%" />
          <Skeleton height="20px" w="50%" />
        </Stack>
        <Skeleton />
      </StandardWidth>
    );
  }
}
