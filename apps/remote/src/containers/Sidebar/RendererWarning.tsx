import {
  Box,
  Button,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
  Text,
  UnorderedList,
  chakra,
} from "@chakra-ui/react";
import { AwarenessUserData } from "@repo/base-plugin";
import { OverlayToggle, OverlayToggleComponentProps } from "@repo/ui";
import {
  FaChevronRight as FaChevronRightRaw,
  FaTriangleExclamation as FaTriangleExclamationRaw,
} from "react-icons/fa6";

import { useAwareness } from "../../contexts/AwarenessProvider";
import { useIsMobile } from "../../hooks/useIsMobile";

const FaTriangleExclamation = chakra(FaTriangleExclamationRaw);
const FaChevronRight = chakra(FaChevronRightRaw);

const getStringFromUA = (ua: AwarenessUserData["userAgentInfo"]) => {
  return `${ua.browser.name} / ${ua.os.name}`;
};

export const RendererWarning = () => {
  const { awarenessData } = useAwareness();
  const isMobile = useIsMobile();

  const allErrors = awarenessData.map((x) => x.user?.errors ?? []).flat();

  if (allErrors.length === 0) {
    return null;
  }

  return (
    <OverlayToggle
      toggler={({ onToggle }) => (
        <Stack
          direction="row"
          bg="orange.500"
          p={2}
          alignItems="center"
          justifyContent={isMobile ? "center" : "space-between"}
          cursor="pointer"
          onClick={onToggle}
        >
          <Stack direction="row" alignItems="center">
            <FaTriangleExclamation color="white" />
            <Text color="white" fontWeight="bold">
              {allErrors.length} {isMobile ? "" : "Warning"}
            </Text>
          </Stack>
          <FaChevronRight
            display={isMobile ? "none" : "inherit"}
            color="white"
          />
        </Stack>
      )}
    >
      <RendererWarningModal />
    </OverlayToggle>
  );
};

export type SidebarAddSceneModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

// TODO: Move this to server and allow plugins to register
const errorSettings: Record<
  string,
  { title: string; description: string; action?: string }
> = {
  ERR_AUDIO_AUTOPLAY: {
    title: "Audio not enabled on one or more screens",
    description:
      "Due to browser limitation, you need to interact with your screen to enable audio.",
    action: "Click anywhere on your affected screen.",
  },
};

const RendererWarningModal = ({
  isOpen,
  onToggle,
  ...props
}: SidebarAddSceneModalPropTypes) => {
  const { awarenessData } = useAwareness();

  const allErrors = awarenessData.map((x) => x.user?.errors ?? []).flat();

  return (
    <Modal
      size={{ base: "full", md: "xl" }}
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Warnings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {allErrors.map((errorCode) => {
            if (!(errorCode in errorSettings)) {
              console.error("Unhandled Error Code: ", errorCode);
              return null;
            }

            const errorData = errorSettings[errorCode]!;

            return (
              <Box key={errorCode}>
                <Stack direction="row" alignItems="center">
                  <FaTriangleExclamation color="orange.500" />
                  <Text fontWeight="bold" fontSize="lg">
                    {errorData.title}
                  </Text>
                </Stack>
                <Text>{errorData.description}</Text>
                <Text fontWeight="bold" pt={1}>
                  Screens affected:
                </Text>
                <UnorderedList>
                  {awarenessData
                    .filter((x) => x.user?.errors.includes(errorCode))
                    .map((x) => (
                      <ListItem key={x.user!.id}>
                        <Text>{getStringFromUA(x.user!.userAgentInfo)}</Text>
                      </ListItem>
                    ))}
                </UnorderedList>
                {!!errorData.action && (
                  <>
                    <Text fontWeight="bold" pt={1}>
                      Steps to resolve:
                    </Text>
                    <Text color="orange.700">{errorData.action}</Text>
                  </>
                )}
              </Box>
            );
          })}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onToggle}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
