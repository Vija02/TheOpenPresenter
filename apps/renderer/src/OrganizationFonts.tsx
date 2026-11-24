import { useOrganizationFontsQuery } from "@repo/graphql";
import { setOrganizationFonts } from "@repo/layout";
import { useRefetchWhenFontsMissing } from "@repo/layout/react";
import { usePluginMetaData } from "@repo/shared";
import { useEffect } from "react";

export const OrganizationFonts = () => {
  const { orgId } = usePluginMetaData();
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

  return null;
};
