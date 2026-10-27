import { Client, cacheExchange, fetchExchange } from "urql";

import { CLOUD_SYNC_ORIGIN_HEADER } from "./sync/queue";

interface CloudConnection {
  /** Sent as the sync's origin, so the cloud's hints of its writes skip us. */
  id?: string;
  session_cookie: string;
  host: string;
}

export const getUrqlClientFromCloudConnection = (
  cloudConnection: CloudConnection,
) => {
  const { id, session_cookie, host } = cloudConnection;

  const urqlClient = new Client({
    url: `${host}/graphql`,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: {
      headers: {
        "x-top-csrf-protection": "1",
        origin: host,
        Cookie: session_cookie,
        ...(id ? { [CLOUD_SYNC_ORIGIN_HEADER]: id } : {}),
      },
      method: "POST",
    },
    preferGetMethod: false,
  });

  return urqlClient;
};
