import { Stack } from "@chakra-ui/react";
import { sortBy } from "lodash-es";

import { usePluginAPI } from "../../pluginApi";
import { UserCard } from "./UserCard";

type PropTypes = {
  onSelectUser: (userId: string) => void;
};
export const UserSourceSelector = ({ onSelectUser }: PropTypes) => {
  const pluginApi = usePluginAPI();
  const awarenessData = pluginApi.awareness.useAwarenessData();

  return (
    <>
      <Stack gap={0}>
        {sortBy(awarenessData, "user.type").map((state) =>
          state.user ? (
            <UserCard
              key={state.user.id}
              user={state.user}
              onSelectUser={(id) => {
                onSelectUser(id);
              }}
            />
          ) : null,
        )}
      </Stack>
    </>
  );
};
