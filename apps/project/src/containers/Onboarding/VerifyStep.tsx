import { Button, Link } from "@repo/ui";
import { useEffect, useState } from "react";
import { MdOutlineMarkEmailUnread } from "react-icons/md";

export type VerifyStepProps = {
  email?: string | null;
  onResend: () => Promise<void> | void;
  onRecheck: () => void;
  onCheckVerified: () => Promise<boolean>;
};

export const VerifyStep = ({
  email,
  onResend,
  onRecheck,
  onCheckVerified,
}: VerifyStepProps) => {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notVerifiedYet, setNotVerifiedYet] = useState(false);

  // People verify in another tab, which leaves this one none the wiser.
  useEffect(() => {
    const id = window.setInterval(onRecheck, 5000);
    return () => window.clearInterval(id);
  }, [onRecheck]);

  const handleCheck = async () => {
    setChecking(true);
    setNotVerifiedYet(false);
    try {
      const verified = await onCheckVerified();
      setNotVerifiedYet(!verified);
      if (verified) onRecheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className="stack-col items-start gap-6 w-full"
      data-testid="onboarding-step-verify"
    >
      <div className="stack-col items-center gap-3 w-full py-2 text-center">
        <MdOutlineMarkEmailUnread className="size-10 text-fill-success" />
        <p className="text-secondary">
          We've sent a link to{" "}
          <span className="font-semibold text-primary break-all">
            {email ?? "your email address"}
          </span>
        </p>
        <p className="text-sm text-tertiary">
          Open it and click the link to continue.
        </p>
      </div>

      <div className="stack-col items-center gap-1.5 w-full">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            isLoading={resending}
            onClick={async () => {
              setResending(true);
              try {
                await onResend();
                setSent(true);
              } finally {
                setResending(false);
              }
            }}
            data-testid="onboarding-verify-resend"
          >
            {sent ? "Send it again" : "Resend the email"}
          </Button>
          <Link asChild className="text-sm">
            <button
              type="button"
              disabled={checking}
              onClick={handleCheck}
              data-testid="onboarding-verify-recheck"
            >
              {checking ? "Checking..." : "I've verified my email"}
            </button>
          </Link>
        </div>
        {notVerifiedYet ? (
          <p
            className="text-xs text-fill-destructive"
            data-testid="onboarding-verify-not-yet"
          >
            That email isn't verified yet. Open the link we sent, then try
            again.
          </p>
        ) : (
          <p className="text-xs text-tertiary">
            Nothing yet? Check your spam folder, it sometimes lands there.
          </p>
        )}
      </div>
    </div>
  );
};
