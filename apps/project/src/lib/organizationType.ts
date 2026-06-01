import { OrganizationType } from "@repo/graphql";
import type { OptionItem } from "@repo/ui";

export const organizationTypeOptions: OptionItem<OrganizationType>[] = [
  {
    value: OrganizationType.Venue,
    title: "Commercial",
    description:
      "A business-oriented venue such as a meeting room, conference center, or auditorium.",
  },
  {
    value: OrganizationType.Church,
    title: "House of Worship",
    description:
      "A church, place of worship, or any other religious organization.",
  },
];

type OrgTypeLabel = {
  projectDate: string;
};

const churchLabels: OrgTypeLabel = {
  projectDate: "Service Time",
};

const venueLabels: OrgTypeLabel = {
  projectDate: "Event Date",
};

export const getOrgTypeLabels = (
  organizationType?: OrganizationType | null,
): OrgTypeLabel => {
  if (organizationType === OrganizationType.Church) return churchLabels;
  if (organizationType === OrganizationType.Venue) return venueLabels;
  return venueLabels;
};
