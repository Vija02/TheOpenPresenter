import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  OrganizationBillingPageQuery,
  useOrganizationBillingPageQuery,
} from "@repo/graphql";
import { appData } from "@repo/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Button,
  LoadingFull,
} from "@repo/ui";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import axios from "axios";
import { useCallback, useMemo, useState } from "react";
import { MdCheck, MdCreditCard, MdOpenInNew, MdStar } from "react-icons/md";
import { UseQueryResponse } from "urql";
import { useSearch } from "wouter";

// ---------------------------------------------------------------------------
// Stripe singleton
// ---------------------------------------------------------------------------
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = appData.getStripePublishableKey();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(
  amountInSmallestUnit: number,
  currency: string,
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountInSmallestUnit / 100);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function apiError(e: any, fallback: string): string {
  return e?.response?.data?.error ?? e?.message ?? fallback;
}

function stripePost(url: string, body: unknown) {
  return axios.post(url, body, {
    headers: { "csrf-token": appData.getCSRFToken() ?? "" },
  });
}

const PRICE_MONTHLY_GBP = 79;
const PRICE_ANNUAL_GBP = 790;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLANS = [
  {
    label: "Monthly",
    pricePerRoom: PRICE_MONTHLY_GBP,
    unit: "/mo",
    badge: null,
    note: "Billed monthly · cancel anytime",
    priceIdKey: "STRIPE_PRICE_ID_MONTHLY" as const,
  },
  {
    label: "Annual",
    pricePerRoom: PRICE_ANNUAL_GBP,
    unit: "/yr",
    badge: "Best value",
    note: "Billed annually · 2 months free",
    priceIdKey: "STRIPE_PRICE_ID_ANNUAL" as const,
  },
] as const;

const FEATURES = [
  "Guest portal for your guests",
  "Custom branding & logo",
  "Drive main screen, confidence monitor, and signage from one synchronized show",
  "Multi-room dashboard",
  "50 GB storage per room",
  "Priority email support",
];

const FAQ_ITEMS = [
  {
    q: "What counts as a room?",
    a: "A physical enclosed room space. You may connect to as many screen as you wish as long as they are all in the same room. All screens in a room shares the same presentation session. They can show the same thing or a variation of the same show such as for confidence monitor. Your subscription gives you the ability to run that many rooms at the same time.",
  },
  {
    q: "What's included in the Free plan?",
    a: "Free includes up to 5 connected displays, 1 GB storage, all official plugins, unlimited presentations, and no time limit. No credit card required.",
  },
  {
    q: "What's the difference between Monthly and Annual billing?",
    a: `Monthly costs £${PRICE_MONTHLY_GBP}/room/month. Annual costs £${PRICE_ANNUAL_GBP}/room/year. That's saving you the equivalent of 2 months compared to paying monthly. The full annual amount is charged upfront.`,
  },
  {
    q: "How does proration work when I change room count?",
    a: "When you add rooms, you're charged immediately for the prorated cost of the remaining days in your billing period. When you remove rooms, you receive a credit for the unused days. This is automatically deducted from your next invoice. You'll always see the exact amount before confirming.",
  },
  {
    q: "What happens when I cancel?",
    a: 'Your Business plan stays active until the end of your current billing period. After that, your organization moves to the Free plan automatically. We don\'t issue refunds for remaining time. To reactivate, click "Manage subscription". You can resume from the Stripe portal at any time before the period ends.',
  },
  {
    q: "Can I switch between Monthly and Annual billing?",
    a: 'Yes. Click "Manage subscription" to switch billing cycles in the Stripe portal. Switching from monthly to annual issues a prorated credit for the remainder of your month and charges the annual rate. Switching from annual to monthly takes effect at your next renewal.',
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type OrgData = NonNullable<OrganizationBillingPageQuery["organizationBySlug"]>;
type UpdatePhase =
  | "idle"
  | "previewing"
  | "confirming"
  | "updating"
  | "success";
type CancelPhase = "idle" | "confirming" | "cancelling" | "success";

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-tertiary font-medium mb-1">
        {label}
      </p>
      <div className="text-sm font-medium text-primary">{children}</div>
    </div>
  );
}

const OrganizationBillingPage = () => {
  const slug = useOrganizationSlug();
  const query = useOrganizationBillingPageQuery({ variables: { slug } });
  const organizationLoadingElement = useOrganizationLoading(query);

  return (
    <SharedOrgLayout title="Billing" sharedOrgQuery={query}>
      {organizationLoadingElement || <BillingPageInner query={query} />}
    </SharedOrgLayout>
  );
};

function BillingPageInner({
  query: [{ data }],
}: {
  query: UseQueryResponse<OrganizationBillingPageQuery>;
}) {
  const org = data?.organizationBySlug;
  const slug = useOrganizationSlug();
  const search = useSearch();

  const sessionId = useMemo(
    () => new URLSearchParams(search).get("session_id"),
    [search],
  );

  if (!org) return <LoadingFull />;

  const stripeEnabled = !!appData.getStripePublishableKey();

  const canManage = org.currentUserIsOwner || org.currentUserIsBillingContact;
  const billingInfo = org.billingInfo;
  const plan = billingInfo?.plan ?? "free";
  const status = billingInfo?.subscriptionStatus ?? null;
  const periodEnd = billingInfo?.currentPeriodEnd
    ? new Date(billingInfo.currentPeriodEnd)
    : null;
  const subscribedRoomCount = billingInfo?.subscribedRoomCount ?? 0;
  const billingInterval = billingInfo?.billingInterval ?? "month";
  const scheduledCancel = billingInfo?.cancelAtPeriodEnd ?? false;
  const serverCancelAt = billingInfo?.cancelAt
    ? new Date(billingInfo.cancelAt)
    : null;
  const isActive =
    plan === "business" && (status === "active" || status === "trialing");

  return (
    <div className="w-full grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary">Billing</h1>
          <p className="mt-1 text-sm text-secondary">
            Manage your plan, rooms, and payment details for this organization.
          </p>
        </div>

        {!stripeEnabled ? (
          <Alert variant="warning" title="Billing isn't enabled">
            Online billing isn't currently set up for this instance. If you
            believe this is a mistake, please contact your administrator or{" "}
            <a
              href="mailto:support@theopenpresenter.com"
              className="underline hover:no-underline"
            >
              support
            </a>
            .
          </Alert>
        ) : (
          <>
            {sessionId && (
              <Alert variant="success" title="Subscription activated">
                Your Business plan is now active. Thank you!
              </Alert>
            )}
            {!canManage && (
              <Alert variant="warning" title="Read-only view">
                Only the organization owner or billing contact can make changes.
              </Alert>
            )}

            <PlanOverviewCard
              status={status}
              periodEnd={periodEnd}
              isActive={isActive}
              subscribedRoomCount={subscribedRoomCount}
              billingInterval={billingInterval}
              scheduledCancel={scheduledCancel}
              serverCancelAt={serverCancelAt}
              canManage={canManage}
              org={org}
              slug={slug}
            />

            {!isActive && canManage && <UpgradeSection org={org} slug={slug} />}
          </>
        )}
      </div>

      <div className="mt-5 lg:mt-0">
        <FaqSection />
      </div>
    </div>
  );
}

function PlanOverviewCard({
  status,
  periodEnd,
  isActive,
  subscribedRoomCount,
  billingInterval,
  scheduledCancel,
  serverCancelAt,
  canManage,
  org,
  slug,
}: {
  status: string | null;
  periodEnd: Date | null;
  isActive: boolean;
  subscribedRoomCount: number;
  billingInterval: string;
  scheduledCancel: boolean;
  serverCancelAt: Date | null;
  canManage: boolean | null;
  org: OrgData;
  slug: string;
}) {
  // Portal
  const [portalLoading, setPortalLoading] = useState(false);

  // Room editing
  const [isEditing, setIsEditing] = useState(false);
  const [pendingRoomCount, setPendingRoomCount] = useState(
    subscribedRoomCount > 0 ? subscribedRoomCount : 1,
  );
  const [confirmedRoomCount, setConfirmedRoomCount] =
    useState(subscribedRoomCount);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [preview, setPreview] = useState<{
    amountDue: number;
    total: number;
    currency: string;
  } | null>(null);

  // Cancel
  const [cancelPhase, setCancelPhase] = useState<CancelPhase>("idle");
  const [cancelAt, setCancelAt] = useState<Date | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Optimistically show new count after save
  const displayRoomCount =
    updatePhase === "success" ? pendingRoomCount : subscribedRoomCount;

  // Compute next charge for display
  const pricePerRoom =
    billingInterval === "year" ? PRICE_ANNUAL_GBP : PRICE_MONTHLY_GBP;
  const nextChargeAmount = subscribedRoomCount * pricePerRoom;
  const nextChargeUnit = billingInterval === "year" ? "/yr" : "/mo";

  const startEditing = useCallback(() => {
    setPendingRoomCount(confirmedRoomCount > 0 ? confirmedRoomCount : 1);
    setUpdatePhase("idle");
    setPreview(null);
    setError(null);
    setIsEditing(true);
  }, [confirmedRoomCount]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setPendingRoomCount(confirmedRoomCount > 0 ? confirmedRoomCount : 1);
    setUpdatePhase("idle");
    setPreview(null);
    setError(null);
  }, [confirmedRoomCount]);

  const adjustRoom = useCallback(
    (delta: number) => {
      setPendingRoomCount((n) => Math.max(1, n + delta));
      if (updatePhase === "confirming") {
        setUpdatePhase("idle");
        setPreview(null);
      }
    },
    [updatePhase],
  );

  const previewUpdate = useCallback(async () => {
    setUpdatePhase("previewing");
    setError(null);
    try {
      const { data } = await stripePost("/stripe/preview-subscription-update", {
        organizationId: org.id,
        quantity: pendingRoomCount,
      });
      setPreview({
        amountDue: data.amountDue,
        total: data.total,
        currency: data.currency,
      });
      setUpdatePhase("confirming");
    } catch (e: any) {
      setError(apiError(e, "Failed to preview update"));
      setUpdatePhase("idle");
    }
  }, [org.id, pendingRoomCount]);

  const confirmUpdate = useCallback(async () => {
    setUpdatePhase("updating");
    setError(null);
    try {
      await stripePost("/stripe/update-subscription", {
        organizationId: org.id,
        quantity: pendingRoomCount,
      });
      setConfirmedRoomCount(pendingRoomCount);
      setIsEditing(false);
      setPreview(null);
      setUpdatePhase("success");
      setTimeout(() => setUpdatePhase("idle"), 6000);
    } catch (e: any) {
      setError(apiError(e, "Failed to update subscription"));
      setUpdatePhase("confirming");
    }
  }, [org.id, pendingRoomCount]);

  const cancelSubscription = useCallback(async () => {
    setCancelPhase("cancelling");
    setError(null);
    try {
      const { data } = await stripePost("/stripe/cancel-subscription", {
        organizationId: org.id,
      });
      setCancelAt(data.cancelAt ? new Date(data.cancelAt * 1000) : periodEnd);
      setCancelPhase("success");
    } catch (e: any) {
      setError(apiError(e, "Failed to cancel subscription"));
      setCancelPhase("confirming");
    }
  }, [org.id, periodEnd]);

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const { data } = await stripePost("/stripe/create-portal-session", {
        organizationId: org.id,
        slug,
      });
      window.location.href = data.url;
    } catch (e: any) {
      setError(apiError(e, "Failed to open portal"));
      setPortalLoading(false);
    }
  }, [org.id, slug]);

  const roomCountChanged = pendingRoomCount !== confirmedRoomCount;
  const busy = updatePhase === "previewing" || updatePhase === "updating";
  const isCancelScheduled = scheduledCancel || cancelPhase === "success";
  const effectivePeriodEnd = cancelAt ?? serverCancelAt ?? periodEnd;

  return (
    <section className="rounded-md border border-stroke bg-surface-primary divide-y divide-stroke overflow-hidden">
      <div className="px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MdCreditCard className="size-5 text-tertiary shrink-0" />
          <h2 className="font-semibold text-primary">
            {isActive ? "Business plan" : "Free plan"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-500/20 dark:text-teal-300">
              <MdStar className="size-3" />
              Business
            </span>
          )}
          {status && status !== "active" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 capitalize">
              {status.replace(/_/g, " ")}
            </span>
          )}
          {isCancelScheduled && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Cancels{" "}
              {effectivePeriodEnd
                ? formatDate(effectivePeriodEnd)
                : "at period end"}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-6">
        {isActive ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="Billing">
              {billingInterval === "year" ? "Annual" : "Monthly"}
            </Stat>
            <Stat label="Rooms">
              <span className="text-2xl font-bold tabular-nums">
                {displayRoomCount}
              </span>
            </Stat>
            <Stat label="Next charge">
              £{nextChargeAmount}
              <span className="text-xs font-normal text-secondary">
                {nextChargeUnit}
              </span>
            </Stat>
            <Stat label={isCancelScheduled ? "Cancels" : "Renews"}>
              {effectivePeriodEnd ? formatDate(effectivePeriodEnd) : "-"}
            </Stat>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="Displays">Up to 5</Stat>
            <Stat label="Storage">1 GB</Stat>
            <Stat label="Plugins">All included</Stat>
            <Stat label="Support">Community</Stat>
          </div>
        )}

        {/* Room editing section */}
        {isActive && canManage && (
          <div className="mt-5">
            {/* View mode */}
            {!isEditing && (
              <div className="flex items-center gap-3">
                {updatePhase === "success" ? (
                  <span className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400">
                    <MdCheck className="size-3.5" />
                    Rooms updated. Changes will reflect shortly
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    Update rooms
                  </Button>
                )}
              </div>
            )}

            {/* Edit mode */}
            {isEditing && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label="Remove a room"
                    onClick={() => adjustRoom(-1)}
                    disabled={pendingRoomCount <= 1 || busy}
                    className="w-8 h-8 rounded border border-stroke flex items-center justify-center text-primary hover:bg-surface-primary-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer leading-none"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-bold text-primary tabular-nums">
                    {pendingRoomCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Add a room"
                    onClick={() => adjustRoom(1)}
                    disabled={busy}
                    className="w-8 h-8 rounded border border-stroke flex items-center justify-center text-primary hover:bg-surface-primary-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer leading-none"
                  >
                    +
                  </button>

                  {updatePhase === "idle" && roomCountChanged && (
                    <Button size="sm" variant="default" onClick={previewUpdate}>
                      Preview update
                    </Button>
                  )}
                  {updatePhase === "previewing" && (
                    <Button size="sm" variant="default" isLoading disabled>
                      Checking…
                    </Button>
                  )}
                  {(updatePhase === "idle" || updatePhase === "previewing") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEditing}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                {/* Confirmation panel */}
                {preview &&
                  (updatePhase === "confirming" ||
                    updatePhase === "updating") && (
                    <div className="rounded-md border border-stroke bg-surface-secondary p-4 space-y-3">
                      <p className="text-sm font-semibold text-primary">
                        {confirmedRoomCount} → {pendingRoomCount}{" "}
                        {pendingRoomCount === 1 ? "room" : "rooms"}
                      </p>
                      {preview.amountDue > 0 ? (
                        <p className="text-sm text-secondary">
                          You'll be charged{" "}
                          <span className="font-semibold text-primary">
                            {formatCurrency(
                              preview.amountDue,
                              preview.currency,
                            )}
                          </span>{" "}
                          today, prorated to your next renewal date.
                        </p>
                      ) : preview.total < 0 ? (
                        <p className="text-sm text-secondary">
                          You'll receive a{" "}
                          <span className="font-semibold text-primary">
                            {formatCurrency(
                              Math.abs(preview.total),
                              preview.currency,
                            )}{" "}
                            credit
                          </span>{" "}
                          for the unused portion of your current billing period.
                          This is added to your account balance and
                          automatically deducted from your next invoice.
                        </p>
                      ) : (
                        <p className="text-sm text-secondary">
                          No charge. The change takes effect immediately.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={updatePhase === "updating"}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={confirmUpdate}
                          isLoading={updatePhase === "updating"}
                        >
                          {preview.amountDue > 0
                            ? `Confirm & pay ${formatCurrency(preview.amountDue, preview.currency)}`
                            : "Confirm change"}
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 py-4">
          <Alert variant="destructive" title="Error">
            {error}
          </Alert>
        </div>
      )}

      {/* Portal + cancel (Business only) */}
      {isActive && canManage && (
        <div className="p-6 space-y-4">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={openPortal}
              isLoading={portalLoading}
            >
              <MdOpenInNew className="size-4" />
              Manage subscription
            </Button>
            <p className="mt-1.5 text-xs text-tertiary">
              Switch billing cycle, update payment method, billing address, or
              download invoices.
            </p>
          </div>

          {/* Cancel subscription */}
          {cancelPhase === "idle" && !isCancelScheduled && (
            <button
              type="button"
              onClick={() => setCancelPhase("confirming")}
              className="text-xs text-red-600 hover:underline dark:text-red-400 cursor-pointer"
            >
              Cancel subscription
            </button>
          )}

          {(cancelPhase === "confirming" || cancelPhase === "cancelling") && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3 dark:border-red-900/40 dark:bg-red-950/20">
              <p className="text-sm font-semibold text-primary">
                Cancel your Business subscription?
              </p>
              <p className="text-sm text-secondary">
                Your plan stays active until{" "}
                <span className="font-medium text-primary">
                  {periodEnd
                    ? formatDate(periodEnd)
                    : "the end of your billing period"}
                </span>
                . After that, you'll move to the Free plan. Unused time is not
                refunded. You can reactivate at any time via{" "}
                <button
                  type="button"
                  onClick={openPortal}
                  className="underline hover:no-underline cursor-pointer"
                >
                  Manage subscription
                </button>
                .
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCancelPhase("idle")}
                  disabled={cancelPhase === "cancelling"}
                >
                  Keep subscription
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={cancelSubscription}
                  isLoading={cancelPhase === "cancelling"}
                >
                  Yes, cancel
                </Button>
              </div>
            </div>
          )}

          {isCancelScheduled &&
            cancelPhase !== "confirming" &&
            cancelPhase !== "cancelling" && (
              <Alert variant="warning" title="Subscription cancelled">
                Your Business plan will remain active until{" "}
                {effectivePeriodEnd
                  ? formatDate(effectivePeriodEnd)
                  : "the end of the billing period"}
                . Use "Manage subscription" to reactivate before then.
              </Alert>
            )}
        </div>
      )}
    </section>
  );
}

function UpgradeSection({ org, slug }: { org: OrgData; slug: string }) {
  const [selectedPlan, setSelectedPlan] = useState<
    (typeof PLANS)[number] | null
  >(null);
  const [roomCount, setRoomCount] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCheckout = useCallback(() => {
    setSelectedPlan(null);
    setClientSecret(null);
  }, []);

  const startCheckout = useCallback(
    async (plan: (typeof PLANS)[number]) => {
      if (selectedPlan?.label === plan.label && clientSecret) {
        resetCheckout();
        return;
      }
      const priceId =
        plan.priceIdKey === "STRIPE_PRICE_ID_MONTHLY"
          ? appData.getStripePriceIdMonthly()
          : appData.getStripePriceIdAnnual();
      if (!priceId) {
        setError(`${plan.priceIdKey} is not configured on the server.`);
        return;
      }
      setLoading(true);
      setError(null);
      setClientSecret(null);
      setSelectedPlan(plan);
      try {
        const { data } = await stripePost("/stripe/create-checkout-session", {
          organizationId: org.id,
          slug,
          priceId,
          quantity: roomCount,
        });
        setClientSecret(data.clientSecret);
      } catch (e: any) {
        setError(apiError(e, "Failed to start checkout"));
        setSelectedPlan(null);
      } finally {
        setLoading(false);
      }
    },
    [org.id, slug, roomCount, selectedPlan, clientSecret, resetCheckout],
  );

  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret],
  );

  return (
    <section className="space-y-6">
      <div className="border-t border-stroke pt-6">
        <h2 className="text-lg font-semibold text-primary">
          Upgrade to Business
        </h2>
        <p className="mt-1 text-sm text-secondary">Everything in Free, plus:</p>
        <ul className="mt-3 space-y-1.5">
          {FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2 text-sm text-secondary"
            >
              <MdCheck className="size-4 shrink-0 text-teal-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-stroke bg-surface-primary p-5 space-y-5">
        {/* Room picker */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-primary text-sm">How many rooms?</p>
            <p className="text-xs text-secondary mt-0.5">
              Each room is a separate live presentation session.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Remove a room"
              onClick={() => {
                setRoomCount((n) => Math.max(1, n - 1));
                resetCheckout();
              }}
              disabled={roomCount <= 1}
              className="w-8 h-8 rounded-md border border-stroke flex items-center justify-center text-primary hover:bg-surface-primary-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-medium"
            >
              -
            </button>
            <span className="w-10 text-center font-bold text-primary text-lg tabular-nums">
              {roomCount}
            </span>
            <button
              type="button"
              aria-label="Add a room"
              onClick={() => {
                setRoomCount((n) => n + 1);
                resetCheckout();
              }}
              className="w-8 h-8 rounded-md border border-stroke flex items-center justify-center text-primary hover:bg-surface-primary-hover cursor-pointer font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const total = plan.pricePerRoom * roomCount;
            const isSelected = selectedPlan?.label === plan.label;
            return (
              <button
                key={plan.label}
                type="button"
                onClick={() => startCheckout(plan)}
                disabled={loading}
                className={`relative rounded-md border-2 p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isSelected
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-500/10"
                    : "border-stroke hover:border-teal-400 hover:bg-surface-primary-hover"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {plan.badge}
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-tertiary">
                  {plan.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold text-primary">
                  £{total}
                  <span className="text-sm font-normal text-secondary">
                    {plan.unit}
                  </span>
                </p>
                {roomCount > 1 && (
                  <p className="mt-0.5 text-xs text-secondary">
                    £{plan.pricePerRoom} × {roomCount} rooms
                  </p>
                )}
                <p className="mt-2 text-xs text-secondary">{plan.note}</p>
                {isSelected && (
                  <p className="mt-2 text-xs font-semibold text-teal-600 dark:text-teal-400">
                    {clientSecret ? "Checkout open below ↓" : "Loading…"}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" title="Checkout error">
          {error}
        </Alert>
      )}

      {stripeOptions && (
        <div className="rounded-md border border-stroke overflow-hidden">
          <EmbeddedCheckoutProvider
            stripe={getStripe()}
            options={stripeOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </section>
  );
}

function FaqSection() {
  return (
    <section>
      <h2 className="text-xl font-bold mb-1">FAQ</h2>
      <p className="text-sm text-secondary mb-3">
        Still have questions?{" "}
        <a
          href="mailto:support@theopenpresenter.com"
          className="underline hover:no-underline"
        >
          Contact support
        </a>
        .
      </p>
      <Accordion type="multiple" defaultValue={["faq-0"]}>
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>
              <p className="leading-relaxed">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export default OrganizationBillingPage;
