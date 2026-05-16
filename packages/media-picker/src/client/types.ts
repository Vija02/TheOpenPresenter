import { OrganizationMediaForPickerQuery } from "@repo/graphql";

// Media type from the picker query
export type MediaWithMetadata = NonNullable<
  OrganizationMediaForPickerQuery["organization"]
>["medias"]["nodes"][number];
