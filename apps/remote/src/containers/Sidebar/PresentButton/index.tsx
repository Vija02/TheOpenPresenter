import { Button, Link, Text } from "@chakra-ui/react";
import { usePluginMetaData } from "@repo/shared";
import { lazy } from "react";
import { MdCoPresent } from "react-icons/md";

const PresentMonitorModalWrapper = lazy(() => import("./PresentMonitorModal"));

export const PresentButton = ({ isMobile }: { isMobile?: boolean }) => {
  const { orgSlug, projectSlug } = usePluginMetaData();

  const ButtonElement = ({ onClick }: { onClick?: () => void }) => (
    <Button
      w="100%"
      variant="outline"
      borderColor="gray.300"
      {...(isMobile ? { display: "flex", flexDir: "column" } : {})}
      onClick={onClick}
    >
      <MdCoPresent />
      <Text
        {...(isMobile ? { fontSize: "2xs", fontWeight: "normal" } : { ml: 2 })}
        ml={2}
      >
        Present
      </Text>
    </Button>
  );

  if (window.__TAURI_INTERNALS__) {
    return <PresentMonitorModalWrapper ButtonElement={ButtonElement} />;
  }

  return (
    <Link
      href={`/render/${orgSlug}/${projectSlug}`}
      isExternal
      bg="white"
      {...(isMobile
        ? { textDecor: "none", _hover: { textDecor: "none" } }
        : {})}
    >
      <ButtonElement />
    </Link>
  );
};
