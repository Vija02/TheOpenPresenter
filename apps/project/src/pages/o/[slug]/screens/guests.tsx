import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  ScreenGuestFragment,
  useCreateScreenGuestMutation,
  useDeleteScreenGuestMutation,
  useOrganizationScreenGuestsIndexPageQuery,
  useUpdateScreenGuestMutation,
} from "@repo/graphql";
import { extractError, globalState } from "@repo/lib";
import { Alert, Badge, Button, Input, Link, PopConfirm } from "@repo/ui";
import { format } from "date-fns";
import { useCallback, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { VscArrowLeft, VscEdit, VscTrash } from "react-icons/vsc";
import { toast } from "react-toastify";

const OrganizationGuestsPage = () => {
  const orgSlug = useOrganizationSlug();
  const query = useOrganizationScreenGuestsIndexPageQuery({
    variables: { slug: orgSlug },
  });
  const { data } = query[0];

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [, createEntry] = useCreateScreenGuestMutation();

  const [newName, setNewName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const organizationId = data?.organizationBySlug?.id;
  const entries = data?.organizationBySlug?.screenGuests.nodes ?? [];

  const onCreate = useCallback(async () => {
    if (!organizationId || !newName.trim() || !newPasscode) return;
    setError(null);
    try {
      await createEntry({
        organizationId,
        displayName: newName.trim(),
        passcode: newPasscode,
        email: newEmail.trim() || undefined,
      });
      setNewName("");
      setNewPasscode("");
      setNewEmail("");
      publish();
      toast.success("Guest added");
    } catch (e: any) {
      setError(e);
    }
  }, [organizationId, newName, newPasscode, newEmail, createEntry, publish]);

  return (
    <SharedOrgLayout title="Guest access" sharedOrgQuery={query}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/o/${orgSlug}/screens`}
            className="text-sm text-secondary inline-flex items-center gap-1 hover:underline"
          >
            <VscArrowLeft />
            Back to screens
          </Link>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">Registered guests</h1>
          </div>
          <p className="text-secondary">
            People who can authenticate at a screen with a passcode or just
            their email. Each entry unlocks access on screens whose access
            policy allows registered guests.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" title="Error" className="mb-4">
            {extractError(error).message}
          </Alert>
        )}

        <div className="border border-stroke rounded p-4 mb-6">
          <h2 className="text-lg font-medium mb-3">Add a guest</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Passcode (min 4 chars)"
              value={newPasscode}
              type="text"
              onChange={(e) => setNewPasscode(e.target.value)}
            />
            <Input
              placeholder="Email (optional)"
              value={newEmail}
              type="email"
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <Button
              variant="success"
              onClick={onCreate}
              disabled={!newName.trim() || newPasscode.length < 4}
            >
              <FaPlus />
              Add guest
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {entries.length === 0 && (
            <p className="text-secondary text-sm">No registered guests yet.</p>
          )}
          {entries.map((entry) => (
            <GuestRow key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </SharedOrgLayout>
  );
};

export default OrganizationGuestsPage;

const GuestRow = ({ entry }: { entry: ScreenGuestFragment }) => {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <GuestEditRow entry={entry} onClose={() => setEditing(false)} />
  ) : (
    <GuestDisplayRow entry={entry} onEdit={() => setEditing(true)} />
  );
};

const GuestDisplayRow = ({
  entry,
  onEdit,
}: {
  entry: ScreenGuestFragment;
  onEdit: () => void;
}) => {
  const [, deleteEntry] = useDeleteScreenGuestMutation();
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const onDelete = useCallback(async () => {
    try {
      await deleteEntry({ id: entry.id });
      publish();
      toast.success("Guest removed");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    }
  }, [deleteEntry, entry.id, publish]);

  return (
    <div className="border border-stroke rounded p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{entry.displayName}</h3>
          {!entry.isActive && (
            <Badge variant="warning" size="sm">
              Inactive
            </Badge>
          )}
          {entry.expiresAt &&
            new Date(entry.expiresAt).getTime() < Date.now() && (
              <Badge variant="warning" size="sm">
                Expired
              </Badge>
            )}
        </div>
        <p className="text-sm text-tertiary truncate">
          {entry.email ? entry.email + " · " : ""}
          Added {format(new Date(entry.createdAt), "yyyy-MM-dd")}
          {entry.userByCreatedBy?.username
            ? ` by @${entry.userByCreatedBy.username}`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="default" onClick={onEdit}>
          <VscEdit />
          Edit
        </Button>
        <PopConfirm
          title="Remove this guest?"
          okButtonProps={{ variant: "destructive" }}
          okText="Remove"
          onConfirm={onDelete}
        >
          <Button variant="destructive">
            <VscTrash />
          </Button>
        </PopConfirm>
      </div>
    </div>
  );
};

const GuestEditRow = ({
  entry,
  onClose,
}: {
  entry: ScreenGuestFragment;
  onClose: () => void;
}) => {
  const [, updateEntry] = useUpdateScreenGuestMutation();
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const [displayName, setDisplayName] = useState(entry.displayName);
  const [email, setEmail] = useState(entry.email ?? "");
  const [isActive, setIsActive] = useState(entry.isActive);
  const [newPasscode, setNewPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSave = useCallback(async () => {
    setErr(null);
    if (newPasscode && newPasscode.length < 4) {
      setErr("Passcode must be at least 4 characters");
      return;
    }
    setBusy(true);
    try {
      await updateEntry({
        id: entry.id,
        displayName: displayName.trim() || undefined,
        email: email.trim(),
        isActive,
        passcode: newPasscode || undefined,
      });
      publish();
      toast.success("Saved");
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }, [
    entry.id,
    displayName,
    email,
    isActive,
    newPasscode,
    updateEntry,
    publish,
    onClose,
  ]);

  return (
    <div className="border border-stroke rounded p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Display name
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Email (optional)
          </label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            New passcode (leave blank to keep)
          </label>
          <Input
            value={newPasscode}
            onChange={(e) => setNewPasscode(e.target.value)}
            placeholder="Min 4 chars"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`is-active-${entry.id}`}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <label htmlFor={`is-active-${entry.id}`} className="text-sm">
          Active
        </label>
      </div>
      {err && (
        <Alert variant="destructive" title="Error">
          {err}
        </Alert>
      )}
      <div className="flex gap-2">
        <Button variant="success" onClick={onSave} isLoading={busy}>
          Save
        </Button>
        <Button variant="default" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
