import { AwarenessUserData } from "@repo/base-plugin/client";

import { UserNameTag } from "./UserNameTag";

type PropTypes = {
  user: AwarenessUserData;
  onSelectUser: (userId: string) => void;
};
export const UserCard = ({ user, onSelectUser }: PropTypes) => {
  return (
    <div
      className="cursor-pointer hover:bg-surface-primary-hover py-2 px-1"
      onClick={() => {
        onSelectUser(user.id);
      }}
    >
      <UserNameTag user={user} />
      <p className="text-xs text-secondary uppercase">{user.type}</p>
    </div>
  );
};
