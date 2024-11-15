import { SharedLayoutLoggedIn } from "@/components/SharedLayoutLoggedIn";
import { getServerSidePropsDeviceType, withDeviceType } from "@/lib/DeviceType";
import { Link, Text } from "@chakra-ui/react";
import { supportEmail } from "@repo/config";
import { useSharedQuery } from "@repo/graphql";
import { NextPage } from "next";
import React from "react";

const Settings_Accounts: NextPage = () => {
  const query = useSharedQuery();
  return (
    <SharedLayoutLoggedIn title="Delete Account" query={query} noHandleErrors>
      <Text>
        Automatic deletion is not supported yet. If you want to proceed, please
        send an email to{" "}
        <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>. Sorry for
        the inconvenience.
      </Text>
    </SharedLayoutLoggedIn>
  );
};

export const getServerSideProps = getServerSidePropsDeviceType;

export default withDeviceType(Settings_Accounts);
