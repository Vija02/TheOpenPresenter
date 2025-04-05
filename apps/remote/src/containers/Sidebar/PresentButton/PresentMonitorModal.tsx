import {
  Box,
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
} from "@chakra-ui/react";
import { usePluginMetaData } from "@repo/shared";
import { OverlayToggle, OverlayToggleComponentProps } from "@repo/ui";
import { useQuery } from "@tanstack/react-query";
import { availableMonitors } from "@tauri-apps/api/window";

import { onPresentClick } from "./desktopPresent";

export type PresentMonitorModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps>;

const PresentMonitorModal = ({
  isOpen,
  onToggle,
  ...props
}: PresentMonitorModalPropTypes) => {
  const { data: monitors } = useQuery({
    queryKey: ["availableMonitors"],
    queryFn: () => {
      return availableMonitors();
    },
  });
  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Stack direction="row" alignItems="center">
            <Text>Select monitor</Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {monitors?.map((monitor, i) => (
            <Box
              key={i}
              onClick={() => {
                onPresentClick(orgSlug, projectSlug, i);
                onToggle?.();
              }}
              cursor="pointer"
              _hover={{ bg: "blue.100" }}
            >
              {monitor.name} | {monitor.size.width}x{monitor.size.height}
            </Box>
          ))}
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const PresentMonitorModalWrapper = ({
  ButtonElement,
}: {
  ButtonElement: (prop: { onClick: () => void }) => React.ReactElement;
}) => {
  const { data: monitors } = useQuery({
    queryKey: ["availableMonitors"],
    queryFn: () => {
      return availableMonitors();
    },
  });
  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <OverlayToggle
      toggler={({ onToggle }) => (
        <ButtonElement
          onClick={() => {
            if (monitors?.length === 1) {
              onPresentClick(orgSlug, projectSlug);
            } else {
              onToggle();
            }
          }}
        />
      )}
    >
      <PresentMonitorModal />
    </OverlayToggle>
  );
};

export default PresentMonitorModalWrapper;
