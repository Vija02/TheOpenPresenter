import { NetworkStatus, useApolloClient } from "@apollo/client";
import { Skeleton } from "@repo/ui";
import { useEffect } from "react";
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
  }, [href, navigate]);

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
        <h1 className="text-3xl font-bold mb-5">Redirecting...</h1>
        <div className="stack-col items-start">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-[90%]" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <Skeleton className="h-20 w-full" />
      </StandardWidth>
    );
  }
}
