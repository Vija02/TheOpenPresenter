import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import CreateScreenModal from "@/containers/Screen/CreateScreenModal";
import { PendingRequestsPanel } from "@/containers/Screen/PendingRequestsPanel";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ScreenFragment,
  useOrganizationScreensIndexPageQuery,
} from "@repo/graphql";
import { Alert, Button, Link, OverlayToggle } from "@repo/ui";
import { FaPlus } from "react-icons/fa";
import { VscChevronRight } from "react-icons/vsc";
import { Link as WouterLink } from "wouter";

const OrganizationScreensPage = () => {
  const orgSlug = useOrganizationSlug();
  const query = useOrganizationScreensIndexPageQuery({
    variables: { slug: orgSlug },
  });
  const { data } = query[0];

  const organizationId = data?.organizationBySlug?.id;
  const screens = data?.organizationBySlug?.screens.nodes ?? [];

  return (
    <SharedOrgLayout title="Screens" sharedOrgQuery={query}>
      <Alert
        variant="default"
        size="sm"
        title="Screens are a beta feature"
        subtitle="Behaviour and settings may change. Please report any issues you run into."
        className="mb-2"
      />
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold mb-0">Screens</h1>
        <div className="stack-row">
          {organizationId && (
            <OverlayToggle
              toggler={({ onToggle }) => (
                <Button variant="success" size="sm" onClick={onToggle}>
                  <FaPlus />
                  New
                </Button>
              )}
            >
              <CreateScreenModal organizationId={organizationId} />
            </OverlayToggle>
          )}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-secondary mb-3">
          Persistent displays in your organization. Set up the device once with
          the screen URL. Then, assign any project here and it will switch
          automatically.
        </p>
        <div className="mt-3">
          <Link asChild>
            <WouterLink href={`/o/${orgSlug}/screens/guests`}>
              Manage registered guests
              <VscChevronRight />
            </WouterLink>
          </Link>
        </div>
      </div>

      {organizationId && (
        <div className="mb-6">
          <PendingRequestsPanel organizationId={organizationId} />
        </div>
      )}

      <div className="space-y-3 mb-6">
        {screens.length === 0 && (
          <div className="border border-dashed border-stroke rounded p-6 text-center">
            <p className="text-secondary mb-3">No screens yet.</p>
            {organizationId && (
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button variant="success" onClick={onToggle}>
                    <FaPlus />
                    New screen
                  </Button>
                )}
              >
                <CreateScreenModal organizationId={organizationId} />
              </OverlayToggle>
            )}
          </div>
        )}
        {screens.map((screen) => (
          <ScreenRow key={screen.id} screen={screen} orgSlug={orgSlug} />
        ))}
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationScreensPage;

type ScreenRowProps = {
  screen: ScreenFragment;
  orgSlug: string;
};

const ScreenRow = ({ screen, orgSlug }: ScreenRowProps) => {
  const current = screen.currentProject;
  return (
    <Link asChild>
      <WouterLink
        href={`/o/${orgSlug}/screens/${screen.slug}/admin`}
        className="block border border-stroke rounded p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-medium truncate">{screen.name}</h3>
            <p className="text-sm text-tertiary truncate">
              {current
                ? `Showing: ${current.name !== "" ? current.name : "Untitled"}`
                : "Idle — nothing assigned"}
            </p>
          </div>
          <VscChevronRight className="shrink-0 text-tertiary" />
        </div>
      </WouterLink>
    </Link>
  );
};
