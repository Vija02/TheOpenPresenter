import { OrganizationType } from "@repo/graphql";

/** Persisted to `users.onboarding_data` */
export type OnboardingData = {
  organizationType?: OrganizationType;
  completedAt?: string;
  skippedOrganization?: boolean;
};

export const parseOnboardingData = (value: unknown): OnboardingData => {
  if (!value || typeof value !== "object") return {};
  const data = value as Record<string, unknown>;

  const organizationType = Object.values(OrganizationType).includes(
    data.organizationType as OrganizationType,
  )
    ? (data.organizationType as OrganizationType)
    : undefined;

  return {
    organizationType,
    completedAt:
      typeof data.completedAt === "string" ? data.completedAt : undefined,
    skippedOrganization: data.skippedOrganization === true,
  };
};
