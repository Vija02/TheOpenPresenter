import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { PendingRequestsPanel } from "@/containers/Screen/PendingRequestsPanel";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ScreenFragment,
  useCreateScreenMutation,
  useOrganizationScreensIndexPageQuery,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import { Alert, Badge, Button, Input, Link } from "@repo/ui";
import { useCallback, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { VscChevronRight } from "react-icons/vsc";
import { toast } from "react-toastify";
import slugify from "slugify";
import { Link as WouterLink } from "wouter";

const OrganizationScreensPage = () => {
  const orgSlug = useOrganizationSlug();
  const query = useOrganizationScreensIndexPageQuery({
    variables: { slug: orgSlug },
  });
  const { data } = query[0];

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createScreen] = useCreateScreenMutation();

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const organizationId = data?.organizationBySlug?.id;
  const screens = data?.organizationBySlug?.screens.nodes ?? [];

  const onCreate = useCallback(async () => {
    if (!organizationId || !newName.trim()) return;
    setError(null);
    try {
      const slug = newSlug.trim()
        ? slugify(newSlug, {
            lower: true,
          })
        : slugify(newName, {
            lower: true,
          });
      await createScreen({
        organizationId,
        name: newName.trim(),
        slug,
      });
      setNewName("");
      setNewSlug("");
      publish();
      toast.success("Screen created");
    } catch (e: any) {
      setError(e);
    }
  }, [organizationId, newName, newSlug, createScreen, publish]);

  return (
    <SharedOrgLayout title="Screens" sharedOrgQuery={query}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Screens</h1>
            <Badge variant="default" size="sm">
              Beta
            </Badge>
          </div>
          <p className="text-secondary">
            Persistent displays in your organization. Set up the device once
            with the screen URL. Then, assign any project here and it will
            switch automatically.
          </p>
          <div className="mt-3">
            <Link asChild>
              <WouterLink
                href={`/o/${orgSlug}/screens/guests`}
                className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
              >
                Manage registered guests
                <VscChevronRight />
              </WouterLink>
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" title="Error" className="mb-4">
            {extractError(error).message}
          </Alert>
        )}

        {organizationId && (
          <div className="mb-6">
            <PendingRequestsPanel organizationId={organizationId} />
          </div>
        )}

        <div className="border border-stroke rounded p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">Add a screen</h2>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Name (e.g. Main Auditorium)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Slug (auto if blank)"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="md:w-64"
            />
            <Button
              variant="success"
              onClick={onCreate}
              disabled={!newName.trim()}
            >
              <FaPlus />
              Create
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {screens.length === 0 && (
            <p className="text-secondary text-sm">No screens yet.</p>
          )}
          {screens.map((screen) => (
            <ScreenRow key={screen.id} screen={screen} orgSlug={orgSlug} />
          ))}
        </div>
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
