import { Center, Link, Text, VStack } from "@chakra-ui/react";
import type { User } from "@repo/graphql";

interface FourOhFourProps {
  currentUser?: Pick<User, "id"> | null;
}
export function FourOhFour(props: FourOhFourProps) {
  const { currentUser } = props;
  return (
    <div data-cy="fourohfour-div">
      <Center mt="15vh">
        <VStack>
          <Text fontSize={60}>404</Text>
          <Text>
            The page you attempted to load was not found.{" "}
            {currentUser ? "" : " Maybe you need to log in?"}
          </Text>

          <Link href="/">Back to Home</Link>
        </VStack>
      </Center>
    </div>
  );
}
