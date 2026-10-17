import {
  DrivePicker,
  DrivePickerDocsView,
} from "@googleworkspace/drive-picker-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { usePluginAPI } from "../../pluginApi";

export type PickerDocument = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  [key: string]: any;
};

export type PickerPickedEvent = {
  detail: {
    action: string;
    docs: PickerDocument[];
  };
};

export type OAuthResponseEvent = {
  detail: {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
};

export const SlidePicker = ({
  onFileSelected,
  children,
  clientId,
  oauthToken,
}: {
  onFileSelected: (doc: PickerDocument, accessToken: string) => void;
  children: (val: {
    isLoading: boolean;
    openPicker: () => void;
  }) => React.ReactElement<any>;
  clientId?: string;
  oauthToken?: string;
}) => {
  const pluginApi = usePluginAPI();
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const accessTokenRef = useRef<string | null>(null);

  const googleClientID = useMemo(
    () =>
      clientId || pluginApi.env.getCustomEnv("PLUGIN_GOOGLE_SLIDES_CLIENT_ID"),
    [clientId, pluginApi.env],
  );

  const appId = useMemo(
    () => googleClientID.split("-")?.[0] ?? "",
    [googleClientID],
  );

  const openPicker = useCallback(() => {
    setIsPickerVisible(true);
  }, []);

  const handlePicked = useCallback(
    (event: PickerPickedEvent) => {
      const docs = event.detail.docs;
      if (docs.length > 0) {
        const doc = docs[0]!;
        onFileSelected(doc, oauthToken ?? accessTokenRef.current ?? "");
      }
      setIsPickerVisible(false);
    },
    [onFileSelected, oauthToken],
  );

  const handleCanceled = useCallback(() => {
    setIsPickerVisible(false);
  }, []);

  const handleOAuthError = useCallback(() => {
    setIsPickerVisible(false);
  }, []);

  const handleOAuthResponse = useCallback((event: OAuthResponseEvent) => {
    accessTokenRef.current = event.detail.access_token;
  }, []);

  return (
    <>
      {children({
        isLoading: isPickerVisible,
        openPicker,
      })}

      {isPickerVisible && (
        <DrivePicker
          client-id={googleClientID}
          app-id={appId}
          {...(oauthToken ? { "oauth-token": oauthToken } : {})}
          onPicked={handlePicked}
          onCanceled={handleCanceled}
          onOauthError={handleOAuthError}
          onOauthResponse={handleOAuthResponse}
        >
          <DrivePickerDocsView
            mime-types="application/vnd.google-apps.presentation"
            mode="LIST"
          />
        </DrivePicker>
      )}
    </>
  );
};
