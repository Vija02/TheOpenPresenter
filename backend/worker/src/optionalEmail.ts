import type { WithPgClient } from "graphile-worker";

/**
 * Optional (non-account) emails a user can unsubscribe from. Must match the
 * `app_public.email_category` enum in the database.
 */
export type EmailCategory = "onboarding";

export interface OptionalEmailRecipient {
  userId: string;
  email: string;
  username: string;
  name: string | null;
  variables: {
    unsubscribeLink: string;
    emailSettingsLink: string;
  };
  headers: Record<string, string>;
}

/**
 * Every optional email must go through this before being sent.
 *
 * Returns `null` if the email shouldn't be sent: the user has unsubscribed
 * from this category, or has no verified primary email address.
 */
export async function getOptionalEmailRecipient(
  withPgClient: WithPgClient,
  userId: string,
  category: EmailCategory,
): Promise<OptionalEmailRecipient | null> {
  const {
    rows: [row],
  } = await withPgClient((pgClient) =>
    pgClient.query<{
      email: string;
      username: string;
      name: string | null;
      email_unsubscribe_token: string;
    }>(
      `
        select user_emails.email, users.username, users.name, user_secrets.email_unsubscribe_token
        from app_public.users
        inner join app_public.user_emails
          on user_emails.user_id = users.id
          and user_emails.is_primary is true
          and user_emails.is_verified is true
        inner join app_private.user_secrets
          on user_secrets.user_id = users.id
        where users.id = $1
        and app_private.user_wants_email(users.id, $2::app_public.email_category)
      `,
      [userId, category],
    ),
  );
  if (!row) {
    return null;
  }

  const params = `token=${encodeURIComponent(
    row.email_unsubscribe_token,
  )}&category=${encodeURIComponent(category)}`;

  return {
    userId,
    email: row.email,
    username: row.username,
    name: row.name,
    variables: {
      unsubscribeLink: `${process.env.ROOT_URL}/unsubscribe?${params}`,
      emailSettingsLink: `${process.env.ROOT_URL}/settings/emails`,
    },
    headers: {
      // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo for bulk mail)
      "List-Unsubscribe": `<${process.env.ROOT_URL}/email/unsubscribe?${params}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
