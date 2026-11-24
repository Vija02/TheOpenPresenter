import { useOrganizationFontsQuery } from "@repo/graphql";
import {
  organizationFontStack,
  setAddFontHandler,
  setOrganizationFonts,
} from "@repo/layout";
import { useRefetchWhenFontsMissing } from "@repo/layout/react";
import { AddGoogleFontDialog } from "@repo/media-picker/client";
import { usePluginMetaData } from "@repo/shared";
import { useEffect, useRef, useState } from "react";

export const OrganizationFonts = () => {
  const { orgId, isPublicAccess } = usePluginMetaData();
  const [{ data }, refetch] = useOrganizationFontsQuery({
    variables: { organizationId: orgId },
    pause: !orgId,
  });

  useEffect(() => {
    const nodes = data?.organizationFonts?.nodes;
    if (!nodes) return;
    setOrganizationFonts(
      nodes.flatMap((n) =>
        n.cssUrl
          ? [{ family: n.family, category: n.category, cssUrl: n.cssUrl }]
          : [],
      ),
    );
  }, [data]);

  useRefetchWhenFontsMissing(() => refetch({ requestPolicy: "network-only" }));

  // A newer request or unmount cancels the waiting one, so its picker never
  // stays stuck on "Adding font…"
  const [isOpen, setIsOpen] = useState(false);
  const pending = useRef<((stack: string | null) => void) | null>(null);
  const settle = (stack: string | null) => {
    pending.current?.(stack);
    pending.current = null;
  };

  useEffect(() => {
    if (!orgId || isPublicAccess) return;
    setAddFontHandler(
      () =>
        new Promise<string | null>((resolve) => {
          settle(null);
          pending.current = resolve;
          setIsOpen(true);
        }),
    );
    return () => {
      setAddFontHandler(null);
      settle(null);
      setIsOpen(false);
    };
  }, [orgId, isPublicAccess]);

  const close = (stack: string | null) => {
    settle(stack);
    setIsOpen(false);
  };

  return (
    <AddGoogleFontDialog
      isOpen={isOpen}
      organizationId={orgId}
      addedFamilies={data?.organizationFonts?.nodes.map((n) => n.family)}
      onDone={(added) => {
        if (!added) return close(null);
        refetch({ requestPolicy: "network-only" });
        close(organizationFontStack(added.family, added.category));
      }}
    />
  );
};
