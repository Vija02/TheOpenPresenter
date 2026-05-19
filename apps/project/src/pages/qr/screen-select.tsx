import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import CreateScreenModal from "@/containers/Screen/CreateScreenModal";
import { useQrScreenSelectPageQuery } from "@repo/graphql";
import {
  Alert,
  Avatar,
  AvatarFallback,
  Button,
  LoadingInline,
  OverlayToggle,
} from "@repo/ui";
import { useCallback } from "react";
import { FaPlus } from "react-icons/fa";
import { PiTelevisionSimple } from "react-icons/pi";
import { VscChevronRight } from "react-icons/vsc";
import { useSearchParams } from "wouter";

type OrgInfo = {
  id: string;
  name: string;
  slug: string;
};

type ScreenInfo = {
  id: string;
  name: string;
  slug: string;
};

const QrScreenSelectPage = () => {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const query = useQrScreenSelectPageQuery();
  const [{ data, fetching }] = query;

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

  const allOrgs = (data?.currentUser?.organizationMemberships?.nodes ?? [])
    .map((m) => m.organization)
    .filter((org): org is NonNullable<typeof org> => !!org);

  const orgsWithScreens = allOrgs.filter(
    (org) => (org.screens?.nodes?.length ?? 0) > 0,
  );

  return (
    <SharedLayoutLoggedIn title="Select Screen" query={query}>
      <div className="max-w-lg mx-auto py-4 sm:py-8">
        {!id ? (
          <Alert variant="destructive" title="Missing id">
            No screen-select session id was provided in the URL.
          </Alert>
        ) : (
          <>
            <header className="text-center mb-8">
              <h1 className="text-2xl font-bold mb-2">Connect this TV</h1>
              <p className="text-secondary text-sm">
                Create or pick a screen from your organization to assign to your
                TV.
              </p>
            </header>

            {fetching && !data ? (
              <div className="flex justify-center py-12">
                <LoadingInline />
              </div>
            ) : orgsWithScreens.length === 0 ? (
              allOrgs.length === 0 ? (
                <EmptyNoAccess />
              ) : (
                <EmptyNoScreens orgs={allOrgs} />
              )
            ) : (
              <div className="space-y-6">
                {allOrgs.map((org) => (
                  <OrgSection
                    key={org.id}
                    org={org}
                    screens={org.screens?.nodes ?? []}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SharedLayoutLoggedIn>
  );
};

export default QrScreenSelectPage;

type OrgSectionProps = {
  org: OrgInfo;
  screens: ReadonlyArray<ScreenInfo>;
  onSelect: (orgSlug: string, screenSlug: string, screenId: string) => void;
};

const OrgSection = ({ org, screens, onSelect }: OrgSectionProps) => {
  return (
    <section>
      <div className="flex items-center gap-2 px-1 mb-2">
        <Avatar className="size-6">
          <AvatarFallback>
            {org.name?.charAt(0)?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-tertiary">
          {org.name}
        </h2>
      </div>
      <div className="border border-stroke rounded-lg overflow-hidden divide-y divide-stroke bg-white">
        {screens.map((screen) => (
          <button
            key={screen.id}
            type="button"
            onClick={() => onSelect(org.slug, screen.slug, screen.id)}
            className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-center size-10 rounded-md bg-gray-100 shrink-0">
              <PiTelevisionSimple className="text-tertiary" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{screen.name}</p>
              <p className="text-xs text-tertiary truncate">
                Tap to select this screen
              </p>
            </div>
            <VscChevronRight className="shrink-0 text-tertiary" size={18} />
          </button>
        ))}
        <OverlayToggle
          toggler={({ onToggle }) => (
            <button
              type="button"
              onClick={onToggle}
              className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-center size-10 rounded-md border border-dashed border-stroke shrink-0">
                <FaPlus className="text-tertiary" size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-tertiary">
                  Create new screen
                </p>
              </div>
            </button>
          )}
        >
          <CreateScreenModal organizationId={org.id} />
        </OverlayToggle>
      </div>
    </section>
  );
};

const EmptyNoAccess = () => (
  <div className="border border-stroke rounded-lg p-8 text-center bg-white">
    <p className="font-medium mb-1">No screens available</p>
    <p className="text-secondary text-sm">
      You don't have access to any organizations with screens.
    </p>
  </div>
);

type EmptyNoScreensProps = {
  orgs: ReadonlyArray<OrgInfo>;
};

const EmptyNoScreens = ({ orgs }: EmptyNoScreensProps) => {
  if (orgs.length === 1) {
    return (
      <div className="border border-dashed border-stroke rounded-lg p-6 sm:p-8 text-center bg-white">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-gray-100 mb-3">
          <PiTelevisionSimple className="text-tertiary" size={22} />
        </div>
        <p className="font-medium mb-1">No screens yet</p>
        <p className="text-secondary text-sm mb-5">
          Create your first screen in{" "}
          <span className="font-medium text-primary">{orgs[0].name}</span> to
          get started.
        </p>
        <OverlayToggle
          toggler={({ onToggle }) => (
            <Button variant="success" onClick={onToggle}>
              <FaPlus />
              Create screen
            </Button>
          )}
        >
          <CreateScreenModal organizationId={orgs[0].id} />
        </OverlayToggle>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-dashed border-stroke rounded-lg p-6 text-center bg-white mb-4">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-gray-100 mb-3">
          <PiTelevisionSimple className="text-tertiary" size={22} />
        </div>
        <p className="font-medium mb-1">No screens yet</p>
        <p className="text-secondary text-sm">
          Pick an organization to create your first screen.
        </p>
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-tertiary px-1 mb-2">
        Your organizations
      </h2>
      <div className="border border-stroke rounded-lg overflow-hidden divide-y divide-stroke bg-white">
        {orgs.map((org) => (
          <OverlayToggle
            key={org.id}
            toggler={({ onToggle }) => (
              <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarFallback>
                    {org.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{org.name}</p>
                  <p className="text-xs text-tertiary truncate">
                    Create a new screen
                  </p>
                </div>
                <div className="flex items-center justify-center size-8 rounded-full bg-gray-100 shrink-0">
                  <FaPlus className="text-tertiary" size={12} />
                </div>
              </button>
            )}
          >
            <CreateScreenModal organizationId={org.id} />
          </OverlayToggle>
        ))}
      </div>
    </div>
  );
};
