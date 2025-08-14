import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { supportEmail } from "@repo/config";
import { useSharedQuery } from "@repo/graphql";
import { Link } from "@repo/ui";

const Settings_Delete = () => {
  const query = useSharedQuery();
  return (
    <SharedLayoutLoggedIn title="Delete Account" query={query} noHandleErrors>
      <p>
        Automatic deletion is not supported yet. If you want to proceed, please
        send an email to{" "}
        <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>. Sorry for
        the inconvenience.
      </p>
    </SharedLayoutLoggedIn>
  );
};

export default Settings_Delete;
