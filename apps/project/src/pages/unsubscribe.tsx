import { SharedLayout } from "@/components/SharedLayout";
import { emailCategoryInfo, parseEmailCategory } from "@/lib/emailCategories";
import {
  useSetEmailSubscriptionByTokenMutation,
  useSharedQuery,
} from "@repo/graphql";
import { Alert, Button } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "wouter";

type Status = "working" | "unsubscribed" | "resubscribed" | "invalid";

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const category = parseEmailCategory(searchParams.get("category"));

  const [status, setStatus] = useState<Status>(
    token && category ? "working" : "invalid",
  );
  const [error, setError] = useState(false);
  const [{ fetching }, setSubscription] =
    useSetEmailSubscriptionByTokenMutation();

  const update = useCallback(
    async (subscribed: boolean) => {
      if (!token || !category) return;
      setError(false);
      try {
        const data = await setSubscription({ token, category, subscribed });
        if (!data?.setEmailSubscriptionByToken?.success) {
          setStatus("invalid");
        } else {
          setStatus(subscribed ? "resubscribed" : "unsubscribed");
        }
      } catch {
        setError(true);
      }
    },
    [category, setSubscription, token],
  );

  // Opening the link is enough to unsubscribe
  useEffect(() => {
    if (token && category) {
      update(false);
    }
  }, [category, token, update]);

  const label = category ? emailCategoryInfo[category].label : "";

  const query = useSharedQuery();
  return (
    <SharedLayout title="Unsubscribe" query={query}>
      <div className="flex justify-center mt-10">
        <div className="max-w-md w-full stack-col items-stretch gap-4">
          {error ? (
            <Alert variant="destructive" title="Something went wrong">
              Please try again in a moment.
            </Alert>
          ) : status === "working" ? (
            <div className="text-center py-4">Unsubscribing...</div>
          ) : status === "invalid" ? (
            <Alert variant="destructive" title="This link doesn't work">
              You can still change which emails you get in your email settings.
            </Alert>
          ) : status === "unsubscribed" ? (
            <Alert variant="success" title="You're unsubscribed">
              We won't send you "{label}" emails any more. You'll still get
              important emails about your account.
            </Alert>
          ) : (
            <Alert variant="success" title="You're subscribed again">
              Thanks! You'll keep getting "{label}" emails.
            </Alert>
          )}

          {status === "unsubscribed" && (
            <Button
              variant="outline"
              isLoading={fetching}
              onClick={() => update(true)}
            >
              Undo
            </Button>
          )}
          {(status === "invalid" || error) && (
            <Button variant="link" asChild>
              <a href="/settings/emails">Go to email settings</a>
            </Button>
          )}
        </div>
      </div>
    </SharedLayout>
  );
};

export default UnsubscribePage;
