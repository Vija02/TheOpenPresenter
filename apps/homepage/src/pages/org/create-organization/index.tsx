import { Redirect } from "@/components/Redirect";
import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { ApolloError } from "@apollo/client";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Heading,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  CreatedOrganizationFragment,
  useCreateOrganizationMutation,
  useOrganizationBySlugQuery,
  useSharedQuery,
} from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Form, Formik, useFormikContext } from "formik";
import { InputControl, SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import NextLink from "next/link";
import { useCallback, useState } from "react";
import slugify from "slugify";
import { useDebounce } from "use-debounce";
import * as Yup from "yup";

const validationSchema = Yup.object({
  name: Yup.string().required("Please choose a name for the organization"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const CreateOrganizationPage: NextPage = () => {
  const [error, setError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();

  const code = getCodeFromError(error);
  const [organization, setOrganization] =
    useState<null | CreatedOrganizationFragment>(null);
  const [createOrganization] = useCreateOrganizationMutation();

  const onSubmit = useCallback(
    async (values: FormInputs) => {
      setError(null);
      try {
        const { name } = values;
        const slug = slugify(name || "", {
          lower: true,
        });
        const { data } = await createOrganization({
          variables: {
            name,
            slug,
          },
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
    return (
      <Redirect layout href={`/o/[slug]`} as={`/o/${organization.slug}`} />
    );
  }

  return (
    <SharedLayoutLoggedIn
      title="Create organization"
      query={query}
    >
      <Box
        w="100%"
        display={{ base: "block", md: "grid" }}
        gridTemplateColumns="1fr 300px"
      >
        <Box maxW="lg">
          <Formik
            initialValues={{ name: "" }}
            onSubmit={onSubmit}
            validationSchema={validationSchema}
          >
            {({ handleSubmit }) => (
              <Form onSubmit={handleSubmit as any}>
                <VStack alignItems="flex-start">
                  <Heading>Create organization</Heading>
                  <Text>
                    Just one last step! After that you can start presenting.
                  </Text>

                  <InputControl
                    name="name"
                    label="Name"
                    inputProps={{
                      // @ts-ignore
                      "data-cy": "createorganization-input-name",
                    }}
                  />

                  <SlugCheck />

                  {error ? (
                    <Alert status="error">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle mr={2}>
                          Error: Failed to create organization
                        </AlertTitle>
                        <AlertDescription display="block">
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
                        </AlertDescription>
                      </Box>
                    </Alert>
                  ) : null}

                  <Stack direction="row" alignItems="center">
                    <SubmitButton
                      colorScheme="green"
                      data-cy="createorganization-submit-button"
                    >
                      Create organization
                    </SubmitButton>
                    <NextLink href="/org/join-organization">
                      <Button variant="link" size="sm">
                        Alternatively, Join an existing organization
                      </Button>
                    </NextLink>
                  </Stack>
                </VStack>
              </Form>
            )}
          </Formik>
        </Box>
        <Box mt={{ base: 10, md: 0 }}>
          <Heading>FAQ</Heading>
          <Accordion defaultIndex={[0]} allowMultiple>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    Why do I need to create an organization?
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                Every project/presentation in TheOpenPresenter lives within an
                organization. It's mostly used to group your projects together
                in a way that makes sense.
                <br />
                <br />
                You can change the details of an organization after its
                creation, so don't worry about getting it right the first time.
              </AccordionPanel>
            </AccordionItem>

            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box as="span" flex="1" textAlign="left">
                    How can I join an existing organization?
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                If you are working with an existing organization, you probably
                want to join their organization before starting. This will allow
                you to access all existing and newly created projects.
                <br />
                <br />
                The owner of your organization is able to invite you directly.
                Alternatively, you can request to join the organization by
                clicking on the "Join an existing organization" button.
                <br />
                Note: You can only do this for public organizations.
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Box>
      </Box>
    </SharedLayoutLoggedIn>
  );
};

export default CreateOrganizationPage;

const SlugCheck = () => {
  const formik = useFormikContext<FormInputs>();

  const slug = slugify(formik.values.name || "", {
    lower: true,
  });
  const [debouncedSlug] = useDebounce(slug, 500);

  // TODO: Check slug of orgs by other user too
  const { data: existingOrganizationData, error: slugError } =
    useOrganizationBySlugQuery({
      variables: {
        slug: debouncedSlug,
      },
      skip: debouncedSlug === "",
    });

  return (
    <>
      <p>
        Your organization URL will be{" "}
        <span data-cy="createorganization-slug-value">{`${process.env.NEXT_PUBLIC_ROOT_URL}/o/${slug}`}</span>
      </p>

      {existingOrganizationData?.organizationBySlug && (
        <Text color="red.400" data-cy="createorganization-hint-nameinuse">
          Organization name is already in use
        </Text>
      )}

      {slugError && (
        <Text color="red.400">
          Error occurred checking for existing organization with this name
          (error code: ERR_{getCodeFromError(slugError)})
        </Text>
      )}
    </>
  );
};
