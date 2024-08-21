import { Heading, Link, Text } from "@chakra-ui/react";

export function ErrorOccurred() {
  return (
    <div>
      <Heading>Something Went Wrong</Heading>
      <Text>
        We're not sure what happened there. Please try again later, or if this
        keeps happening then let us know.
      </Text>
      <Link href="/">Go to the homepage</Link>
    </div>
  );
}
