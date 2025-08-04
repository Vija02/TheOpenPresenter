import { OverlayToggle } from "@repo/ui";
import { BsGithub, BsQrCodeScan } from "react-icons/bs";
import { FcGoogle } from "react-icons/fc";

import QRLoginModal from "./QRLoginModal";

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
    <div className="stack-row justify-center gap-3 w-full">
      <a
        href={`/auth/google?next=${encodeURIComponent(next)}`}
        className="flex-1 hover:bg-gray-100 transition-colors"
      >
        <div className="border border-gray-600 rounded-sm p-2">
          <div className="center">
            <FcGoogle className="text-2xl" />
          </div>
        </div>
      </a>
      <a
        href={`/auth/github?next=${encodeURIComponent(next)}`}
        className="flex-1 hover:bg-gray-100 transition-colors"
      >
        <div className="border border-gray-600 rounded-sm p-2">
          <div className="center">
            <BsGithub className="text-2xl text-black" />
          </div>
        </div>
      </a>
      <OverlayToggle
        toggler={({ onToggle }) => (
          <div
            className="cursor-pointer flex-1 hover:bg-gray-100 transition-colors"
            onClick={onToggle}
          >
            <div className="border border-gray-600 rounded-sm p-2">
              <div className="center">
                <BsQrCodeScan className="text-2xl text-black" />
              </div>
            </div>
          </div>
        )}
      >
        <QRLoginModal next={next} />
      </OverlayToggle>
    </div>
  );
}
