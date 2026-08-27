import { Button, OverlayToggle } from "@repo/ui";
import { useEffect, useRef } from "react";
import { BsGithub, BsQrCodeScan } from "react-icons/bs";
import { FcGoogle } from "react-icons/fc";
import { IconType } from "react-icons/lib";

import QRLoginModal from "./QRLoginModal";

type SocialProvider = {
  service: string;
  label: string;
  icon: IconType;
  iconClassName?: string;
};

export const socialProviders: SocialProvider[] = [
  {
    service: "google",
    label: "Google",
    icon: FcGoogle,
  },
  {
    service: "github",
    label: "GitHub",
    icon: BsGithub,
    iconClassName: "text-primary",
  },
];

export interface SocialLoginOptionsProps {
  next: string;
  persistSession?: boolean;
  buttonTextFromService?: (service: string) => string;
  autoOpenQRLogin?: boolean;
}

function defaultButtonTextFromService(service: string) {
  return service;
}

export function SocialLoginOptions({
  next,
  persistSession,
  buttonTextFromService = defaultButtonTextFromService,
  autoOpenQRLogin = false,
}: SocialLoginOptionsProps) {
  const persistSessionParam = persistSession ? "&persist-session=1" : "";
  const qrToggleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (autoOpenQRLogin && qrToggleRef.current) {
      qrToggleRef.current();
    }
  }, [autoOpenQRLogin]);

  const hrefFor = (service: string) =>
    `/auth/${service}?next=${encodeURIComponent(next)}${persistSessionParam}`;

  return (
    <div className="stack-col gap-2 w-full">
      <div className="stack-row gap-2 w-full">
        {socialProviders.map((provider) => (
          <Button
            key={provider.service}
            asChild
            variant="outline"
            size="lg"
            className="flex-1 hover:no-underline"
            data-testid={`loginpage-social-${provider.service}`}
          >
            <a href={hrefFor(provider.service)}>
              <provider.icon
                className={`size-5 ${provider.iconClassName ?? ""}`}
              />
              {buttonTextFromService(provider.label)}
            </a>
          </Button>
        ))}
      </div>

      <OverlayToggle
        toggler={({ onToggle }) => {
          qrToggleRef.current = onToggle;
          return (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={onToggle}
              data-testid="loginpage-qr-button"
            >
              <BsQrCodeScan className="size-5 text-primary" />
              Login with phone
            </Button>
          );
        }}
      >
        <QRLoginModal next={next} persistSession={persistSession} />
      </OverlayToggle>

      <p className="lineText w-full text-tertiary text-xs">OR</p>
    </div>
  );
}
