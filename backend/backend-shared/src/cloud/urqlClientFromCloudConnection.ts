import { Client, cacheExchange, fetchExchange } from "urql";

interface CloudConnection {
  session_cookie: string;
  host: string;
}

export const getUrqlClientFromCloudConnection = (
  cloudConnection: CloudConnection,
) => {
  const { session_cookie, host } = cloudConnection;

  const urqlClient = new Client({
    url: `${host}/graphql`,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: {
      headers: {
        "x-top-csrf-protection": "1",
        origin: host,
        Cookie: session_cookie,
      },
      method: "POST",
    },
    preferGetMethod: false,
  });

  return urqlClient;
};
