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
import { useCallback, useEffect, useMemo, useState } from "react";
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
// Annual is no longer sold; kept only to display existing annual subscriptions.
const PRICE_ANNUAL_GBP = 790;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
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
    q: "How much does a room cost?",
    a: `Each room is £${PRICE_MONTHLY_GBP}/month, billed monthly. You can add or remove rooms at any time, and cancel whenever you like.`,
  },
  {
    q: "Can I buy a room instead of subscribing?",
    a: "Yes. A Lifetime room is a one-time purchase: pay once and it's yours for good, with no subscription. Buying several at once is cheaper per room. Lifetime rooms sit alongside any monthly rooms you have.",
  },
  {
    q: "How does proration work when I change room count?",
    a: "When you add rooms, you're charged immediately for the prorated cost of the remaining days in your billing period. When you remove rooms, you receive a credit for the unused days. This is automatically deducted from your next invoice. You'll always see the exact amount before confirming.",
  },
  {
    q: "What happens when I cancel?",
    a: 'Your Cloud plan stays active until the end of your current billing period. After that, your organization moves to the Free plan automatically. We don\'t issue refunds for remaining time. To reactivate, click "Manage subscription". You can resume from the Stripe portal at any time before the period ends.',
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
  const lifetimeRoomCount = billingInfo?.lifetimeRoomCount ?? 0;
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
              <Alert variant="success" title="Payment successful">
                Thank you! Your purchase is being applied and will appear here
                in a moment.
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
              lifetimeRoomCount={lifetimeRoomCount}
              billingInterval={billingInterval}
              scheduledCancel={scheduledCancel}
              serverCancelAt={serverCancelAt}
              canManage={canManage}
              org={org}
              slug={slug}
            />

            {canManage && (
              <UpgradePanel org={org} slug={slug} isActive={isActive} />
            )}
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
  lifetimeRoomCount,
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
  lifetimeRoomCount: number;
  billingInterval: string;
  scheduledCancel: boolean;
  serverCancelAt: Date | null;
  canManage: boolean | null;
  org: OrgData;
  slug: string;
}) {
  const hasLifetime = lifetimeRoomCount > 0;

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
            {isActive ? "Cloud plan" : hasLifetime ? "Lifetime" : "Free plan"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-500/20 dark:text-teal-300">
              <MdStar className="size-3" />
              Cloud
            </span>
          )}
          {hasLifetime && (
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-500/20 dark:text-teal-300">
              <MdStar className="size-3" />
              Lifetime
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
        ) : hasLifetime ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="Displays">Unlimited</Stat>
            <Stat label="Storage">50 GB / room</Stat>
            <Stat label="Plugins">All included</Stat>
            <Stat label="Support">Priority</Stat>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="Displays">Up to 5</Stat>
            <Stat label="Storage">1 GB</Stat>
            <Stat label="Plugins">All included</Stat>
            <Stat label="Support">Community</Stat>
          </div>
        )}

        {hasLifetime && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <MdStar className="size-4 text-teal-500 shrink-0" />
            <span className="font-medium text-primary">
              {lifetimeRoomCount} lifetime{" "}
              {lifetimeRoomCount === 1 ? "room" : "rooms"} owned
            </span>
            <span className="text-tertiary">· yours forever, no renewal</span>
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

      {/* Portal + cancel (Cloud only) */}
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
              Update payment method, billing address, or download invoices.
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
                Cancel your Cloud subscription?
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
                Your Cloud plan will remain active until{" "}
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

function UpgradePanel({
  org,
  slug,
  isActive,
}: {
  org: OrgData;
  slug: string;
  isActive: boolean;
}) {
  // Already subscribed monthly? Monthly room changes happen in the overview,
  // so only Lifetime is offered here. Otherwise let them switch between the two.
  const [mode, setMode] = useState<"monthly" | "lifetime">(
    isActive ? "lifetime" : "monthly",
  );

  return (
    <section className="space-y-6">
      <div className="border-t border-stroke pt-6">
        <h2 className="text-lg font-semibold text-primary">
          {isActive ? "Own rooms for life" : "Add rooms"}
        </h2>
        <p className="mt-1 text-sm text-secondary">Everything in Free, plus:</p>
        <ul className="mt-3 columns-1 sm:columns-2 sm:gap-x-8">
          {FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-sm text-secondary break-inside-avoid mb-1.5"
            >
              <MdCheck className="size-4 shrink-0 text-teal-500 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {!isActive && (
        <div className="flex w-full rounded-lg border border-stroke bg-surface-secondary p-1">
          <button
            type="button"
            onClick={() => setMode("monthly")}
            className={`flex-1 px-6 py-2.5 text-base font-semibold rounded-md cursor-pointer transition-colors ${
              mode === "monthly"
                ? "bg-surface-primary text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setMode("lifetime")}
            className={`flex-1 px-6 py-2.5 text-base font-semibold rounded-md cursor-pointer transition-colors ${
              mode === "lifetime"
                ? "bg-surface-primary text-primary shadow-sm"
                : "text-secondary hover:text-primary"
            }`}
          >
            Lifetime
          </button>
        </div>
      )}

      {mode === "monthly" ? (
        <UpgradeSection org={org} slug={slug} />
      ) : (
        <LifetimeSection org={org} slug={slug} />
      )}
    </section>
  );
}

function UpgradeSection({ org, slug }: { org: OrgData; slug: string }) {
  const [roomCount, setRoomCount] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = PRICE_MONTHLY_GBP * roomCount;

  const resetCheckout = useCallback(() => setClientSecret(null), []);

  const startCheckout = useCallback(async () => {
    const priceId = appData.getStripePriceIdMonthly();
    if (!priceId) {
      setError("STRIPE_PRICE_ID_MONTHLY is not configured on the server.");
      return;
    }
    setLoading(true);
    setError(null);
    setClientSecret(null);
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
    } finally {
      setLoading(false);
    }
  }, [org.id, slug, roomCount]);

  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-stroke bg-surface-primary p-5 space-y-5">
        {/* Room picker */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-primary text-sm">How many rooms?</p>
            <p className="text-xs text-secondary mt-0.5">
              Billed monthly. Cancel anytime.
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

        {/* Price + subscribe */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              £{total}
              <span className="text-sm font-normal text-secondary">/mo</span>
            </p>
            {roomCount > 1 && (
              <p className="mt-0.5 text-xs text-secondary">
                £{PRICE_MONTHLY_GBP} × {roomCount} rooms
              </p>
            )}
          </div>
          <Button
            variant="default"
            onClick={startCheckout}
            isLoading={loading}
            disabled={loading || !!clientSecret}
          >
            Subscribe
          </Button>
        </div>
        <p className="text-xs text-tertiary">
          Includes AI tools: auto-formatted slides, generated backgrounds, and
          smart lyric &amp; scripture lookup.
        </p>
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

function LifetimeSection({ org, slug }: { org: OrgData; slug: string }) {
  const [roomCount, setRoomCount] = useState(1);
  const [preview, setPreview] = useState<{
    unitAmount: number;
    total: number;
    currency: string;
  } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh the tiered price whenever the room count changes.
  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    stripePost("/stripe/preview-lifetime", {
      organizationId: org.id,
      quantity: roomCount,
    })
      .then(({ data }) => {
        if (!cancelled) {
          setPreview({
            unitAmount: data.unitAmount,
            total: data.total,
            currency: data.currency,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [org.id, roomCount]);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    setClientSecret(null);
    try {
      const { data } = await stripePost("/stripe/create-lifetime-checkout", {
        organizationId: org.id,
        slug,
        quantity: roomCount,
      });
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      setError(apiError(e, "Failed to start checkout"));
    } finally {
      setLoading(false);
    }
  }, [org.id, slug, roomCount]);

  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-stroke bg-surface-primary p-5 space-y-5">
        {/* Room picker */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-primary text-sm">How many rooms?</p>
            <p className="text-xs text-secondary mt-0.5">
              £790 each for 2–4, £590 each for 5+.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Remove a room"
              onClick={() => setRoomCount((n) => Math.max(1, n - 1))}
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
              onClick={() => setRoomCount((n) => n + 1)}
              className="w-8 h-8 rounded-md border border-stroke flex items-center justify-center text-primary hover:bg-surface-primary-hover cursor-pointer font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* Price + buy */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              {preview ? formatCurrency(preview.total, preview.currency) : "…"}
              <span className="text-sm font-normal text-secondary">
                {" "}
                one-time
              </span>
            </p>
            {preview && roomCount > 1 && (
              <p className="mt-0.5 text-xs text-secondary">
                {formatCurrency(preview.unitAmount, preview.currency)} ×{" "}
                {roomCount} rooms
              </p>
            )}
          </div>
          <Button
            variant="default"
            onClick={startCheckout}
            isLoading={loading}
            disabled={loading || !!clientSecret}
          >
            Buy for life
          </Button>
        </div>
        <p className="text-xs text-tertiary">
          Includes 1 year of AI tools and priority support.
        </p>
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
