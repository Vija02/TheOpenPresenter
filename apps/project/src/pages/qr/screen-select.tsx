import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { StandardWidth } from "@/components/StandardWidth";
import { useQrScreenSelectPageQuery } from "@repo/graphql";
import { Alert, Avatar, AvatarFallback, Option } from "@repo/ui";
import { useCallback } from "react";
import { PiTelevisionSimple } from "react-icons/pi";
import { VscChevronRight } from "react-icons/vsc";
import { useSearchParams } from "wouter";

const QrScreenSelectPage = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const query = useQrScreenSelectPageQuery();
  const [{ data }] = query;

  const onSelect = useCallback(
    (orgSlug: string, screenSlug: string, screenId: string) => {
      if (!id) return;
      const url = new URL(
        "/qr-auth/screen-select/submit",
        window.location.origin,
      );
      url.searchParams.set("id", id);
      url.searchParams.set("screen_id", screenId);
      url.searchParams.set("screen_slug", screenSlug);
      url.searchParams.set("org_slug", orgSlug);
      window.location.href = url.toString();
    },
    [id],
  );

  const orgsWithScreens = (
    data?.currentUser?.organizationMemberships?.nodes ?? []
  )
    .map((m) => m.organization)
    .filter((org): org is NonNullable<typeof org> => !!org)
    .filter((org) => (org.screens?.nodes?.length ?? 0) > 0);

  return (
    <SharedLayoutLoggedIn title="Pick a screen" query={query}>
      {!id ? (
        <div className="max-w-md mx-auto">
          <Alert variant="destructive" title="Missing id">
            No screen-select session id was provided in the URL.
          </Alert>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold mb-1">Pick a screen</h1>
          <p className="text-secondary text-sm mb-1">
            Select a screen to setup on your device.
          </p>

          {orgsWithScreens.length === 0 ? (
            <div className="border border-stroke rounded p-6 text-center">
              <PiTelevisionSimple
                className="mx-auto mb-2 text-tertiary"
                size={28}
              />
              <p className="text-secondary text-sm">
                You don't have access to any screens.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {orgsWithScreens.map((org) => (
                <div key={org.id}>
                  <div className="stack-row mb-2">
                    <Avatar className="size-6">
                      <AvatarFallback>
                        {org.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <h2 className="text-sm font-medium text-tertiary">
                      {org.name}
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {org.screens.nodes.map((screen) => (
                      <Option
                        key={screen.id}
                        size="lg"
                        onClick={() =>
                          onSelect(org.slug, screen.slug, screen.id)
                        }
                        title={
                          <span className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-3 min-w-0">
                              <PiTelevisionSimple
                                className="shrink-0 text-tertiary"
                                size={20}
                              />
                              <span className="truncate">{screen.name}</span>
                            </span>
                            <VscChevronRight className="shrink-0 text-tertiary" />
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SharedLayoutLoggedIn>
  );
};

export default QrScreenSelectPage;
