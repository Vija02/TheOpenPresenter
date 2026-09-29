import { net } from "electron";

import { cloudSessionCookie } from "./auth";

/** An organization on the cloud server the user signed in to. */
export type CloudOrganization = {
  slug: string;
  name: string;
};

/**
 * Ask the cloud which organizations this session can see
 */
export async function cloudOrganizations(
  cloudUrl: string,
): Promise<CloudOrganization[]> {
  const session = await cloudSessionCookie(cloudUrl);
  if (!session) {
    throw new Error("Sign in to the cloud first.");
  }

  const response = await net.fetch(`${cloudUrl.replace(/\/+$/, "")}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-top-csrf-protection": "1",
      Cookie: session.cookie,
    },
    body: JSON.stringify({
      query: `query {
        currentUser {
          organizationMemberships(first: 50) {
            nodes { organization { slug name } }
          }
        }
      }`,
    }),
  });

  const text = await response.text();
  let parsed: {
    data?: {
      currentUser?: {
        organizationMemberships: {
          nodes: { organization: CloudOrganization | null }[];
        };
      } | null;
    };
    errors?: { message: string }[];
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`The cloud returned ${response.status}`);
  }

  if (parsed.errors?.length) throw new Error(parsed.errors[0].message);

  return (parsed.data?.currentUser?.organizationMemberships?.nodes ?? [])
    .map((n) => n.organization)
    .filter((o): o is CloudOrganization => Boolean(o));
}
