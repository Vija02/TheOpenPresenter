import { session as electronSession, net } from "electron";

import { cloudSessionCookie } from "./auth";
import { toSlug, uniqueSlug } from "./slug";

/** Linking the local server to a cloud organization. */

const HEADERS = {
  "Content-Type": "application/json",
  "x-top-csrf-protection": "1",
};

const SESSION_COOKIE = "connect.sid";

async function localSessionHeader(
  base: string,
): Promise<Record<string, string>> {
  try {
    const cookies = await electronSession.defaultSession.cookies.get({
      url: base,
      name: SESSION_COOKIE,
    });
    const cookie = cookies[0];
    return cookie ? { Cookie: `${cookie.name}=${cookie.value}` } : {};
  } catch {
    return {};
  }
}

async function post<T>(base: string, path: string, body: unknown): Promise<T> {
  const response = await net.fetch(`${base}${path}`, {
    method: "POST",
    headers: { ...HEADERS, ...(await localSessionHeader(base)) },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: { error?: string } & Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned ${response.status}`);
  }

  if (!response.ok || parsed.error) {
    throw new Error(parsed.error ?? `${path} returned ${response.status}`);
  }
  return parsed as T;
}

/** GraphQL against the local server. */
async function graphql<T>(
  base: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const result = await post<{ data?: T; errors?: { message: string }[] }>(
    base,
    "/graphql",
    { query, variables },
  );
  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }
  if (!result.data) throw new Error("The server returned no data");
  return result.data;
}

export type CloudConnection = {
  id: string;
  host: string;
  organizationList: { slug: string; name: string }[];
  targetOrganizationSlug: string | null;
  /**
   * The slug of the *local* organisation this connection belongs to.
   *
   * Not the same as `targetOrganizationSlug`: the local mirror is given a
   * unique slug, so mirroring a cloud `grace` onto an install that already
   * has a `grace` produces `grace-2`. Callers that want to open the
   * organisation need this one.
   */
  localOrganizationSlug?: string;
};

export async function localOrganization(
  base: string,
): Promise<{ id: string; slug: string } | null> {
  const data = await graphql<{
    organizations: { nodes: { id: string; slug: string }[] };
  }>(
    base,
    `
      query {
        organizations {
          nodes {
            id
            slug
          }
        }
      }
    `,
  );

  const nodes = data.organizations?.nodes ?? [];
  return nodes.find((o) => o.slug === "local") ?? nodes[0] ?? null;
}

/** Every organization on this local server. */
export async function allOrganizations(base: string): Promise<
  {
    id: string;
    slug: string;
    name: string;
    cloudHost: string | null;
    cloudOrganizationSlug: string | null;
  }[]
> {
  const data = await graphql<{
    organizations: {
      nodes: {
        id: string;
        slug: string;
        name: string;
        cloudConnections: {
          nodes: { host: string; targetOrganizationSlug: string | null }[];
        };
      }[];
    };
  }>(
    base,
    `
      query {
        organizations {
          nodes {
            id
            slug
            name
            cloudConnections {
              nodes {
                host
                targetOrganizationSlug
              }
            }
          }
        }
      }
    `,
  );
  // At most one connection per organization: the schema has a unique index on
  // cloud_connections(organization_id), so the first is the only one.
  return (data.organizations?.nodes ?? []).map((org) => {
    const connection = org.cloudConnections?.nodes?.[0] ?? null;
    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      cloudHost: connection?.host ?? null,
      cloudOrganizationSlug: connection?.targetOrganizationSlug ?? null,
    };
  });
}

/** Create the local organization that mirrors a cloud one. */
export async function createMirrorOrganization(
  base: string,
  cloudName: string,
): Promise<{ id: string; slug: string }> {
  const existing = await allOrganizations(base);
  const slug = uniqueSlug(
    toSlug(cloudName),
    existing.map((o) => o.slug),
  );

  const data = await graphql<{
    createOrganization: {
      organization: { id: string; slug: string } | null;
    } | null;
  }>(
    base,
    `
      mutation ($name: String!, $slug: String!) {
        createOrganization(input: { name: $name, slug: $slug }) {
          organization {
            id
            slug
          }
        }
      }
    `,
    { name: cloudName, slug },
  );

  const created = data.createOrganization?.organization;
  if (!created) {
    throw new Error(`Could not create an organization for ${cloudName}.`);
  }
  return created;
}

/** The cloud connection for an organization, if it already has one. */
export async function existingConnection(
  base: string,
  slug: string,
): Promise<CloudConnection | null> {
  const data = await graphql<{
    organizationBySlug: {
      cloudConnections: { nodes: CloudConnection[] };
    } | null;
  }>(
    base,
    `
      query ($slug: String!) {
        organizationBySlug(slug: $slug) {
          cloudConnections {
            nodes {
              id
              host
              organizationList {
                slug
                name
              }
              targetOrganizationSlug
            }
          }
        }
      }
    `,
    { slug },
  );

  return data.organizationBySlug?.cloudConnections?.nodes?.[0] ?? null;
}

/** Hand the local server the cloud session this shell already holds. */
export async function connectToCloud(
  base: string,
  cloudUrl: string,
): Promise<CloudConnection> {
  const org = await localOrganization(base);
  if (!org) {
    throw new Error("The local server has no organization to connect.");
  }

  const existing = await existingConnection(base, org.slug);
  if (existing) return existing;

  const session = await cloudSessionCookie(cloudUrl);
  if (!session) {
    throw new Error(
      "No cloud session to connect with. Sign in to the cloud first.",
    );
  }

  await post<{ id: string }>(base, "/cloud/adopt", {
    organizationId: org.id,
    host: cloudUrl.replace(/\/+$/, ""),
    cookie: session.cookie,
    expiry: session.expiry,
  });

  // Read back rather than trusting the insert: `organizationList` is fetched
  // from the cloud on demand, so this is the first proof the cookie works.
  const created = await existingConnection(base, org.slug);
  if (!created) {
    throw new Error("The cloud connection was not stored.");
  }
  return created;
}

/** Choose which cloud organization this install syncs with. */
export async function selectOrganization(
  base: string,
  cloudConnectionId: string,
  targetOrganizationSlug: string,
): Promise<void> {
  const data = await graphql<{
    updateCloudConnection: {
      cloudConnection: { id: string; targetOrganizationSlug: string } | null;
    } | null;
  }>(
    base,
    `
      mutation ($cloudConnectionId: UUID!, $targetOrganizationSlug: String!) {
        updateCloudConnection(
          input: {
            id: $cloudConnectionId
            patch: { targetOrganizationSlug: $targetOrganizationSlug }
          }
        ) {
          cloudConnection {
            id
            targetOrganizationSlug
          }
        }
      }
    `,
    { cloudConnectionId, targetOrganizationSlug },
  );

  const updated = data.updateCloudConnection?.cloudConnection;
  if (updated?.targetOrganizationSlug !== targetOrganizationSlug) {
    throw new Error(
      `Could not point this computer at ${targetOrganizationSlug}. ` +
        `The server accepted the request but stored nothing, which usually ` +
        `means this shell is not signed in to the local server.`,
    );
  }
}

/** Start a sync. Returns once queued, not once finished. */
export async function startSync(
  base: string,
  cloudConnectionId: string,
): Promise<void> {
  await graphql(
    base,
    `
      mutation ($cloudConnectionId: UUID!) {
        syncCloudConnection(input: { cloudConnectionId: $cloudConnectionId }) {
          success
        }
      }
    `,
    { cloudConnectionId },
  );
}

/** Connect a cloud organization, creating the local mirror for it. */
export async function connectCloudOrganization(
  base: string,
  cloudUrl: string,
  cloudOrg: { slug: string; name: string },
): Promise<CloudConnection> {
  const session = await cloudSessionCookie(cloudUrl);
  if (!session) {
    throw new Error(
      "No cloud session to connect with. Sign in to the cloud first.",
    );
  }

  const org = await createMirrorOrganization(base, cloudOrg.name);

  await post<{ id: string }>(base, "/cloud/adopt", {
    organizationId: org.id,
    host: cloudUrl.replace(/\/+$/, ""),
    cookie: session.cookie,
    expiry: session.expiry,
  });

  const created = await existingConnection(base, org.slug);
  if (!created) {
    throw new Error("The cloud connection was not stored.");
  }

  // Picking the cloud org is choosing the sync target, so there is no
  // separate step for it.
  await selectOrganization(base, created.id, cloudOrg.slug);

  try {
    await startSync(base, created.id);
  } catch (err) {
    console.error("Could not start the first sync", err);
  }

  return {
    ...created,
    targetOrganizationSlug: cloudOrg.slug,
    localOrganizationSlug: org.slug,
  };
}

/** Give this install an organization with a name the user chose. */
export async function nameLocalOrganization(
  base: string,
  name: string,
): Promise<{ id: string; slug: string }> {
  const existing = await allOrganizations(base);
  const placeholder = existing.find((o) => o.slug === "local");

  if (!placeholder) {
    return createMirrorOrganization(base, name);
  }

  const slug = uniqueSlug(
    toSlug(name),
    existing.filter((o) => o.id !== placeholder.id).map((o) => o.slug),
  );

  const data = await graphql<{
    updateOrganization: {
      organization: { id: string; slug: string } | null;
    } | null;
  }>(
    base,
    `
      mutation ($id: UUID!, $name: String!, $slug: String!) {
        updateOrganization(
          input: { id: $id, patch: { name: $name, slug: $slug } }
        ) {
          organization {
            id
            slug
          }
        }
      }
    `,
    { id: placeholder.id, name, slug },
  );

  const updated = data.updateOrganization?.organization;
  if (!updated) throw new Error("Could not rename the organization.");
  return updated;
}

/** Stop syncing an organization, optionally deleting it. */
export async function removeConnection(
  base: string,
  cloudConnectionId: string,
  organizationId: string,
  deleteOrganization: boolean,
): Promise<void> {
  await graphql(
    base,
    `
      mutation ($id: UUID!) {
        deleteCloudConnection(input: { id: $id }) {
          clientMutationId
        }
      }
    `,
    { id: cloudConnectionId },
  );

  if (!deleteOrganization) return;

  await graphql(
    base,
    `
      mutation ($id: UUID!) {
        deleteOrganization(input: { organizationId: $id }) {
          clientMutationId
        }
      }
    `,
    { id: organizationId },
  );
}
