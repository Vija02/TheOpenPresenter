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
