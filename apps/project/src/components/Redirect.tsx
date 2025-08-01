import { NetworkStatus, useApolloClient } from "@apollo/client";
import { Skeleton, Stack, Text } from "@chakra-ui/react";
import React, { useEffect } from "react";
import { useLocation } from "wouter";

import { SharedLayout } from "./SharedLayout";
import { StandardWidth } from "./StandardWidth";

export interface RedirectProps {
  href: string;
  as?: string;
  layout?: boolean;
}

export function Redirect({ href, layout }: RedirectProps) {
  const client = useApolloClient();
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(href);
  }, [href]);
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
