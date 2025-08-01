import { Box, Center, Link, Stack, chakra } from "@chakra-ui/react";
import { OverlayToggle } from "@repo/ui";
import {
  BsGithub as BsGithubRaw,
  BsQrCodeScan as BsQrCodeScanRaw,
} from "react-icons/bs";
import { FcGoogle as FcGoogleRaw } from "react-icons/fc";

import QRLoginModal from "./QRLoginModal";

const BsGithub = chakra(BsGithubRaw);
const FcGoogle = chakra(FcGoogleRaw);
const BsQrCodeScan = chakra(BsQrCodeScanRaw);

export interface SocialLoginOptionsProps {
  next: string;
  buttonTextFromService?: (service: string) => string;
}

function defaultButtonTextFromService(service: string) {
  return `Sign in with ${service}`;
}

export function SocialLoginOptions({
  next,
  buttonTextFromService = defaultButtonTextFromService,
}: SocialLoginOptionsProps) {
  return (
    <Stack direction="row" justifyContent="center" gap={3} width="100%">
      <Link
        href={`/auth/google?next=${encodeURIComponent(next)}`}
        flex={1}
        _hover={{ bg: "gray.100" }}
      >
        <Box border="1px solid" borderColor="gray.600" rounded="md" p={2}>
          <Center>
            <FcGoogle fontSize="2em" />
          </Center>
        </Box>
      </Link>
      <Link
        href={`/auth/github?next=${encodeURIComponent(next)}`}
        flex={1}
        _hover={{ bg: "gray.100" }}
      >
        <Box border="1px solid" borderColor="gray.600" rounded="md" p={2}>
          <Center>
            <BsGithub fontSize="2em" color="black" />
          </Center>
        </Box>
      </Link>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <Box
            cursor="pointer"
            onClick={onToggle}
            flex={1}
            _hover={{ bg: "gray.100" }}
          >
            <Box border="1px solid" borderColor="gray.600" rounded="md" p={2}>
              <Center>
                <BsQrCodeScan fontSize="2em" color="black" />
              </Center>
            </Box>
          </Box>
        )}
      >
        <QRLoginModal next={next} />
      </OverlayToggle>
    </Stack>
  );
}
