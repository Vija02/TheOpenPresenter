import {
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
import { availableMonitors } from "@tauri-apps/api/window";
import { use } from "react";

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
  const monitors = use(availableMonitors());
  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent maxW="1200" minH="70%">
        <ModalHeader>
          <Stack direction="row" alignItems="center">
            <Text>Select monitor</Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {monitors.map((monitor, i) => (
            <div
              key={i}
              onClick={() => {
                onPresentClick(orgSlug, projectSlug, i);
              }}
            >
              {monitor.name} | {monitor.size.width}x{monitor.size.height}
            </div>
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
  const monitors = use(availableMonitors());
  const { orgSlug, projectSlug } = usePluginMetaData();

  return (
    <OverlayToggle
      toggler={({ onToggle }) => (
        <ButtonElement
          onClick={() => {
            if (monitors.length === 1) {
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
