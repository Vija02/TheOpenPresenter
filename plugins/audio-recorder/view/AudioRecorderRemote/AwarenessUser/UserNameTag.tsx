import { AwarenessUserData } from "@repo/base-plugin/client";
import { Badge } from "@repo/ui";

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
      <div className="stack-row">
        <p className="text-md font-medium leading-none">
          {getStringFromUA(user.userAgentInfo)}{" "}
        </p>
        {user.userAgentInfo.device.type && (
          <Badge size="sm" variant="warning" className="uppercase">
            {user.userAgentInfo.device.type}
          </Badge>
        )}
        {userIsThisDevice && (
          <Badge size="sm" variant="success">
            This device
          </Badge>
        )}
      </div>
    </>
  );
};
