import {
  Box,
  Center,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Skeleton,
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
  Partial<OverlayToggleComponentProps> & { next: string };

const QRLoginModal = ({
  isOpen,
  onToggle,
  resetData,
  next,
  ...props
}: QRLoginModalPropTypes) => {
  const [qrId, setQRId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isOpen) {
        const ctrl = new AbortController();
        await fetchEventSource("/qr-auth/request", {
          signal: ctrl.signal,
          onmessage(ev) {
            try {
              const data = JSON.parse(ev.data);
              if (data.id) {
                setQRId(data.id);
              }
              if (data.done) {
                window.location.href = `/qr-auth/login?token=${data.token}&next=${encodeURIComponent(next)}`;
              }
            } catch (e) {
              // Keep alive
            }
          },
        });
        return () => {
          ctrl.abort();
          setQRId(null);
        };
      }
    })();
  }, [isOpen, next]);

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
            {!qrId && <Skeleton width="100%" maxW="256px" aspectRatio={1} />}
            {qrId && (
              <Box width="100%">
                <QRCode
                  style={{
                    height: "auto",
                    maxWidth: "100%",
                    width: "100%",
                    maxHeight: 256,
                  }}
                  value={`${import.meta.env.VITE_PUBLIC_ROOT_URL}/qr-auth/auth?id=${qrId}`}
                />
              </Box>
            )}
          </Center>
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default QRLoginModal;
