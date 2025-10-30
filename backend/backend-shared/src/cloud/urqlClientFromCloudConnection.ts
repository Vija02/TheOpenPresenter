import { Client, cacheExchange, fetchExchange } from "urql";

export const getUrqlClientFromCloudConnection = (cloudConnection: any) => {
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
