import { Button, Link, Text } from "@chakra-ui/react";
import { usePluginMetaData } from "@repo/shared";
import { lazy } from "react";
import { MdCoPresent, MdOutlineCancelPresentation } from "react-icons/md";

const PresentMonitorModalWrapper = lazy(() => import("./PresentMonitorModal"));

export const PresentButton = ({ isMobile }: { isMobile?: boolean }) => {
  const { orgSlug, projectSlug } = usePluginMetaData();

  const PresentButtonElement = ({ onClick }: { onClick?: () => void }) => (
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
  const StopPresentButtonElement = ({ onClick }: { onClick?: () => void }) => (
    <Button
      w="100%"
      variant="outline"
      borderColor="gray.300"
      {...(isMobile ? { display: "flex", flexDir: "column" } : {})}
      onClick={onClick}
    >
      <MdOutlineCancelPresentation />
      <Text
        {...(isMobile ? { fontSize: "2xs", fontWeight: "normal" } : { ml: 2 })}
        ml={2}
      >
        Stop Presenting
      </Text>
    </Button>
  );

  if (window.__TAURI_INTERNALS__) {
    return (
      <PresentMonitorModalWrapper
        PresentButtonElement={PresentButtonElement}
        StopPresentButtonElement={StopPresentButtonElement}
      />
    );
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
      <PresentButtonElement />
    </Link>
  );
};
