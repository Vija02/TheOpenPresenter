import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { ApolloError } from "@apollo/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useJoinOrganizationIndexPageQuery,
  useRequestJoinToOrganizationMutation,
  useResendEmailVerificationMutation,
  useSearchPublicOrganizationsQuery,
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
  Input,
  Link,
} from "@repo/ui";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { useDebounce } from "use-debounce";
import { Link as WouterLink } from "wouter";
import * as z from "zod";

const formSchema = z.object({
  selectedOrgId: z.string().min(1, "Please select an organization"),
});

type FormInputs = z.infer<typeof formSchema>;

const JoinOrganizationPage = () => {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useJoinOrganizationIndexPageQuery();

  const code = getCodeFromError(error);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 200);

  const [done, setDone] = useState(false);

  const [requestJoinToOrganization] = useRequestJoinToOrganizationMutation();
  const [resendEmailVerification] = useResendEmailVerificationMutation();

  const { data: publicOrganizations } = useSearchPublicOrganizationsQuery({
    returnPartialData: true,
    variables: { search: debouncedSearch },
    skip: debouncedSearch === "",
  });

  const userIsVerified = useMemo(
    () => query.data?.currentUser?.isVerified ?? true,
    [query.data?.currentUser?.isVerified],
  );

  const form = useForm<FormInputs>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedOrgId: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        await requestJoinToOrganization({
          variables: { organizationId: values.selectedOrgId },
        });
        setError(null);
        setDone(true);
      } catch (e: any) {
        setError(e);
      }
    },
    [requestJoinToOrganization],
  );

  if (done) {
    return (
      <SharedLayoutLoggedIn title="Join organization" query={query}>
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl font-bold mb-0">Request sent</h1>
          <FaCheck fontSize="24px" color="#38A169" />
        </div>

        <p>You'll get an email letting you know if your request was approved</p>
      </SharedLayoutLoggedIn>
    );
  }

  return (
    <SharedLayoutLoggedIn title="Join organization" query={query}>
      {!userIsVerified && (
        <>
          <h1 className="text-2xl font-bold mb-4">Join organization</h1>
          <Alert
            variant="warning"
            title="Verify your email address to continue"
          >
            <div>
              <p>
                In order to join an organization, we require you to verify your
                account. <br />
                Please check your inbox for a verification email. Once verified,
                simply refresh this page to continue.
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={() => {
                  resendEmailVerification({
                    variables: {
                      emailId: query.data?.currentUser?.userEmails.nodes[0]?.id,
                    },
                    onCompleted: () => {
                      toast.success("Verification email has been sent!");
                    },
                  });
                }}
              >
                Resend verification
              </Button>
            </div>
          </Alert>
        </>
      )}
      {userIsVerified && (
        <div className="w-full block lg:grid lg:grid-cols-[1fr_300px] gap-4">
          <div className="max-w-xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="stack-col items-start">
                  <h1 className="text-2xl font-bold">Join organization</h1>
                  <p>Search for an organization to join:</p>

                  <Input
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                    placeholder="Search organizations..."
                  />

                  {publicOrganizations?.organizationsPublicSearch?.nodes
                    .length === 0 && <p>No organization found.</p>}
                  <div className="w-full">
                    {publicOrganizations?.organizationsPublicSearch?.nodes.map(
                      (org, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            form.setValue("selectedOrgId", org.id);
                          }}
                          className={`w-full cursor-pointer py-1 px-1 hover:bg-gray-100 ${
                            form.watch("selectedOrgId") === org.id
                              ? "bg-gray-200"
                              : "bg-transparent"
                          }`}
                        >
                          <p>{org.name}</p>
                        </div>
                      ),
                    )}
                  </div>

                  {error ? (
                    <Alert
                      variant="destructive"
                      title="Error: Failed to request to join organization"
                    >
                      {code === "NUNIQ" ? (
                        <span data-cy="joinorganization-alert-nuniq">
                          You are already a member of this organization.
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
                    </Alert>
                  ) : null}

                  <div className="stack-row items-center flex-wrap">
                    <Button
                      type="submit"
                      variant="success"
                      data-cy="joinorganization-submit-button"
                      disabled={form.watch("selectedOrgId") === ""}
                      isLoading={form.formState.isSubmitting}
                    >
                      Request to join organization
                    </Button>
                    <Link asChild>
                      <WouterLink href="/org/create-organization">
                        <Button variant="link" size="sm">
                          Alternatively, create a new organization
                        </Button>
                      </WouterLink>
                    </Link>
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
                  Why can't I find the organization I'm looking for?
                </AccordionTrigger>
                <AccordionContent>
                  You can only find public organization here. If it is private,
                  the admin of the organization will have to invite you
                  directly.
                  <br />
                  <br />
                  If you are an organization owner, you can change the
                  visibility of your organization through the settings page.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  What does it mean to join an organization?
                </AccordionTrigger>
                <AccordionContent>
                  Every project/presentation in TheOpenPresenter lives within an
                  organization. Don't worry, it's mostly used to group your
                  projects together in a way that makes sense.
                  <br />
                  <br />
                  Joining an existing organization allows you to access
                  everything in that organization, allowing you present their
                  presentation and collaborate on them.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      )}
    </SharedLayoutLoggedIn>
  );
};

export default JoinOrganizationPage;
