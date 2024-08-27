/// <reference types="google.accounts" />
/// <reference types="google.picker" />
/// <reference types="gapi" />
import { Button } from "@chakra-ui/react";
import { useInjectScript } from "@repo/lib";
import { useCallback, useMemo } from "react";

// TODO:
const ClientId =
  "69245303872-fo9ap9sv2a6a5oiim2aqsk1hnnrmkkdk.apps.googleusercontent.com";

export const SlidePicker = ({
  onFileSelected,
}: {
  onFileSelected: (
    d: google.picker.ResponseObject,
    accessToken: string,
  ) => void;
}) => {
  const [loadedApi, errorApi] = useInjectScript(
    "https://apis.google.com/js/api.js",
    {
      onLoad: () => {
        window.gapi.load("picker", { callback: () => {} });
      },
    },
  );
  const [loadedGsi, errorGsi] = useInjectScript(
    "https://accounts.google.com/gsi/client",
  );

  const getAccessToken = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: ClientId,
        scope: ["https://www.googleapis.com/auth/drive.readonly"].join(" "),
        callback: (tokenResponse: any) => {
          resolve(tokenResponse.access_token);
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      client.requestAccessToken();
    });
  }, []);

  const openPicker = useCallback(async () => {
    const accessToken = await getAccessToken();

    new google.picker.PickerBuilder()
      .addView(google.picker.ViewId.PRESENTATIONS)
      .setOAuthToken(accessToken)
      .setDeveloperKey("")
      .setCallback((data) => onFileSelected(data, accessToken))
      .setAppId("")
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .build()
      .setVisible(true);
  }, [getAccessToken, onFileSelected]);

  const scriptLoaded = useMemo(
    () => loadedApi && !errorApi && loadedGsi && !errorGsi,
    [errorApi, errorGsi, loadedApi, loadedGsi],
  );

  return (
    <Button isLoading={!scriptLoaded} onClick={() => openPicker()}>
      Select Slide
    </Button>
  );
};
