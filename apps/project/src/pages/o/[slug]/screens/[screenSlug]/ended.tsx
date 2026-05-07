import { AuthRestrict, SharedLayout } from "@/components/SharedLayout";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  useLogoutScreenGuestSessionMutation,
  useScreenLoginPageQuery,
} from "@repo/graphql";
import { Alert } from "@repo/ui";
import { useEffect } from "react";
import { Link, useParams } from "wouter";

const OrganizationSlugScreenEndedPage = () => {
  const orgSlug = useOrganizationSlug();
  const params = useParams();
  const screenSlug = params.screenSlug!;
  const loginHref = `/o/${orgSlug}/screens/${screenSlug}/login`;

  const query = useScreenLoginPageQuery({
    variables: { orgSlug, screenSlug },
  });
  const [{ data }] = query;
  const meta = data?.screenLoginMetadata ?? null;
  const screenName = meta?.screenName ?? null;

  const [, logoutGuest] = useLogoutScreenGuestSessionMutation();
  useEffect(() => {
    logoutGuest({}).catch(() => {});
  }, [logoutGuest]);

  return (
    <SharedLayout
      title="Session ended"
      query={query}
      forbidWhen={AuthRestrict.NEVER}
    >
      <div className="max-w-md mx-auto p-4">
        <div className="mb-4">
          <p className="text-sm text-tertiary uppercase tracking-wide">
            Screen control
          </p>
          <h1 className="text-2xl font-bold">
            {screenName ?? "Session ended"}
          </h1>
        </div>
        <Alert variant="default" title="Your session has ended">
          You no longer control this screen. To request control again,{" "}
          <Link href={loginHref} className="underline">
            sign back in
          </Link>
          .
        </Alert>
      </div>
    </SharedLayout>
  );
};

export default OrganizationSlugScreenEndedPage;
