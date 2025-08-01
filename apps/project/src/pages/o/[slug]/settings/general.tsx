import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { QueryResult } from "@apollo/client";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Heading,
  VStack,
} from "@chakra-ui/react";
import {
  Exact,
  OrganizationSettingsGeneralPageQuery,
  OrganizationSettingsGeneralPageQueryVariables,
  useOrganizationSettingsGeneralPageQuery,
  useUpdateOrganizationMutation,
} from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Form, Formik } from "formik";
import {
  CheckboxSingleControl,
  InputControl,
  SubmitButton,
} from "formik-chakra-ui";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { useLocation } from "wouter";
import * as Yup from "yup";

const OrganizationSettingsIndexPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationSettingsGeneralPageQuery({
    variables: { slug },
  });

  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Organization Settings" sharedOrgQuery={query}>
      {organizationLoadingElement || (
        <OrganizationSettingsIndexPageInner query={query} />
      )}
    </SharedOrgLayout>
  );
};

type PropTypes = {
  query: QueryResult<
    OrganizationSettingsGeneralPageQuery,
    Exact<OrganizationSettingsGeneralPageQueryVariables>
  >;
};

const validationSchema = Yup.object({
  name: Yup.string()
    .min(1, "Organization name must not be empty")
    .required("Organization name is required"),
  slug: Yup.string()
    .min(2, "Slug must be at least 2 characters long")
    .required("Slug is required"),
  isPublic: Yup.bool(),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const OrganizationSettingsIndexPageInner = ({ query }: PropTypes) => {
  const organization = query.data?.organizationBySlug!;
  const { name, slug, isPublic } = organization;
  const [, navigate] = useLocation();

  const [updateOrganization] = useUpdateOrganizationMutation();
  const [error, setError] = useState<Error | null>(null);
  const onSubmit = useCallback(
    async (values: FormInputs) => {
      try {
        setError(null);
        const { data } = await updateOrganization({
          variables: {
            input: {
              id: organization.id,
              patch: {
                slug: values.slug,
                name: values.name,
                isPublic: values.isPublic,
              },
            },
          },
        });
        toast.success("Organization updated");
        const newSlug = data?.updateOrganization?.organization?.slug;
        if (newSlug && newSlug !== organization.slug) {
          navigate(`/o/${newSlug}/settings`);
        }
      } catch (e: any) {
        setError(e);
      }
    },
    [organization.id, organization.slug, updateOrganization],
  );

  const userHaveAccess =
    organization.currentUserIsBillingContact || organization.currentUserIsOwner;

  return (
    <Formik
      initialValues={{ slug, name, isPublic: isPublic ?? false }}
      onSubmit={onSubmit}
      validationSchema={validationSchema}
    >
      {({ handleSubmit }) => (
        <Form onSubmit={handleSubmit as any}>
          <Heading>General Settings</Heading>
          <VStack alignItems="flex-start">
            {!userHaveAccess && (
              <Alert>
                <AlertIcon />
                <AlertDescription mr={2}>
                  You must be an owner or the billing contact to edit these
                  settings
                </AlertDescription>
              </Alert>
            )}
            <InputControl
              name="name"
              label="Name"
              inputProps={{ isDisabled: !userHaveAccess }}
            />
            <InputControl
              name="slug"
              label="Slug"
              inputProps={{ isDisabled: !userHaveAccess }}
            />
            <CheckboxSingleControl
              name="isPublic"
              label="Is Public"
              checkBoxProps={{ isDisabled: !userHaveAccess }}
            />

            {error ? (
              <Alert status="error">
                <AlertIcon />
                <Box flex="1">
                  <AlertTitle mr={2}>Error updating organization</AlertTitle>
                  <AlertDescription display="block">
                    {extractError(error).message}
                  </AlertDescription>
                </Box>
              </Alert>
            ) : null}

            <SubmitButton colorScheme="green" isDisabled={!userHaveAccess}>
              Update organization
            </SubmitButton>
          </VStack>
        </Form>
      )}
    </Formik>
  );
};

export default OrganizationSettingsIndexPage;
