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

import { onPresentClick } from "./desktopPresent";
import { useAllWindows } from "./useAllWindows";
import { useAvailableMonitors } from "./useAvailableMonitors";

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
  const { data: monitors } = useAvailableMonitors();
  const { refetch: refetchWindow } = useAllWindows();

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
              onClick={async () => {
                await onPresentClick(orgSlug, projectSlug, i);
                await refetchWindow();
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
  PresentButtonElement,
  StopPresentButtonElement,
}: {
  PresentButtonElement: (prop: { onClick: () => void }) => React.ReactElement;
  StopPresentButtonElement: (prop: {
    onClick: () => void;
  }) => React.ReactElement;
}) => {
  const { data: monitors } = useAvailableMonitors();
  const { data: allWindows, refetch: refetchWindow } = useAllWindows();
  const rendererWindow = allWindows?.find((x) => x.label === "renderer");

  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <PresentButtonElement
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

      {rendererWindow && (
        <StopPresentButtonElement
          onClick={async () => {
            await rendererWindow.close();
            await refetchWindow();
          }}
        />
      )}
    </>
  );
};

export default PresentMonitorModalWrapper;
