import { EmailCategory } from "@repo/graphql";

/** How each kind of optional email is described to users. */
export const emailCategoryInfo: Record<
  EmailCategory,
  { label: string; description: string }
> = {
  [EmailCategory.Onboarding]: {
    label: "Getting started tips",
    description: "A few emails in your first weeks to help you get set up.",
  },
};

/** Turns the `category` from an email link (e.g. "onboarding") into an EmailCategory */
export const parseEmailCategory = (
  value: string | null,
): EmailCategory | null => {
  const upper = value?.toUpperCase();
  return (Object.values(EmailCategory) as string[]).includes(upper ?? "")
    ? (upper as EmailCategory)
    : null;
};
