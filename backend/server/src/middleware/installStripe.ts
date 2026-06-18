import { logger } from "@repo/observability";
import express, { Express, RequestHandler } from "express";
import Stripe from "stripe";

import { getRootPgPool } from "./installDatabasePools";

// Needed Env Vars
// STRIPE_SECRET_KEY
// STRIPE_WEBHOOK_SECRET
// STRIPE_PUBLISHABLE_KEY
// STRIPE_PRICE_ID_MONTHLY
// STRIPE_PRICE_ID_ANNUAL

// Values attached to the request by the middlewares below.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      stripe?: Stripe;
      sessionId?: string;
      organizationId?: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  // apiVersion omitted. Uses the SDK's built-in latest version
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function verifyOrgAccess(
  app: Express,
  sessionId: string,
  organizationId: string,
): Promise<boolean> {
  const pool = getRootPgPool(app);
  const { rows } = await pool.query(
    `select om.is_owner, om.is_billing_contact
     from app_public.organization_memberships om
     join app_private.sessions s on s.user_id = om.user_id
     where s.uuid = $1 and om.organization_id = $2`,
    [sessionId, organizationId],
  );
  const row = rows[0];
  return !!(row?.is_owner || row?.is_billing_contact);
}

async function getOrCreateStripeCustomer(
  app: Express,
  stripe: Stripe,
  sessionId: string,
  organizationId: string,
): Promise<string> {
  const pool = getRootPgPool(app);

  const { rows: billingRows } = await pool.query(
    `select stripe_customer_id from app_private.organization_billing
     where organization_id = $1`,
    [organizationId],
  );

  if (billingRows[0]?.stripe_customer_id) {
    return billingRows[0].stripe_customer_id as string;
  }

  // Fetch user info to pre-fill the customer
  const { rows: userRows } = await pool.query(
    `select ue.email, u.name
     from app_public.users u
     join app_public.user_emails ue on ue.user_id = u.id
     join app_private.sessions s on s.user_id = u.id
     where s.uuid = $1 and ue.is_primary = true
     limit 1`,
    [sessionId],
  );

  const { rows: orgRows } = await pool.query(
    `select name from app_public.organizations where id = $1`,
    [organizationId],
  );

  const customer = await stripe.customers.create({
    email: userRows[0]?.email ?? undefined,
    name: orgRows[0]?.name ?? undefined,
    metadata: { organizationId },
  });

  await pool.query(
    `insert into app_private.organization_billing (organization_id, stripe_customer_id)
     values ($1, $2)
     on conflict (organization_id) do update set stripe_customer_id = excluded.stripe_customer_id`,
    [organizationId, customer.id],
  );

  return customer.id;
}

async function upsertSubscription(
  app: Express,
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<void> {
  const pool = getRootPgPool(app);
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const plan = isActive ? "business" : "free";
  const item = subscription.items.data[0];
  const quantity = item?.quantity ?? 1;
  const billingInterval = item?.price?.recurring?.interval ?? "month";
  const currentPeriodEnd = item?.current_period_end;

  await pool.query(
    `update app_private.organization_billing
     set
       stripe_subscription_id     = $1,
       stripe_subscription_status = $2,
       stripe_price_id            = $3,
       stripe_current_period_end  = to_timestamp($4),
       plan                       = $5,
       subscribed_room_count      = $6,
       billing_interval           = $7,
       cancel_at_period_end       = $8,
       cancel_at                  = to_timestamp($9),
       updated_at                 = now()
     where stripe_customer_id = $10`,
    [
      subscription.id,
      subscription.status,
      item?.price.id ?? null,
      currentPeriodEnd,
      plan,
      isActive ? quantity : 0,
      billingInterval,
      subscription.cancel_at_period_end ?? false,
      subscription.cancel_at ?? null,
      customerId,
    ],
  );
}

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------

// 503 unless Stripe is configured. Attaches a Stripe client as req.stripe
const requireStripe: RequestHandler = (req, res, next) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Stripe is not configured" });
    return;
  }
  req.stripe = getStripe();
  next();
};

// 401 unless the request is authenticated. Attaches req.sessionId
const requireAuth: RequestHandler = (req, res, next) => {
  const sessionId = req.user?.session_id as string | undefined;
  if (!sessionId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.sessionId = sessionId;
  next();
};

// 400 if organizationId is missing, 403 unless the caller is owner/billing
// contact of it. Reads organizationId from the parsed JSON body, so it must
// run after express.json() and requireAuth. Attaches req.organizationId
function requireOrgAccess(app: Express): RequestHandler {
  return async (req, res, next) => {
    const { organizationId } = (req.body ?? {}) as { organizationId?: string };
    if (!organizationId) {
      res.status(400).json({ error: "organizationId is required" });
      return;
    }
    const hasAccess = await verifyOrgAccess(
      app,
      req.sessionId!,
      organizationId,
    );
    if (!hasAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.organizationId = organizationId;
    next();
  };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default async function installStripe(app: Express): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.warn("STRIPE_SECRET_KEY not set - Stripe endpoints will return 503");
  }

  // Shared chain for the authenticated, org-scoped JSON endpoints.
  const orgScoped = [
    express.json(),
    requireAuth,
    requireStripe,
    requireOrgAccess(app),
  ];

  // ------------------------------------------------------------------
  // Creates an embedded Stripe Checkout session for a subscription.
  // Body: { organizationId, slug, priceId, quantity }
  // Returns: { clientSecret }
  // ------------------------------------------------------------------
  app.post(
    "/stripe/create-checkout-session",
    ...orgScoped,
    async (req, res) => {
      const { slug, priceId, quantity } = req.body as {
        slug?: string;
        priceId?: string;
        quantity?: number;
      };

      if (!slug || !priceId) {
        res.status(400).json({ error: "slug and priceId are required" });
        return;
      }

      const roomCount = Math.max(1, Math.floor(Number(quantity) || 1));

      try {
        const stripe = req.stripe!;
        const customerId = await getOrCreateStripeCustomer(
          app,
          stripe,
          req.sessionId!,
          req.organizationId!,
        );

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: "subscription",
          ui_mode: "embedded_page",
          line_items: [{ price: priceId, quantity: roomCount }],
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          customer_update: { address: "auto", name: "auto" },
          return_url: `${process.env.ROOT_URL}/o/${slug}/billing?session_id={CHECKOUT_SESSION_ID}`,
        });

        res.json({ clientSecret: session.client_secret });
      } catch (err: any) {
        logger.error({ err }, "create-checkout-session error");
        res.status(500).json({ error: err.message });
      }
    },
  );

  // ------------------------------------------------------------------
  // Creates a Stripe Customer Portal session for managing the subscription.
  // Body: { organizationId, slug }
  // Returns: { url }
  // ------------------------------------------------------------------
  app.post("/stripe/create-portal-session", ...orgScoped, async (req, res) => {
    const { slug } = req.body as { slug?: string };
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }

    try {
      const pool = getRootPgPool(app);
      const { rows } = await pool.query(
        `select stripe_customer_id from app_private.organization_billing
         where organization_id = $1`,
        [req.organizationId!],
      );

      const customerId = rows[0]?.stripe_customer_id as string | undefined;
      if (!customerId) {
        res
          .status(400)
          .json({ error: "No Stripe customer found for this organization" });
        return;
      }

      const portalSession = await req.stripe!.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.ROOT_URL}/o/${slug}/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (err: any) {
      logger.error({ err }, "create-portal-session error");
      res.status(500).json({ error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // Returns a cost preview (prorated) before the user commits to a change.
  // Body: { organizationId, quantity }
  // Returns: { amountDue, total, currency, lines }
  // ------------------------------------------------------------------
  app.post(
    "/stripe/preview-subscription-update",
    ...orgScoped,
    async (req, res) => {
      const { quantity } = req.body as { quantity?: number };
      if (!quantity) {
        res.status(400).json({ error: "quantity is required" });
        return;
      }

      const roomCount = Math.max(1, Math.floor(Number(quantity)));

      try {
        const pool = getRootPgPool(app);
        const { rows } = await pool.query(
          `select stripe_subscription_id from app_private.organization_billing
           where organization_id = $1`,
          [req.organizationId!],
        );

        const subscriptionId = rows[0]?.stripe_subscription_id as
          | string
          | undefined;
        if (!subscriptionId) {
          res.status(400).json({ error: "No active subscription found" });
          return;
        }

        const stripe = req.stripe!;
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const itemId = subscription.items.data[0]?.id;
        if (!itemId) {
          res.status(400).json({ error: "Subscription has no line items" });
          return;
        }

        const preview = await stripe.invoices.createPreview({
          subscription: subscriptionId,
          // Include VAT in the quote so it matches what's actually charged.
          automatic_tax: { enabled: true },
          subscription_details: {
            items: [{ id: itemId, quantity: roomCount }],
            proration_behavior: "always_invoice",
          },
        });

        res.json({
          amountDue: preview.amount_due, // what the customer owes (0 for downgrades)
          total: preview.total, // negative when a credit is being issued
          currency: preview.currency,
          lines: preview.lines.data.map((l) => ({
            description: l.description,
            amount: l.amount,
          })),
        });
      } catch (err: any) {
        logger.error({ err }, "preview-subscription-update error");
        res.status(500).json({ error: err.message });
      }
    },
  );

  // ------------------------------------------------------------------
  // Updates room quantity on an existing subscription (proration applied).
  // Body: { organizationId, quantity }
  // Returns: { success: true }
  // ------------------------------------------------------------------
  app.post("/stripe/update-subscription", ...orgScoped, async (req, res) => {
    const { quantity } = req.body as { quantity?: number };
    if (!quantity) {
      res.status(400).json({ error: "quantity is required" });
      return;
    }

    const roomCount = Math.max(1, Math.floor(Number(quantity)));

    try {
      const pool = getRootPgPool(app);
      const { rows } = await pool.query(
        `select stripe_subscription_id from app_private.organization_billing
         where organization_id = $1`,
        [req.organizationId!],
      );

      const subscriptionId = rows[0]?.stripe_subscription_id as
        | string
        | undefined;
      if (!subscriptionId) {
        res.status(400).json({ error: "No active subscription found" });
        return;
      }

      const stripe = req.stripe!;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) {
        res.status(400).json({ error: "Subscription has no line items" });
        return;
      }

      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, quantity: roomCount }],
        proration_behavior: "always_invoice",
      });

      res.json({ success: true });
    } catch (err: any) {
      logger.error({ err }, "update-subscription error");
      res.status(500).json({ error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // Schedules the subscription to cancel at the end of the current period.
  // Body: { organizationId }
  // Returns: { cancelAt }   (unix timestamp of when access ends)
  // ------------------------------------------------------------------
  app.post("/stripe/cancel-subscription", ...orgScoped, async (req, res) => {
    try {
      const pool = getRootPgPool(app);
      const { rows } = await pool.query(
        `select stripe_subscription_id from app_private.organization_billing
         where organization_id = $1`,
        [req.organizationId!],
      );

      const subscriptionId = rows[0]?.stripe_subscription_id as
        | string
        | undefined;
      if (!subscriptionId) {
        res.status(400).json({ error: "No active subscription found" });
        return;
      }

      const subscription = await req.stripe!.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true },
      );

      res.json({ cancelAt: subscription.cancel_at });
    } catch (err: any) {
      logger.error({ err }, "cancel-subscription error");
      res.status(500).json({ error: err.message });
    }
  });

  // ------------------------------------------------------------------
  // Receives Stripe webhook events and keeps the DB in sync.
  // Must use raw body (not parsed JSON) for signature verification.
  // ------------------------------------------------------------------
  app.post(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    requireStripe,
    async (req, res) => {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        res.status(503).json({ error: "Stripe webhook is not configured" });
        return;
      }

      const stripe = req.stripe!;
      const sig = req.headers["stripe-signature"] as string;
      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err: any) {
        logger.warn({ err }, "Stripe webhook signature verification failed");
        res.status(400).send(`Webhook error: ${err.message}`);
        return;
      }

      try {
        logger.trace({ event }, "Processing stripe webhook event");

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            if (session.mode === "subscription" && session.subscription) {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string,
              );
              await upsertSubscription(
                app,
                subscription,
                session.customer as string,
              );
            }
            break;
          }

          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            await upsertSubscription(
              app,
              subscription,
              subscription.customer as string,
            );
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as Stripe.Invoice;
            const pool = getRootPgPool(app);
            await pool.query(
              `update app_private.organization_billing
               set stripe_subscription_status = 'past_due', plan = 'free', updated_at = now()
               where stripe_customer_id = $1`,
              [invoice.customer as string],
            );
            break;
          }

          default:
            // Ignore unhandled events
            break;
        }

        res.json({ received: true });
      } catch (err: any) {
        logger.error(
          { err, eventType: event.type },
          "Stripe webhook handler error",
        );
        res.status(500).json({ error: "Webhook handler failed" });
      }
    },
  );
}
