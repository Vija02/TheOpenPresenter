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
  Flex,
  Heading,
  Input,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  useJoinOrganizationIndexPageQuery,
  useRequestJoinToOrganizationMutation,
  useResendEmailVerificationMutation,
  useSearchPublicOrganizationsQuery,
} from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { Form, Formik } from "formik";
import { SubmitButton } from "formik-chakra-ui";
import { NextPage } from "next";
import NextLink from "next/link";
import { useCallback, useState } from "react";
import { FaCheck } from "react-icons/fa";
import { toast } from "react-toastify";
import { useDebounce } from "use-debounce";
import * as Yup from "yup";

const validationSchema = Yup.object({
  selectedOrgId: Yup.string().required("Please select an organization"),
});
type FormInputs = Yup.InferType<typeof validationSchema>;

const JoinOrganizationPage: NextPage = () => {
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

  const userIsVerified = query.data?.currentUser?.isVerified;

  const onSubmit = useCallback(async (values: FormInputs) => {
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
  }, []);

  if (done) {
    return (
      <SharedLayoutLoggedIn title="Join organization" query={query}>
        <Flex alignItems="center" gap={2} mb={3}>
          <Heading mb={0}>Request sent</Heading>
          <FaCheck fontSize="24px" color="#38A169" />
        </Flex>

        <Text>
          You’ll get an email letting you know if your request was approved
        </Text>
      </SharedLayoutLoggedIn>
    );
  }

  return (
    <SharedLayoutLoggedIn title="Join organization" query={query}>
      {!userIsVerified && (
        <>
          <Heading>Join organization</Heading>
          <Alert status="error">
            <AlertIcon />
            <Box>
              <AlertTitle>Verify your email address to continue</AlertTitle>
              <AlertDescription>
                <Text>
                  In order to join an organization, we require you to verify
                  your account. <br />
                  Please check your inbox for a verification email. Once
                  verified, simply refresh this page to continue.
                </Text>
                <Button
                  mt={2}
                  size="sm"
                  variant="outline"
                  colorScheme="orange"
                  onClick={() => {
                    resendEmailVerification({
                      variables: {
                        emailId:
                          query.data?.currentUser?.userEmails.nodes[0]?.id,
                      },
                      onCompleted: () => {
                        toast.success("Verification email has been sent!");
                      },
                    });
                  }}
                >
                  Resend verification
                </Button>
              </AlertDescription>
            </Box>
          </Alert>
        </>
      )}
      {userIsVerified && (
        <Box
          w="100%"
          display={{ base: "block", md: "grid" }}
          gridTemplateColumns="1fr 300px"
        >
          <Box maxW="lg">
            <Formik
              initialValues={{ selectedOrgId: "" }}
              onSubmit={onSubmit}
              validationSchema={validationSchema}
            >
              {({ handleSubmit, values, setFieldValue }) => (
                <Form onSubmit={handleSubmit as any}>
                  <VStack alignItems="flex-start">
                    <Heading>Join organization</Heading>
                    <Text>Search for an organization to join:</Text>

                    <Input
                      onChange={(e) => {
                        setSearch(e.target.value);
                      }}
                    />

                    {publicOrganizations?.organizationsPublicSearch?.nodes
                      .length === 0 && <Text>No organization found.</Text>}
                    <Box width="100%">
                      {publicOrganizations?.organizationsPublicSearch?.nodes.map(
                        (org, i) => (
                          <Box
                            key={i}
                            onClick={() => {
                              setFieldValue("selectedOrgId", org.id);
                            }}
                            width="100%"
                            cursor="pointer"
                            py={1}
                            px={1}
                            bg={
                              values["selectedOrgId"] === org.id
                                ? "gray.200"
                                : "transparent"
                            }
                            _hover={{ bg: "gray.100" }}
                          >
                            <Text>{org.name}</Text>
                          </Box>
                        ),
                      )}
                    </Box>

                    {error ? (
                      <Alert status="error">
                        <AlertIcon />
                        <Box flex="1">
                          <AlertTitle mr={2}>
                            Error: Failed to request to join organization
                          </AlertTitle>
                          <AlertDescription display="block">
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
                          </AlertDescription>
                        </Box>
                      </Alert>
                    ) : null}

                    <Stack direction="row" alignItems="center">
                      <SubmitButton
                        colorScheme="green"
                        data-cy="joinorganization-submit-button"
                        isDisabled={values.selectedOrgId === ""}
                      >
                        Request to join organization
                      </SubmitButton>
                      <NextLink href="/org/create-organization">
                        <Button variant="link" size="sm">
                          Alternatively, create a new organization
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
                      Why can't I find the organization I'm looking for?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  You can only find public organization here. If it is private,
                  the admin of the organization will have to invite you
                  directly.
                  <br />
                  <br />
                  If you are an organization owner, you can change the
                  visibility of your organization through the settings page.
                </AccordionPanel>
              </AccordionItem>
              <AccordionItem>
                <h2>
                  <AccordionButton>
                    <Box as="span" flex="1" textAlign="left">
                      What does it mean to join an organization?
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                </h2>
                <AccordionPanel pb={4}>
                  Every project/presentation in TheOpenPresenter lives within an
                  organization. Don't worry, it's mostly used to group your
                  projects together in a way that makes sense.
                  <br />
                  <br />
                  Joining an existing organization allows you to access
                  everything in that organization, allowing you present their
                  presentation and collaborate on them.
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Box>
        </Box>
      )}
    </SharedLayoutLoggedIn>
  );
};

export default JoinOrganizationPage;
