import { SharedOrgLayout } from "@/components/SharedOrgLayout";
import {
  useOrganizationLoading,
  useOrganizationSlug,
} from "@/lib/permissionHooks/organization";
import {
  OrganizationBillingPageQuery,
  OrganizationType,
  useOrganizationBillingPageQuery,
} from "@repo/graphql";
import { appData } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
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

const PRICE_MONTHLY_GBP = 19;
const PRICE_ANNUAL_GBP = 190;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FEATURES = [
  "Unlimited users, all at once",
  "Unlimited connected displays",
  "Drive main screen, confidence monitor, and signage from one synchronised show",
  "Guest portal, so a visiting speaker can present from their own device",
  "50 GB storage",
  "AI lyric formatting",
  "Priority email support",
];

const FAQ_ITEMS = [
  {
    q: "Do you charge per user?",
    a: "No. Every plan, including Free, allows unlimited users controlling the same presentation at once. There are no seats to buy and no per-user cost, however many volunteers you have.",
  },
  {
    q: "What's included in the Free plan?",
    a: "Free includes unlimited users, up to 5 connected displays, 1 GB storage, all official plugins, unlimited presentations, and no time limit. No credit card required.",
  },
  {
    q: "How much is the Cloud plan?",
    a: `£${PRICE_MONTHLY_GBP}/month for your whole organization, billed monthly. Cancel whenever you like.`,
  },
  {
    q: "Can I buy it outright instead of subscribing?",
    a: "Yes. The Lifetime licence is a one-time purchase: pay once and it's yours for good, with no subscription and no exposure to future price changes. Bug fixes and security updates are always included.",
  },
  {
    q: "We're a small church. Is there help with the cost?",
    a: "Churches under 50 weekly attendance get the full Cloud plan free through our sponsorship programme, storage and AI credits included. Get in touch and we'll set it up.",
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
type CancelPhase = "idle" | "confirming" | "cancelling" | "success";
type Mode = "monthly" | "yearly" | "lifetime";

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
  const status = billingInfo?.subscriptionStatus ?? null;
  const periodEnd = billingInfo?.currentPeriodEnd
    ? new Date(billingInfo.currentPeriodEnd)
    : null;
  const hasLifetime = (billingInfo?.lifetimeRoomCount ?? 0) > 0;
  const billingInterval = billingInfo?.billingInterval ?? "month";
  const scheduledCancel = billingInfo?.cancelAtPeriodEnd ?? false;
  const serverCancelAt = billingInfo?.cancelAt
    ? new Date(billingInfo.cancelAt)
    : null;
  const isActive = status === "active" || status === "trialing";

  return (
    <div className="w-full grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary">Billing</h1>
          <p className="mt-1 text-sm text-secondary">
            Manage your plan and payment details for this organization.
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

            {org.organizationType === OrganizationType.Church &&
              !isActive &&
              !hasLifetime && (
                <div className="rounded-md border border-teal-200 bg-teal-50 p-4 flex items-start gap-3 dark:border-teal-900/40 dark:bg-teal-950/20">
                  <MdStar className="size-5 text-teal-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-primary">
                      Your church may be eligible for a free Cloud plan
                    </p>
                    <p className="text-sm text-secondary">
                      Small churches get the full Cloud plan free through our
                      sponsorship programme, storage and AI credits included.{" "}
                      <a
                        href="https://theopenpresenter.com/church/sponsorship"
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:no-underline font-medium text-teal-700 dark:text-teal-300"
                      >
                        Check eligibility and apply
                      </a>
                      .
                    </p>
                  </div>
                </div>
              )}

            <PlanOverviewCard
              status={status}
              periodEnd={periodEnd}
              isActive={isActive}
              hasLifetime={hasLifetime}
              billingInterval={billingInterval}
              scheduledCancel={scheduledCancel}
              serverCancelAt={serverCancelAt}
              canManage={canManage}
              org={org}
              slug={slug}
            />

            {canManage && (
              <UpgradePanel
                org={org}
                slug={slug}
                isActive={isActive}
                hasLifetime={hasLifetime}
              />
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
  hasLifetime,
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
  hasLifetime: boolean;
  billingInterval: string;
  scheduledCancel: boolean;
  serverCancelAt: Date | null;
  canManage: boolean | null;
  org: OrgData;
  slug: string;
}) {
  // Portal
  const [portalLoading, setPortalLoading] = useState(false);

  // Cancel
  const [cancelPhase, setCancelPhase] = useState<CancelPhase>("idle");
  const [cancelAt, setCancelAt] = useState<Date | null>(null);

  const [error, setError] = useState<string | null>(null);

  // One plan per organization, so the charge is just the plan price.
  const nextChargeAmount =
    billingInterval === "year" ? PRICE_ANNUAL_GBP : PRICE_MONTHLY_GBP;
  const nextChargeUnit = billingInterval === "year" ? "/yr" : "/mo";

  const cancelSubscription = useCallback(async () => {
    setCancelPhase("cancelling");
    setError(null);
    try {
      const { data } = await stripePost("/stripe/cancel-subscription", {
        organizationId: org.id,
      });
      setCancelAt(data.cancelAt ? new Date(data.cancelAt * 1000) : periodEnd);
      captureEvent("subscription_canceled", {
        billing_interval: billingInterval,
      });
      setCancelPhase("success");
    } catch (e: any) {
      setError(apiError(e, "Failed to cancel subscription"));
      setCancelPhase("confirming");
    }
  }, [org.id, periodEnd, billingInterval]);

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
            <Stat label="Users">Unlimited</Stat>
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
            <Stat label="Users">Unlimited</Stat>
            <Stat label="Displays">Unlimited</Stat>
            <Stat label="Storage">50 GB</Stat>
            <Stat label="Support">Priority</Stat>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="Users">Unlimited</Stat>
            <Stat label="Displays">Up to 5</Stat>
            <Stat label="Storage">1 GB</Stat>
            <Stat label="Support">Community</Stat>
          </div>
        )}

        {hasLifetime && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <MdStar className="size-4 text-teal-500 shrink-0" />
            <span className="font-medium text-primary">
              Lifetime licence owned
            </span>
            <span className="text-tertiary">· yours forever, no renewal</span>
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
  hasLifetime,
}: {
  org: OrgData;
  slug: string;
  isActive: boolean;
  hasLifetime: boolean;
}) {
  const modes: { key: Mode; label: string }[] = [
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
    { key: "lifetime", label: "Lifetime" },
  ];

  // Already subscribed? The only upsell left is owning it outright.
  const [mode, setMode] = useState<Mode>(isActive ? "lifetime" : "monthly");

  if (hasLifetime) return null;

  return (
    <section className="space-y-6">
      <div className="border-t border-stroke pt-6">
        <h2 className="text-lg font-semibold text-primary">
          {isActive ? "Own it for life" : "Upgrade to Cloud"}
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
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`flex-1 px-4 py-2.5 text-base font-semibold rounded-md cursor-pointer transition-colors ${
                mode === m.key
                  ? "bg-surface-primary text-primary shadow-sm"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === "lifetime" ? (
        <LifetimeSection org={org} slug={slug} />
      ) : (
        <UpgradeSection
          org={org}
          slug={slug}
          interval={mode === "yearly" ? "year" : "month"}
        />
      )}
    </section>
  );
}

function UpgradeSection({
  org,
  slug,
  interval,
}: {
  org: OrgData;
  slug: string;
  interval: "month" | "year";
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isYearly = interval === "year";

  // Switching interval invalidates any checkout already on screen.
  useEffect(() => {
    setClientSecret(null);
    setError(null);
  }, [interval]);

  const startCheckout = useCallback(async () => {
    const priceId = isYearly
      ? appData.getStripePriceIdAnnual()
      : appData.getStripePriceIdMonthly();
    if (!priceId) {
      setError(
        `${isYearly ? "STRIPE_PRICE_ID_ANNUAL" : "STRIPE_PRICE_ID_MONTHLY"} is not configured on the server.`,
      );
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
        quantity: 1,
      });
      setClientSecret(data.clientSecret);
      captureEvent("checkout_started", {
        plan_type: "cloud",
        billing_interval: interval,
      });
    } catch (e: any) {
      setError(apiError(e, "Failed to start checkout"));
    } finally {
      setLoading(false);
    }
  }, [org.id, slug, isYearly, interval]);

  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret],
  );

  const yearlySaving = PRICE_MONTHLY_GBP * 12 - PRICE_ANNUAL_GBP;

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-stroke bg-surface-primary p-5 space-y-5">
        {/* Price + subscribe */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold text-primary">
              £{isYearly ? PRICE_ANNUAL_GBP : PRICE_MONTHLY_GBP}
              <span className="text-sm font-normal text-secondary">
                {isYearly ? "/yr" : "/mo"}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-secondary">
              {isYearly
                ? `For your whole organization. Saves £${yearlySaving} a year against monthly.`
                : "For your whole organization. Billed monthly, cancel anytime."}
            </p>
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
  const [preview, setPreview] = useState<{
    unitAmount: number;
    total: number;
    currency: string;
  } | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price comes from the server rather than a constant, so it can't drift
  // away from what Stripe actually charges.
  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    stripePost("/stripe/preview-lifetime", {
      organizationId: org.id,
      quantity: 1,
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
  }, [org.id]);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    setClientSecret(null);
    try {
      const { data } = await stripePost("/stripe/create-lifetime-checkout", {
        organizationId: org.id,
        slug,
        quantity: 1,
      });
      setClientSecret(data.clientSecret);
      captureEvent("checkout_started", {
        plan_type: "lifetime",
      });
    } catch (e: any) {
      setError(apiError(e, "Failed to start checkout"));
    } finally {
      setLoading(false);
    }
  }, [org.id, slug]);

  const stripeOptions = useMemo(
    () => (clientSecret ? { clientSecret } : null),
    [clientSecret],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-stroke bg-surface-primary p-5 space-y-5">
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
            <p className="mt-0.5 text-xs text-secondary">
              Yours for good. No subscription, and no future price changes.
            </p>
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
          Includes AI tools: auto-formatted slides, generated backgrounds, and
          smart lyric &amp; scripture lookup. Bug fixes and security updates are
          always included.
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
