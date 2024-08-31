import { Stack } from "@chakra-ui/react";
import _ from "lodash";

import { pluginApi } from "../../pluginApi";
import { UserCard } from "./UserCard";

type PropTypes = {
  onSelectUser: (userId: string) => void;
};
export const UserSourceSelector = ({ onSelectUser }: PropTypes) => {
  const awarenessData = pluginApi.awareness.useAwarenessData();

  return (
    <>
      <Stack gap={0}>
        {_.sortBy(awarenessData, "user.type").map((state) => (
          <UserCard
            key={state.user.id}
            user={state.user}
            onSelectUser={(id) => {
              onSelectUser(id);
            }}
          />
        ))}
      </Stack>
    </>
  );
};
