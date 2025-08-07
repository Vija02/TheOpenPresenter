import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import { QueryResult } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Exact,
  OrganizationSettingsGeneralPageQuery,
  OrganizationSettingsGeneralPageQueryVariables,
  useOrganizationSettingsGeneralPageQuery,
  useUpdateOrganizationMutation,
} from "@repo/graphql";
import { extractError } from "@repo/lib";
import { Alert, Button, CheckboxControl, Form, InputControl } from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useLocation } from "wouter";
import * as z from "zod";

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

const formSchema = z.object({
  name: z.string().min(1, "Organization name must not be empty"),
  slug: z.string().min(2, "Slug must be at least 2 characters long"),
  isPublic: z.boolean().optional(),
});

type FormInputs = z.infer<typeof formSchema>;

const OrganizationSettingsIndexPageInner = ({ query }: PropTypes) => {
  const organization = query.data?.organizationBySlug!;
  const { name, slug, isPublic } = organization;
  const [, navigate] = useLocation();

  const [updateOrganization] = useUpdateOrganizationMutation();
  const [error, setError] = useState<Error | null>(null);

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug,
      name,
      isPublic: isPublic ?? false,
    },
  });

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
    [navigate, organization.id, organization.slug, updateOrganization],
  );

  const userHaveAccess =
    organization.currentUserIsBillingContact || organization.currentUserIsOwner;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="stack-col items-start gap-4"
      >
        <h1 className="text-2xl font-bold">General Settings</h1>
        <div className="stack-col items-start">
          {!userHaveAccess && (
            <Alert variant="warning" title="No access" className="mb-4">
              You must be an owner or the billing contact to edit these settings
            </Alert>
          )}

          <InputControl
            control={form.control}
            name="name"
            label="Name"
            disabled={!userHaveAccess}
            className="w-full"
          />

          <InputControl
            control={form.control}
            name="slug"
            label="Slug"
            disabled={!userHaveAccess}
            className="w-full"
          />

          <CheckboxControl
            control={form.control}
            name="isPublic"
            label="Is Public"
            disabled={!userHaveAccess}
          />

          {error ? (
            <Alert variant="destructive" title="Error updating organization">
              {extractError(error).message}
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="success"
            disabled={!userHaveAccess}
            isLoading={form.formState.isSubmitting}
          >
            Update organization
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default OrganizationSettingsIndexPage;
