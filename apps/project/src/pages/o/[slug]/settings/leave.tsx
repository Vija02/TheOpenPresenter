import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { ApolloError, QueryResult } from "@apollo/client";
import {
  BaseOrganizationSettingsPageQuery,
  BaseOrganizationSettingsPageQueryVariables,
  Exact,
  useBaseOrganizationSettingsPageQuery,
  useRemoveFromOrganizationMutation,
} from "@repo/graphql";
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
import { useLocation } from "wouter";

const OrganizationSettingsLeavePage = () => {
  const slug = useOrganizationSlug();
  const query = useBaseOrganizationSettingsPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Leave Organization" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsLeavePageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

interface OrganizationSettingsLeavePageInnerProps {
  query: QueryResult<
    BaseOrganizationSettingsPageQuery,
    Exact<BaseOrganizationSettingsPageQueryVariables>
  >;
}

const OrganizationSettingsLeavePageInner: FC<
  OrganizationSettingsLeavePageInnerProps
> = ({ query }) => {
  const organization = query.data?.organizationBySlug!;
  const [, navigate] = useLocation();
  const [error, setError] = useState<ApolloError | null>(null);

  const { open, onOpen, onToggle } = useDisclosure();

  const [removeMember] = useRemoveFromOrganizationMutation();
  const handleRemove = useCallback(async () => {
    setError(null);
    try {
      await removeMember({
        variables: {
          organizationId: organization.id,
          userId: query.data?.currentUser?.id,
        },
      });
      toast.success(`Successfully left '${organization.name}'`);
      navigate("/");
    } catch (e: any) {
      setError(e);
      toast.error("Error occurred when leaving: " + e.message);
    }
  }, [
    navigate,
    organization.id,
    organization.name,
    query.data?.currentUser?.id,
    removeMember,
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2">Leave Organization?</h1>

      {organization.currentUserIsOwner ? (
        <Alert variant="destructive" title="You are not permitted to do this">
          You cannot leave the organization as the owner of this organization.
        </Alert>
      ) : (
        <Alert
          variant="destructive"
          title={`Are you sure you want to leave '${organization.name}'?`}
        >
          <div className="stack-col items-start gap-2">
            <Button variant="destructive" onClick={onOpen}>
              Leave this organization
            </Button>
          </div>
        </Alert>
      )}

      {error ? <ErrorAlert error={error} /> : null}

      <Dialog open={open} onOpenChange={onToggle}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
          </DialogHeader>
          <DialogBody>
            This action cannot be undone. Click Leave to continue
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive" onClick={handleRemove}>
              Leave
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

export default OrganizationSettingsLeavePage;
