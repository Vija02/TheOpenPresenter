import {
  ChurchStep,
  ChurchStepResult,
} from "@/containers/Onboarding/ChurchStep";
import { InviteStep } from "@/containers/Onboarding/InviteStep";
import { OnboardingShell } from "@/containers/Onboarding/OnboardingShell";
import { VerifyStep } from "@/containers/Onboarding/VerifyStep";
import {
  OnboardingPageDocument,
  OrganizationType,
  useOnboardingPageQuery,
  useResendEmailVerificationMutation,
  useUpdateOnboardingDataMutation,
} from "@repo/graphql";
import { OnboardingData, parseOnboardingData } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import { Button, Skeleton } from "@repo/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useClient } from "urql";
import { useLocation } from "wouter";

type StepName = "church" | "invite";

const stepOrder = ["verify", "church", "invite"] as const;

const Onboarding = () => {
  const [, navigate] = useLocation();

  const query = useOnboardingPageQuery();
  const [{ data, fetching }, refetchOnboardingPage] = query;
  const currentUser = data?.currentUser;

  const client = useClient();

  const recheckVerification = useCallback(() => {
    refetchOnboardingPage({ requestPolicy: "network-only" });
  }, [refetchOnboardingPage]);

  const checkVerified = useCallback(async () => {
    const result = await client
      .query(OnboardingPageDocument, {}, { requestPolicy: "network-only" })
      .toPromise();
    return result.data?.currentUser?.isVerified === true;
  }, [client]);

  const [, updateOnboardingData] = useUpdateOnboardingDataMutation();
  const [, resendEmailVerification] = useResendEmailVerificationMutation();

  const [answers, setAnswers] = useState<OnboardingData>({});
  const [step, setStep] = useState<StepName>("church");
  const [organization, setOrganization] = useState<ChurchStepResult | null>(
    null,
  );
  // Marking the flow complete refetches the user
  const [finishing, setFinishing] = useState(false);
  const hasResumed = useRef(false);
  const mergedForUser = useRef<string | null>(null);

  // Pick up whatever the server already knows
  useEffect(() => {
    if (!currentUser || mergedForUser.current === currentUser.id) return;
    mergedForUser.current = currentUser.id;
    setAnswers((local) => ({
      ...parseOnboardingData(currentUser.onboardingData),
      ...local,
    }));
  }, [currentUser]);

  const persist = useCallback(
    async (next: OnboardingData) => {
      setAnswers(next);
      if (currentUser?.id) {
        try {
          await updateOnboardingData({
            id: currentUser.id,
            onboardingData: next,
          });
        } catch {}
      }
    },
    [currentUser?.id, updateOnboardingData],
  );

  const existingOrganization =
    currentUser?.organizationMemberships.nodes[0]?.organization;

  // A user who lands here mid-flow (social login, refresh, a bookmark) resumes
  // rather than restarts.
  useEffect(() => {
    if (fetching) return;
    if (!currentUser) {
      navigate("/register", { replace: true });
      return;
    }
    if (answers.completedAt && existingOrganization && !finishing) {
      navigate(`/o/${existingOrganization.slug}`, { replace: true });
      return;
    }
    if (!hasResumed.current) {
      hasResumed.current = true;
      if (existingOrganization) setStep("invite");
    }
  }, [
    fetching,
    currentUser,
    existingOrganization,
    answers.completedAt,
    finishing,
    navigate,
  ]);

  const organizationType = answers.organizationType ?? OrganizationType.Church;

  const stepIndex = stepOrder.indexOf(step) + 1;

  const targetOrganizationSlug =
    organization?.organizationSlug ?? existingOrganization?.slug;
  const targetOrganizationId =
    organization?.organizationId ?? existingOrganization?.id;

  const primaryEmailId = currentUser?.userEmails.nodes[0]?.id;

  const handleResendVerification = useCallback(async () => {
    if (!primaryEmailId) return;
    try {
      await resendEmailVerification({ emailId: primaryEmailId });
      toast.success("Verification email has been sent!");
    } catch {
      toast.error("Could not send the verification email, please try again.");
    }
  }, [primaryEmailId, resendEmailVerification]);

  /** Both church-step exits that hand back a personal org end the flow here. */
  const finishWithPersonalOrg = useCallback(
    (result: ChurchStepResult) => {
      setFinishing(true);
      persist({
        ...answers,
        skippedOrganization: true,
        completedAt: new Date().toISOString(),
      });
      navigate(`/o/${result.organizationSlug}`);
    },
    [answers, persist, navigate],
  );

  const handleFinish = useCallback(async () => {
    setFinishing(true);
    await persist({ ...answers, completedAt: new Date().toISOString() });
    captureEvent("onboarding_completed", {
      organization_type: organizationType,
      skipped_organization: answers.skippedOrganization === true,
    });

    if (!targetOrganizationSlug) {
      navigate("/org/overview");
      return;
    }

    navigate(`/o/${targetOrganizationSlug}`);
  }, [answers, organizationType, persist, navigate, targetOrganizationSlug]);

  if (fetching && !data) {
    return <Skeleton className="h-40" />;
  }

  // Joining an organization requires a verified address.
  if (currentUser && !currentUser.isVerified) {
    return (
      <OnboardingShell
        title="Verify your email"
        step={stepOrder.indexOf("verify") + 1}
        totalSteps={stepOrder.length}
        heading="Verify your email"
        subheading="Just to check we can reach you. It takes a few seconds."
      >
        <VerifyStep
          email={currentUser.userEmails.nodes[0]?.email}
          onResend={handleResendVerification}
          onRecheck={recheckVerification}
          onCheckVerified={checkVerified}
        />
      </OnboardingShell>
    );
  }

  if (step === "church") {
    const isChurch = organizationType === OrganizationType.Church;
    return (
      <OnboardingShell
        title="Find your church"
        step={stepIndex}
        totalSteps={stepOrder.length}
        heading={
          isChurch ? "Which church are you with?" : "Where are you presenting?"
        }
        subheading={
          isChurch
            ? "If someone from your church already uses TheOpenPresenter, we'll find them so you can join their team."
            : "A conference, a school, a business, a venue."
        }
      >
        <ChurchStep
          organizationType={organizationType}
          onOrganizationTypeChange={(value) =>
            persist({ ...answers, organizationType: value })
          }
          userName={currentUser?.name}
          existingOrganization={
            targetOrganizationId && targetOrganizationSlug
              ? {
                  organizationId: targetOrganizationId,
                  organizationSlug: targetOrganizationSlug,
                }
              : null
          }
          onDemoCreated={(result) => {
            finishWithPersonalOrg(result);
            captureEvent("onboarding_demo_created");
          }}
          onSkipped={(result) => {
            finishWithPersonalOrg(result);
            captureEvent("onboarding_completed", {
              organization_type: organizationType,
              skipped_organization: true,
            });
          }}
          onDone={(result) => {
            persist({
              ...answers,
              skippedOrganization: false,
            });
            setOrganization(result);
            setStep("invite");
          }}
        />
      </OnboardingShell>
    );
  }

  if (step === "invite") {
    if (!targetOrganizationId) {
      return null;
    }

    return (
      <OnboardingShell
        title="Invite your team"
        step={stepIndex}
        totalSteps={stepOrder.length}
        heading="Invite your team"
        subheading="Invite the rest of your team so they can run the screen too. You can always do this later."
        footer={
          <div className="flex justify-between items-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => setStep("church")}
              data-testid="onboarding-invite-back"
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="text-tertiary"
                onClick={handleFinish}
                data-testid="onboarding-invite-skip"
              >
                Skip
              </Button>
              <Button
                variant="success"
                onClick={handleFinish}
                data-testid="onboarding-invite-continue"
              >
                Continue
              </Button>
            </div>
          </div>
        }
      >
        <InviteStep organizationId={targetOrganizationId} />
      </OnboardingShell>
    );
  }

  return null;
};

export default Onboarding;
