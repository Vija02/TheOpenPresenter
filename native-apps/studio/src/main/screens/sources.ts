import { net } from "electron";

import { currentAccount } from "../cloud/account";
import { cloudSessionCookie } from "../cloud/auth";
import { allOrganizations } from "../cloud/connection";
import { runtime } from "../runtime/client";
import { DEFAULT_CLOUD_URL, getSettings } from "../settings/store";
import { type ScreenSource, screenHosts, trimHost } from "./config";

/** A server this app holds a session for, so its screens can be listed. */
export type SourceOption = {
  source: ScreenSource;
  label: string;
  /** Who is signed in, when the server says. */
  account: string | null;
};

export type ScreenOption = { slug: string; name: string };
export type OrganizationScreens = {
  slug: string;
  name: string;
  screens: ScreenOption[];
};

/** The base URL a source is served on right now, or null if it is not up. */
export function sourceBase(source: ScreenSource): string | null {
  return source.kind === "local" ? runtime.url : trimHost(source.host);
}

export function hostLabel(url: string): string {
  if (trimHost(url) === DEFAULT_CLOUD_URL) return "TheOpenPresenter Cloud";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** A sync target as the Accounts page words it: "Synced to the cloud". */
const syncLabel = (host: string) =>
  trimHost(host) === DEFAULT_CLOUD_URL ? "the cloud" : hostLabel(host);

/** How a screen's source is named in the list of screens. */
export function sourceLabel(source: ScreenSource): string {
  if (source.kind === "local") return "This computer";
  return trimHost(source.host) === DEFAULT_CLOUD_URL
    ? "Cloud"
    : hostLabel(source.host);
}

type LocalOrganization = Awaited<ReturnType<typeof allOrganizations>>[number];

/** This computer's organizations, or none when its server is not up. */
async function localOrganizations(): Promise<LocalOrganization[]> {
  return runtime.url ? allOrganizations(runtime.url).catch(() => []) : [];
}

/**
 * Every server we may hold a session for: the cloud, the configured server,
 * whatever the local organizations sync to, and those screens already use.
 */
function candidateHosts(local: LocalOrganization[]): string[] {
  const hosts = [DEFAULT_CLOUD_URL, ...screenHosts()];
  const rootUrl = getSettings().rootUrl;
  if (rootUrl) hosts.push(rootUrl);
  for (const org of local) if (org.cloudHost) hosts.push(org.cloudHost);
  return [...new Set(hosts.map(trimHost))];
}

export async function listSources(
  local?: LocalOrganization[],
): Promise<SourceOption[]> {
  const hosts = candidateHosts(local ?? (await localOrganizations()));
  const [localSession, ...remote] = await Promise.all([
    runtime.url ? cloudSessionCookie(runtime.url) : null,
    ...hosts.map(async (host): Promise<SourceOption | null> => {
      if (!(await cloudSessionCookie(host))) return null;
      const account = await currentAccount(host);
      // A cookie the server no longer honours is not an account.
      if (!account) return null;
      return {
        source: { kind: "remote", host },
        label: hostLabel(host),
        account: account.name || account.username,
      };
    }),
  ]);

  return [
    ...(localSession
      ? [
          {
            source: { kind: "local" } as const,
            label: "This computer",
            account: null,
          },
        ]
      : []),
    ...remote.filter((s): s is SourceOption => s !== null),
  ];
}

const SCREENS_QUERY = `query {
  currentUser {
    organizationMemberships(first: 50) {
      nodes {
        organization {
          slug
          name
          screens(orderBy: [NAME_ASC]) { nodes { slug name } }
        }
      }
    }
  }
}`;

export async function listScreens(
  source: ScreenSource,
): Promise<OrganizationScreens[]> {
  const base = sourceBase(source);
  if (!base) throw new Error("The local server is not running.");

  const session = await cloudSessionCookie(base);
  if (!session) throw new Error(`Sign in to ${hostLabel(base)} first.`);

  const response = await net.fetch(`${base}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-top-csrf-protection": "1",
      Cookie: session.cookie,
    },
    body: JSON.stringify({ query: SCREENS_QUERY }),
  });

  let parsed: {
    data?: {
      currentUser?: {
        organizationMemberships: {
          nodes: {
            organization: {
              slug: string;
              name: string;
              screens: { nodes: ScreenOption[] };
            } | null;
          }[];
        };
      } | null;
    };
    errors?: { message: string }[];
  };
  try {
    parsed = (await response.json()) as typeof parsed;
  } catch {
    throw new Error(`${hostLabel(base)} returned ${response.status}`);
  }
  if (parsed.errors?.length) throw new Error(parsed.errors[0].message);

  const user = parsed.data?.currentUser;
  if (!user) throw new Error(`Sign in to ${hostLabel(base)} again.`);

  return user.organizationMemberships.nodes.flatMap((n) =>
    n.organization
      ? [
          {
            slug: n.organization.slug,
            name: n.organization.name,
            screens: n.organization.screens.nodes,
          },
        ]
      : [],
  );
}

/** A screen to pick, with the server that serves it best. */
export type CatalogScreen = {
  slug: string;
  name: string;
  source: ScreenSource;
  /** The organization's slug on that server. */
  orgSlug: string;
};

export type CatalogOrganization = {
  key: string;
  name: string;
  /** Where a copy on this computer syncs to, if it does. */
  syncedTo: string | null;
  /** That server, as the Accounts page names it. */
  syncedToLabel: string | null;
  screens: CatalogScreen[];
};

export type CatalogGroup = {
  key: string;
  label: string;
  isCloud: boolean;
  /** Who is signed in; null for this computer. */
  account: string | null;
  organizations: CatalogOrganization[];
};

export type ScreenCatalog = { groups: CatalogGroup[]; problems: string[] };

/**
 * Every screen the signed-in accounts and this computer have, grouped like
 * the Accounts page. An organization synced here shows once, and its screens
 * come from this computer, so they keep showing offline.
 */
export async function listCatalog(): Promise<ScreenCatalog> {
  const localOrgs = await localOrganizations();
  const sources = await listSources(localOrgs);
  const problems: string[] = [];
  const fetched = await Promise.all(
    sources.map((s) =>
      listScreens(s.source).catch((err: unknown) => {
        problems.push(
          `${s.label}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      }),
    ),
  );
  return { groups: buildCatalog(sources, fetched, localOrgs), problems };
}

type LocalOrganizationLink = {
  slug: string;
  cloudHost: string | null;
  cloudOrganizationSlug: string | null;
};

/** The grouping itself, given what each source listed. */
export function buildCatalog(
  sources: SourceOption[],
  fetched: (OrganizationScreens[] | null)[],
  localOrgs: LocalOrganizationLink[],
): CatalogGroup[] {
  const localIndex = sources.findIndex((s) => s.source.kind === "local");
  const localScreens = new Map(
    (localIndex === -1 ? [] : (fetched[localIndex] ?? [])).map((o) => [
      o.slug,
      o,
    ]),
  );
  const used = new Set<string>();
  const local: ScreenSource = { kind: "local" };

  const groups: CatalogGroup[] = [];
  sources.forEach((s, i) => {
    if (s.source.kind !== "remote" || !fetched[i]) return;
    const host = s.source.host;
    const remote = s.source;
    groups.push({
      key: host,
      label: s.label,
      isCloud: host === DEFAULT_CLOUD_URL,
      account: s.account,
      organizations: fetched[i].map((org) => {
        const copy = localOrgs.find(
          (l) =>
            l.cloudHost &&
            trimHost(l.cloudHost) === host &&
            l.cloudOrganizationSlug === org.slug,
        );
        const here = copy ? localScreens.get(copy.slug) : undefined;
        if (copy) used.add(copy.slug);
        const screens: CatalogScreen[] = (here?.screens ?? []).map((sc) => ({
          ...sc,
          source: local,
          orgSlug: copy!.slug,
        }));
        // Not synced down yet: show it from the account meanwhile.
        for (const sc of org.screens) {
          if (!screens.some((x) => x.slug === sc.slug)) {
            screens.push({ ...sc, source: remote, orgSlug: org.slug });
          }
        }
        screens.sort((a, b) => a.name.localeCompare(b.name));
        return {
          key: `${host}/${org.slug}`,
          name: org.name,
          syncedTo: copy ? host : null,
          syncedToLabel: copy ? syncLabel(host) : null,
          screens,
        };
      }),
    });
  });

  const rest = [...localScreens.values()].filter((o) => !used.has(o.slug));
  if (rest.length > 0) {
    groups.push({
      key: "local",
      label: "On this computer",
      isCloud: false,
      account: null,
      organizations: rest.map((org) => ({
        key: `local/${org.slug}`,
        name: org.name,
        ...(() => {
          const host =
            localOrgs.find((l) => l.slug === org.slug)?.cloudHost ?? null;
          return {
            syncedTo: host,
            syncedToLabel: host ? syncLabel(host) : null,
          };
        })(),
        screens: org.screens.map((sc) => ({
          ...sc,
          source: local,
          orgSlug: org.slug,
        })),
      })),
    });
  }

  return groups;
}
