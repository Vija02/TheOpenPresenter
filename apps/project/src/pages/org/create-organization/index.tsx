import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreatedOrganizationFragment,
  useCreateOrganizationMutation,
  useOrganizationBySlugQuery,
  useSharedQuery,
} from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Button,
  Form,
  InputControl,
} from "@repo/ui";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import slugify from "slugify";
import { CombinedError } from "urql";
import { useDebounce } from "use-debounce";
import { Link as WouterLink } from "wouter";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Please choose a name for the organization"),
});
type FormInputs = z.infer<typeof formSchema>;

const CreateOrganizationPage = () => {
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const query = useSharedQuery();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  const code = getCodeFromError(error);
  const [organization, setOrganization] =
    useState<null | CreatedOrganizationFragment>(null);
  const [, createOrganization] = useCreateOrganizationMutation();

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        const { name } = values;
        const slug = slugify(name || "", {
          lower: true,
        });
        const { data } = await createOrganization({
          name,
          slug,
        });
        setError(null);
        setOrganization(data?.createOrganization?.organization || null);
      } catch (e: any) {
        setError(e);
      }
    },
    [createOrganization],
  );

  if (organization) {
    return <Redirect layout href={`/o/${organization.slug}`} />;
  }

  return (
    <SharedLayoutLoggedIn title="Create organization" query={query}>
      <div className="w-full grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="stack-col items-start">
                <h1 className="text-2xl font-bold">Create organization</h1>
                <p>Just one last step! After that you can start presenting.</p>

                <InputControl
                  control={form.control}
                  name="name"
                  label="Name"
                  data-cy="createorganization-input-name"
                />

                <SlugCheck name={form.watch("name")} />

                {error ? (
                  <Alert
                    variant="destructive"
                    title="Error: Failed to create organization"
                  >
                    <div className="block">
                      {code === "NUNIQ" ? (
                        <span data-cy="createorganization-alert-nuniq">
                          That organization name is already in use, please
                          choose a different organization name.
                        </span>
                      ) : (
                        extractError(error).message
                      )}
                      {code ? (
                        <span>
                          {" "}
                          (Error code: <code>ERR_{code}</code>)
                        </span>
                      ) : null}
                    </div>
                  </Alert>
                ) : null}

                <div className="stack-row items-center flex-wrap">
                  <Button
                    type="submit"
                    variant="success"
                    data-cy="createorganization-submit-button"
                    isLoading={form.formState.isSubmitting}
                  >
                    Create organization
                  </Button>
                  <WouterLink href="/org/join-organization">
                    <Button variant="link" size="sm">
                      Alternatively, Join an existing organization
                    </Button>
                  </WouterLink>
                </div>
              </div>
            </form>
          </Form>
        </div>
        <div className="mt-5 lg:mt-0">
          <h2 className="text-xl font-bold">FAQ</h2>
          <Accordion type="multiple" defaultValue={["item-1"]}>
            <AccordionItem value="item-1">
              <AccordionTrigger>
                Why do I need to create an organization?
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Every project/presentation in TheOpenPresenter lives within an
                  organization. It's mostly used to group your projects together
                  in a way that makes sense.
                </p>
                <br />
                <p>
                  You can change the details of an organization after its
                  creation, so don't worry about getting it right the first
                  time.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>
                How can I join an existing organization?
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  If you are working with an existing organization, you probably
                  want to join their organization before starting. This will
                  allow you to access all existing and newly created projects.
                </p>
                <br />
                <p>
                  The owner of your organization is able to invite you directly.
                  Alternatively, you can request to join the organization by
                  clicking on the "Join an existing organization" button.
                </p>
                <br />
                <p>Note: You can only do this for public organizations.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </SharedLayoutLoggedIn>
  );
};

const SlugCheck = ({ name }: { name: string }) => {
  const slug = slugify(name || "", {
    lower: true,
  });
  const [debouncedSlug] = useDebounce(slug, 500);

  // TODO: Check slug of orgs by other user too
  const [{ data: existingOrganizationData, error: slugError }] =
    useOrganizationBySlugQuery({
      variables: {
        slug: debouncedSlug,
      },
      pause: debouncedSlug === "",
    });

  return (
    <>
      <p>
        Your organization URL will be{" "}
        <span data-cy="createorganization-slug-value">{`${window.location.origin}/o/${slug}`}</span>
      </p>

      {existingOrganizationData?.organizationBySlug && (
        <p className="text-red-500" data-cy="createorganization-hint-nameinuse">
          Organization name is already in use
        </p>
      )}

      {slugError && (
        <p className="text-red-500">
          Error occurred checking for existing organization with this name
          (error code: ERR_{getCodeFromError(slugError)})
        </p>
      )}
    </>
  );
};

export default CreateOrganizationPage;
