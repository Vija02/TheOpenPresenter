import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Heading,
  Image,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { VscSync } from "react-icons/vsc";

export interface ErrorAlertProps {
  error: Error;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const code: string | undefined = (error as any)?.networkError?.result
    ?.errors?.[0]?.code;
  if (code === "EBADCSRFTOKEN") {
    return (
      <VStack mt="15vh">
        <Image src="/svg/dead-emoji.svg" maxW="80px" />
        <Heading textAlign="center">Invalid CSRF token</Heading>
        <Text textAlign="center" color="subtitle">
          Our security protections have failed to authenticate your request; to
          solve this you need to refresh the page:
        </Text>
        <Button
          size="md"
          onClick={() => window.location.reload()}
          colorScheme="blue"
          leftIcon={<VscSync />}
        >
          Refresh page
        </Button>
      </VStack>
    );
  }

  return (
    <VStack mt="15vh">
      <Image src="/svg/dead-emoji.svg" maxW="80px" />
      <Heading textAlign="center">Unexpected error occurred</Heading>
      <Text textAlign="center" color="subtitle">
        We're really sorry, an unexpected error occurred. Please{" "}
        <Link href="/">return to the homepage</Link>
        and try again.
      </Text>
      <Box pb={3} />
      <Alert status="error" maxW="2xl">
        <AlertIcon />
        <AlertDescription display="block">{error.message}</AlertDescription>
      </Alert>
    </VStack>
  );
}
