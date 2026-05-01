import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  OrganizationScreensIndexPageQuery,
  ScreenFragment,
  useCreateScreenMutation,
  useDeleteScreenMutation,
  useOrganizationScreensIndexPageQuery,
  useUpdateScreenMutation,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import { Alert, Badge, Button, Input, Link, PopConfirm } from "@repo/ui";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { MdCoPresent } from "react-icons/md";
import { VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";
import slugify from "slugify";

const buildScreenRendererUrl = (orgSlug: string, screenSlug: string) =>
  `${window.location.origin}/render/s/${orgSlug}/${screenSlug}`;

const OrganizationScreensPage = () => {
  const orgSlug = useOrganizationSlug();
  const query = useOrganizationScreensIndexPageQuery({
    variables: { slug: orgSlug },
    requestPolicy: "cache-and-network",
  });
  const { data } = query[0];

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createScreen] = useCreateScreenMutation();
  const [, updateScreen] = useUpdateScreenMutation();
  const [, deleteScreen] = useDeleteScreenMutation();

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const organizationId = data?.organizationBySlug?.id;
  const screens = data?.organizationBySlug?.screens.nodes ?? [];
  const projects = data?.organizationBySlug?.projects.nodes ?? [];

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

  const onAssign = useCallback(
    async (screenId: string, projectId: string | null) => {
      try {
        await updateScreen({
          id: screenId,
          currentProjectId: projectId,
        });
        publish();
      } catch (e: any) {
        toast.error("Failed to assign: " + e.message);
      }
    },
    [updateScreen, publish],
  );

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await deleteScreen({ id });
        publish();
        toast.success("Screen deleted");
      } catch (e: any) {
        toast.error("Failed to delete: " + e.message);
      }
    },
    [deleteScreen, publish],
  );

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
        </div>

        {error && (
          <Alert variant="destructive" title="Error" className="mb-4">
            {extractError(error).message}
          </Alert>
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
            <ScreenRow
              key={screen.id}
              screen={screen}
              orgSlug={orgSlug}
              projects={projects}
              onAssign={onAssign}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationScreensPage;

type ScreenProject = NonNullable<
  OrganizationScreensIndexPageQuery["organizationBySlug"]
>["projects"]["nodes"][number];

type ScreenRowProps = {
  screen: ScreenFragment;
  orgSlug: string;
  projects: readonly ScreenProject[];
  onAssign: (screenId: string, projectId: string | null) => void;
  onDelete: (id: string) => void;
};

const ScreenRow = ({
  screen,
  orgSlug,
  projects,
  onAssign,
  onDelete,
}: ScreenRowProps) => {
  const url = useMemo(
    () => buildScreenRendererUrl(orgSlug, screen.slug),
    [orgSlug, screen.slug],
  );

  return (
    <div className="border border-stroke rounded p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium truncate">{screen.name}</h3>
          <p className="text-sm text-tertiary">{screen.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/o/${orgSlug}/screens/${screen.slug}/control`}>
            <Button variant="outline" size="sm">
              <MdCoPresent />
              Control
            </Button>
          </Link>
          <PopConfirm
            title="Delete this screen?"
            okText="Delete"
            okButtonProps={{ variant: "destructive" }}
            onConfirm={() => onDelete(screen.id)}
          >
            <Button variant="ghost" size="sm">
              <VscTrash />
            </Button>
          </PopConfirm>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Currently showing
          </label>
          <select
            value={screen.currentProjectId ?? ""}
            onChange={(e) =>
              onAssign(screen.id, e.target.value === "" ? null : e.target.value)
            }
            className="border border-stroke rounded px-2 py-1 w-full bg-background"
          >
            <option value="">— Unassigned —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name !== ""
                  ? p.name
                  : p.targetDate
                    ? ""
                    : `Untitled (${format(new Date(p.createdAt), "do MMM yyyy")})`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Screen URL
          </label>
          <Input
            type="text"
            value={url}
            readOnly
            className="font-mono text-xs"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      </div>
    </div>
  );
};
