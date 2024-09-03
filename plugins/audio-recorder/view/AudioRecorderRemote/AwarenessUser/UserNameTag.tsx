import { Badge, Stack, Text } from "@chakra-ui/react";
import { AwarenessUserData } from "@repo/base-plugin/client";

import { usePluginAPI } from "../../pluginApi";

const getStringFromUA = (ua: AwarenessUserData["userAgentInfo"]) => {
  return `${ua.browser.name} / ${ua.os.name}`;
};

type PropTypes = {
  user: AwarenessUserData;
};
export const UserNameTag = ({ user }: PropTypes) => {
  const pluginApi = usePluginAPI();
  const currentUserId = pluginApi.awareness.currentUserId;
  const userIsThisDevice = user.id === currentUserId;

  return (
    <>
      <Stack direction="row" alignItems="center">
        <Text fontSize="md" fontWeight="medium" lineHeight={1}>
          {getStringFromUA(user.userAgentInfo)}{" "}
        </Text>
        {user.userAgentInfo.device.type && (
          <Badge size="sm" colorScheme="orange" textTransform="uppercase">
            {user.userAgentInfo.device.type}
          </Badge>
        )}
        {userIsThisDevice && (
          <Badge size="sm" colorScheme="green">
            This device
          </Badge>
        )}
      </Stack>
    </>
  );
};
