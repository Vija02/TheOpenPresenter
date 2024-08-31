import { Box, Text } from "@chakra-ui/react";
import { AwarenessUserData } from "@repo/base-plugin/client";

import { UserNameTag } from "./UserNameTag";

type PropTypes = {
  user: AwarenessUserData;
  onSelectUser: (userId: string) => void;
};
export const UserCard = ({ user, onSelectUser }: PropTypes) => {
  return (
    <Box
      onClick={() => {
        onSelectUser(user.id);
      }}
      cursor="pointer"
      _hover={{ bg: "gray.200" }}
      py={2}
      px={1}
    >
      <UserNameTag user={user} />
      <Text fontSize="xs" color="gray.700" textTransform="uppercase">
        {user.type}
      </Text>
    </Box>
  );
};
