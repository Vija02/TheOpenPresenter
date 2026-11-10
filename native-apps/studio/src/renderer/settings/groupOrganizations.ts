import type {
  CloudOrganization,
  LocalOrganization,
  SignedInAccount,
} from "../bridge/ipc";

export type AccountRow =
  | { kind: "synced"; key: string; local: LocalOrganization }
  | { kind: "online"; key: string; org: CloudOrganization };

export type OrganizationGroups = {
  accounts: { account: SignedInAccount; rows: AccountRow[] }[];
  /** Local-only organizations, and copies whose account is not signed in. */
  thisComputer: LocalOrganization[];
};

function sameHost(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const strip = (value: string) =>
    value
      .trim()
      .replace(/\/+$/, "")
      .replace(/^https?:\/\//i, "")
      .toLowerCase();
  return strip(a) === strip(b);
}

/**
 * Organizations by the account they belong to. Each local copy is shown once:
 * under its account when that account is signed in here, otherwise with the
 * rest of this computer's organizations.
 */
export function groupOrganizations(
  accounts: SignedInAccount[],
  local: LocalOrganization[],
): OrganizationGroups {
  const placed = new Set<string>();

  const grouped = accounts.map((account) => {
    const rows: AccountRow[] = (account.organizations ?? []).map((org) => {
      const copy = local.find(
        (l) =>
          l.cloudOrganizationSlug === org.slug &&
          sameHost(l.cloudHost, account.rootUrl),
      );
      if (copy) {
        placed.add(copy.id);
        return { kind: "synced", key: copy.id, local: copy };
      }
      return { kind: "online", key: `${account.rootUrl}#${org.slug}`, org };
    });

    // A copy whose organization the account no longer lists still belongs
    // with that account, rather than looking local-only.
    for (const l of local) {
      if (!placed.has(l.id) && sameHost(l.cloudHost, account.rootUrl)) {
        placed.add(l.id);
        rows.push({ kind: "synced", key: l.id, local: l });
      }
    }
    return { account, rows };
  });

  return {
    accounts: grouped,
    thisComputer: local.filter((l) => !placed.has(l.id)),
  };
}
