import { sameHost } from "../settings/host";

/**
 * Going offline opens the page the user was on, on the local server: the same
 * project, or the same organization page. Projects keep their slug when
 * copied, but an organization's local slug can differ from the account's.
 */

type Mirror = {
  slug: string;
  cloudHost: string | null;
  cloudOrganizationSlug: string | null;
};

export type LocalPage = {
  /** Path, query and hash on the local server. */
  path: string;
  /** Where to go instead if the project is not on this computer yet. */
  fallback: string;
  /** The project to check for, as the local server names it. */
  project?: { organizationSlug: string; slug: string };
};

/** The local page for an online one, or null when there is none. */
export function localPageFor(
  current: string,
  rootUrl: string,
  mirrors: Mirror[],
): LocalPage | null {
  let url: URL;
  try {
    url = new URL(current);
  } catch {
    return null;
  }
  if (!sameHost(url.origin, rootUrl)) return null;

  const match = /^\/(app|o)\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match) return null;
  const [, section, cloudSlug, rest = ""] = match;

  const mirror = mirrors.find(
    (m) =>
      m.cloudOrganizationSlug === decodeURIComponent(cloudSlug) &&
      sameHost(m.cloudHost, rootUrl),
  );
  if (!mirror) return null;

  const local = encodeURIComponent(mirror.slug);
  const fallback = `/o/${local}`;
  const path = `/${section}/${local}${rest}${url.search}${url.hash}`;

  if (section === "o") return { path, fallback };
  const projectSlug = rest.split("/")[1];
  if (!projectSlug) return { path: fallback, fallback };
  return {
    path,
    fallback,
    project: {
      organizationSlug: mirror.slug,
      slug: decodeURIComponent(projectSlug),
    },
  };
}
