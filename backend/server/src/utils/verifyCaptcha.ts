/**
 * Cloudflare Turnstile server-side verification.
 *
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Turnstile is only enforced when `TURNSTILE_SECRET_KEY` is configured. This
 * keeps local development and self-hosted deployments working out of the box
 * without a Cloudflare account; captcha protection is opt-in via env vars.
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Returns true if the captcha is valid (or if captcha is not configured, in
 * which case verification is skipped).
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Captcha not configured -> feature disabled, allow through.
  if (!secret) {
    return true;
  }

  // Captcha configured but no token supplied -> reject.
  if (!token) {
    return false;
  }

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) {
    body.append("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
    });
    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      console.warn(
        "Turnstile verification rejected:",
        data["error-codes"]?.join(", ") ?? "unknown",
      );
    }
    return !!data.success;
  } catch (e) {
    // Network/parse error talking to Cloudflare. Fail closed so a captcha
    // outage doesn't silently disable protection.
    console.error("Turnstile verification request failed", e);
    return false;
  }
}

/**
 * Verifies the captcha token and throws a safe GraphQL error (code `CAPTC`)
 * when it is invalid. No-op when captcha is not configured.
 */
export async function assertValidCaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<void> {
  const ok = await verifyCaptchaToken(token, remoteIp);
  if (!ok) {
    throw Object.assign(
      new Error(
        "Captcha verification failed. Please complete the challenge and try again.",
      ),
      { code: "CAPTC" },
    );
  }
}
