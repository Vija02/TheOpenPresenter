import { Alert } from "@repo/ui";
import { Link } from "wouter";

export const AdminGuestPageNotice = ({
  isMember,
  orgSlug,
  screenSlug,
}: {
  isMember: boolean;
  orgSlug: string;
  screenSlug: string;
}) => {
  if (!isMember) return null;
  return (
    <Alert variant="default" title="You're an admin">
      This is the guest-facing screen page. Go to the{" "}
      <Link
        href={`/o/${orgSlug}/screens/${screenSlug}/admin`}
        className="underline"
      >
        admin page
      </Link>{" "}
      for more controls.
    </Alert>
  );
};
