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
      <div className="flex flex-col">
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
      </div>
    </>
  );
};
