import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  BaseOrganizationSettingsPageQuery,
  BaseOrganizationSettingsPageQueryVariables,
  Exact,
  useBaseOrganizationSettingsPageQuery,
  useDeleteOrganizationMutation,
} from "@repo/graphql";
import { globalState } from "@repo/lib";
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  useDisclosure,
} from "@repo/ui";
import { FC, useCallback, useState } from "react";
import { toast } from "react-toastify";
import { CombinedError, UseQueryResponse } from "urql";
import { useLocation } from "wouter";

const OrganizationSettingsDeletePage = () => {
  const slug = useOrganizationSlug();
  const query = useBaseOrganizationSettingsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Delete Organization" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsDeletePageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsDeletePageInnerProps {
  query: UseQueryResponse<
    BaseOrganizationSettingsPageQuery,
    Exact<BaseOrganizationSettingsPageQueryVariables>
  >;
}

const OrganizationSettingsDeletePageInner: FC<
  OrganizationSettingsDeletePageInnerProps
> = ({ query: [{ data }] }) => {
  const organization = data?.organizationBySlug!;
  const [, navigate] = useLocation();
  const [, deleteOrganization] = useDeleteOrganizationMutation();
  const [error, setError] = useState<CombinedError | null>(null);

  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });

  const { open, onOpen, onToggle } = useDisclosure();

  const handleDelete = useCallback(async () => {
    setError(null);
    try {
      await deleteOrganization({
        organizationId: organization.id,
      });
      publish();
      toast.success(`Organization '${organization.name}' successfully deleted`);
      navigate("/");
    } catch (e: any) {
      setError(e);
      return;
    }
  }, [
    deleteOrganization,
    navigate,
    organization.id,
    organization.name,
    publish,
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2">Delete Organization?</h1>
      {organization.currentUserIsOwner ? (
        <Alert
          variant="destructive"
          title={`Are you sure you want to delete '${organization.name}'?`}
        >
          <div className="stack-col items-start gap-2">
            <p>This action cannot be undone, be very careful.</p>
            <Button variant="destructive" onClick={onOpen}>
              Delete this organization
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert variant="destructive" title="You are not permitted to do this">
          Only the owner may delete the organization. If you cannot reach the
          owner, please get in touch with support.
        </Alert>
      )}

      {error ? <ErrorAlert error={error} /> : null}

      <Dialog open={open} onOpenChange={onToggle}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
          </DialogHeader>
          <DialogBody>
            This action cannot be undone, be very careful. Click delete to
            continue
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
            <Button variant="outline" onClick={onToggle}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrganizationSettingsDeletePage;
