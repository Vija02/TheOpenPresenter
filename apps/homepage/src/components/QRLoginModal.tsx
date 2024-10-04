import {
  Center,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Text,
} from "@chakra-ui/react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { OverlayToggleComponentProps } from "@repo/ui";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export type QRLoginModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {};

const QRLoginModal = ({
  isOpen,
  onToggle,
  resetData,
  ...props
}: QRLoginModalPropTypes) => {
  const [qrId, setQRId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await fetchEventSource("/qr-auth/request", {
        onmessage(ev) {
          try {
            const data = JSON.parse(ev.data);
            if (data.id) {
              setQRId(data.id);
            }
            if (data.done) {
              window.location.href = "/qr-auth/login?token=" + data.token;
            }
          } catch (e) {
            // Keep alive
          }
        },
      });
    })();
  }, []);

  return (
    <Modal
      size="sm"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>QR Login</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Center flexDir="column" gap={4}>
            <Text>Scan with your mobile phone to log in</Text>
            <QRCode
              value={`${process.env.NEXT_PUBLIC_ROOT_URL}/qr-auth/auth?id=${qrId}`}
            />
          </Center>
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default QRLoginModal;
