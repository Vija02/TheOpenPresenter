import { QueryResult } from "@apollo/client";
import {
  Button,
  Flex,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Tr,
} from "@chakra-ui/react";
import {
  Exact,
  OrganizationSettingsMembersPageQuery,
  OrganizationSettingsMembersPageQueryVariables,
  OrganizationSettingsMembers_MembershipFragment,
  useRemoveFromOrganizationMutation,
  useTransferOrganizationBillingContactMutation,
  useTransferOrganizationOwnershipMutation,
} from "@repo/graphql";
import { Pagination, PopConfirm } from "@repo/ui";
import { FC, useCallback, useMemo } from "react";
import { toast } from "react-toastify";

// This needs to match the `first:` used in Members.graphql
const RESULTS_PER_PAGE = 10;

type PropTypes = {
  query: QueryResult<
    OrganizationSettingsMembersPageQuery,
    Exact<OrganizationSettingsMembersPageQueryVariables>
  >;
  page: number;
  setPage: (newPage: number) => void;
};

export default function ExistingMembers({ query, page, setPage }: PropTypes) {
  const organization = query.data?.organizationBySlug!;

  const handlePaginationChange = useCallback(
    ({ selected }: { selected: number }) => {
      setPage(selected);
    },
    [setPage],
  );

  const renderItem = useCallback(
    (node: OrganizationSettingsMembers_MembershipFragment) => (
      <OrganizationMemberListItem key={node.id} node={node} query={query} />
    ),
    [query],
  );

  const pageCount = useMemo(
    () =>
      Math.ceil(
        organization.organizationMemberships?.totalCount / RESULTS_PER_PAGE,
      ),
    [organization.organizationMemberships?.totalCount],
  );

  return (
    <>
      <Table variant="simple">
        <Tbody>
          {(organization.organizationMemberships?.nodes ?? []).map(renderItem)}
        </Tbody>
      </Table>
      {pageCount > 1 && (
        <Flex justifyContent="center" mt={3}>
          <Pagination
            pageCount={pageCount}
            forcePage={page}
            onPageChange={handlePaginationChange}
          />
        </Flex>
      )}
    </>
  );
}

interface OrganizationMemberListItemProps {
  node: OrganizationSettingsMembers_MembershipFragment;
  query: QueryResult<
    OrganizationSettingsMembersPageQuery,
    Exact<OrganizationSettingsMembersPageQueryVariables>
  >;
}

const OrganizationMemberListItem: FC<OrganizationMemberListItemProps> = (
  props,
) => {
  const { node, query } = props;

  const organization = query.data?.organizationBySlug!;
  const currentUser = query.data?.currentUser;

  const [removeMember] = useRemoveFromOrganizationMutation();
  const handleRemove = useCallback(async () => {
    try {
      await removeMember({
        variables: {
          organizationId: organization.id,
          userId: node.user?.id ?? 0,
        },
        refetchQueries: ["OrganizationSettingsMembersPage"],
      });
    } catch (e: any) {
      toast.error("Error occurred when removing member: " + e.message);
    }
  }, [node.user, organization.id, removeMember]);

  const [transferOwnership] = useTransferOrganizationOwnershipMutation();
  const handleTransfer = useCallback(async () => {
    try {
      await transferOwnership({
        variables: {
          organizationId: organization.id,
          userId: node.user?.id ?? 0,
        },
        refetchQueries: ["OrganizationSettingsMembersPage"],
      });
    } catch (e: any) {
      toast.error("Error occurred when transferring ownership: " + e.message);
    }
  }, [node.user, organization.id, transferOwnership]);

  const [transferBilling] = useTransferOrganizationBillingContactMutation();
  const handleBillingTransfer = useCallback(async () => {
    try {
      await transferBilling({
        variables: {
          organizationId: organization.id,
          userId: node.user?.id ?? 0,
        },
        refetchQueries: ["OrganizationSettingsMembersPage"],
      });
    } catch (e: any) {
      toast.error(
        "Error occurred when transferring billing contact: " + e.message,
      );
    }
  }, [node.user, organization.id, transferBilling]);

  const roles = [
    node.isOwner ? "owner" : null,
    node.isBillingContact ? "billing contact" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  return (
    <Tr>
      <Td>
        <Text>
          {node.user?.name}{" "}
          <Text as="span" color="gray.500">
            ({node.user?.username})
          </Text>
        </Text>

        {roles && <Text color="subtitle">({roles})</Text>}
      </Td>
      <Td>
        <HStack justifyContent="flex-end" spacing={3}>
          {organization.currentUserIsOwner &&
          node.user?.id !== currentUser?.id ? (
            <PopConfirm
              title={`Are you sure you want to remove ${node.user?.name} from ${organization.name}?`}
              onConfirm={handleRemove}
              okText="Yes"
              cancelText="No"
              key="remove"
            >
              <Button size="sm" variant="link">
                Remove
              </Button>
            </PopConfirm>
          ) : null}

          {organization.currentUserIsOwner &&
          node.user?.id !== currentUser?.id ? (
            <PopConfirm
              title={`Are you sure you want to transfer ownership of ${organization.name} to ${node.user?.name}?`}
              onConfirm={handleTransfer}
              okText="Yes"
              cancelText="No"
              key="transfer"
            >
              <Button size="sm" variant="link">
                Make owner
              </Button>
            </PopConfirm>
          ) : null}

          {organization.currentUserIsOwner && !node.isBillingContact ? (
            <PopConfirm
              title={`Are you sure you want to make ${node.user?.name} the billing contact for ${organization.name}?`}
              onConfirm={handleBillingTransfer}
              okText="Yes"
              cancelText="No"
              key="billingTransfer"
            >
              <Button size="sm" variant="link">
                Make billing contact
              </Button>
            </PopConfirm>
          ) : null}
        </HStack>
      </Td>
    </Tr>
  );
};
