import { useState } from "react";

import { IntegrationSection } from "../components/IntegrationSection";
import { PickerCard } from "../components/PickerCard";
import {
  canvaBrand,
  googleSlidesBrand,
} from "../components/integrationBranding";
import { CanvaPicker } from "./CanvaPicker";
import type { UploadPageConfig } from "./UploadPage";
import { openGooglePicker } from "./googlePicker";
import { useCanvaConnections } from "./useCanvaConnections";

// Integrations
export const SourceButtons = ({
  config,
  uploaderName,
  isBusy,
  isDisabled,
  setBusy,
  send,
}: {
  config: UploadPageConfig;
  uploaderName: string;
  isBusy: boolean;
  isDisabled?: boolean;
  setBusy: (v: boolean) => void;
  send: (run: () => Promise<Response>) => Promise<boolean>;
}) => {
  const { token, googleClientId, googleAppId, canvaEnabled } = config;
  const [showCanva, setShowCanva] = useState(false);
  const { connections, isConnecting, startConnect } =
    useCanvaConnections(token);

  // Always re-authorize
  const handleCanva = () => {
    setShowCanva(true);
    startConnect();
  };

  if (!googleClientId && !canvaEnabled) return null;

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const picked = await openGooglePicker({
        clientId: googleClientId,
        appId: googleAppId,
      });
      if (!picked) return;

      await send(() =>
        fetch(`/plugin/slides/gslides/${token}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-top-csrf-protection": "1",
          },
          body: JSON.stringify({
            presentationId: picked.id,
            name: picked.name,
            uploaderName: uploaderName || undefined,
            googleToken: picked.token,
          }),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <IntegrationSection>
        {googleClientId && (
          <PickerCard
            onClick={handleGoogle}
            icon={googleSlidesBrand.icon}
            text={googleSlidesBrand.name}
            isLoading={isBusy}
            isDisabled={isDisabled}
            testId="slides-upload-source-googleslides"
          />
        )}

        {canvaEnabled && (
          <PickerCard
            onClick={handleCanva}
            icon={canvaBrand.icon}
            text={canvaBrand.name}
            isLoading={isBusy}
            isDisabled={isDisabled}
            testId="slides-upload-source-canva"
          />
        )}
      </IntegrationSection>

      {canvaEnabled && (
        <CanvaPicker
          token={token}
          uploaderName={uploaderName}
          send={send}
          isOpen={showCanva}
          onClose={() => setShowCanva(false)}
          connections={connections}
          isConnecting={isConnecting}
          onRetryConnect={startConnect}
        />
      )}
    </div>
  );
};
