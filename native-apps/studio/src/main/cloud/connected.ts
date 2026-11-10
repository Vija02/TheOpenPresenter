/**
 * Which cloud organizations this install already mirrors.
 */
import { sameHost } from "../settings/host";

/** An organization as the cloud reports it. */
type CloudOrganization = { slug: string; name: string };

/** An organization on this install, as `allOrganizations` returns it. */
type LocalOrganization = {
  slug: string;
  name: string;
  cloudHost: string | null;
  cloudOrganizationSlug: string | null;
};

/** A cloud organization, plus whether this install already mirrors it. */
export type CloudOrganizationChoice = CloudOrganization & {
  connected: boolean;
  /** The local organization mirroring it, when there is one. */
  localName: string | null;
};

/**
 * Mark the cloud organizations already mirrored locally.
 */
export function markConnectedOrganizations(
  cloudOrganizations: CloudOrganization[],
  localOrganizations: LocalOrganization[],
  cloudHost: string,
): CloudOrganizationChoice[] {
  return cloudOrganizations.map((org) => {
    const mirror = localOrganizations.find(
      (local) =>
        local.cloudOrganizationSlug === org.slug &&
        sameHost(local.cloudHost, cloudHost),
    );

    return {
      ...org,
      connected: Boolean(mirror),
      localName: mirror ? mirror.name || mirror.slug : null,
    };
  });
}
