import { useInviteToOrganizationMutation } from "@repo/graphql";
import { extractError, getCodeFromError } from "@repo/lib";
import { captureEvent } from "@repo/observability/initAnalytics";
import { Alert, Button, Input, Label } from "@repo/ui";
import { useCallback, useState } from "react";
import { FaCheck } from "react-icons/fa";
import { CombinedError } from "urql";

export type InviteStepProps = {
  organizationId: string;
};

type Invited = { email: string };

export const InviteStep = ({ organizationId }: InviteStepProps) => {
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<Invited[]>([]);
  const [error, setError] = useState<Error | CombinedError | null>(null);
  const [busy, setBusy] = useState(false);

  const [, inviteToOrganization] = useInviteToOrganizationMutation();

  const handleInvite = useCallback(async () => {
    const trimmed = email.trim();
    if (trimmed === "") return;

    setError(null);
    setBusy(true);
    try {
      await inviteToOrganization({ organizationId, email: trimmed });
      captureEvent("onboarding_member_invited");
      setInvited((current) => [...current, { email: trimmed }]);
      setEmail("");
    } catch (e: any) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }, [email, inviteToOrganization, organizationId]);

  const code = getCodeFromError(error);

  return (
    <div
      className="stack-col gap-4 w-full"
      data-testid="onboarding-step-invite"
    >
      <div className="w-full">
        <Label htmlFor="onboarding-invite-email" className="mb-1.5">
          Their email address
        </Label>
        <div className="flex gap-2 w-full">
          <Input
            id="onboarding-invite-email"
            type="email"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInvite();
              }
            }}
            placeholder="volunteer@example.com"
            data-testid="onboarding-invite-input"
          />
          <Button
            variant="outline"
            isLoading={busy}
            disabled={email.trim() === ""}
            onClick={handleInvite}
            data-testid="onboarding-invite-send"
          >
            Invite
          </Button>
        </div>
      </div>

      {invited.length > 0 && (
        <div className="w-full border border-gray-200 rounded-md divide-y divide-gray-100">
          {invited.map((person, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-2 px-3"
              data-testid="onboarding-invite-sent"
            >
              <FaCheck className="text-green-600 shrink-0" />
              <span className="text-sm">{person.email}</span>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <Alert variant="destructive" title="That didn't work">
          <div className="block">
            {code === "ISMBR" ? (
              <span>They're already part of your team.</span>
            ) : code === "VRFY2" ? (
              <span>
                That person has an account but hasn't verified their email
                address yet.
              </span>
            ) : code === "DNIED" ? (
              <span>
                Only the owner of this organization can invite people.
              </span>
            ) : (
              extractError(error).message
            )}
          </div>
        </Alert>
      ) : null}
    </div>
  );
};
