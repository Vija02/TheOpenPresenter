/// <reference types="google.accounts" />
/// <reference types="google.picker" />
/// <reference types="gapi" />
import { useInjectScript } from "@repo/lib";
import { useCallback, useMemo } from "react";

import { usePluginAPI } from "../../pluginApi";

export const SlidePicker = ({
  onFileSelected,
  children,
}: {
  onFileSelected: (
    d: google.picker.ResponseObject,
    accessToken: string,
  ) => void;
  children: (val: {
    isLoading: boolean;
    openPicker: () => void;
  }) => React.ReactElement<any>;
}) => {
  const pluginApi = usePluginAPI();
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

  const googleClientID = useMemo(
    () => pluginApi.env.getCustomEnv("PLUGIN_GOOGLE_SLIDES_CLIENT_ID"),
    [pluginApi.env],
  );

  const getAccessToken = useCallback(() => {
    return new Promise<string>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: googleClientID,
        scope: ["https://www.googleapis.com/auth/drive.file"].join(" "),
        callback: (tokenResponse: any) => {
          resolve(tokenResponse.access_token);
        },
        error_callback: (err: any) => {
          reject(err);
        },
      });

      client.requestAccessToken();
    });
  }, [googleClientID]);

  const openPicker = useCallback(async () => {
    const accessToken = await getAccessToken();

    new google.picker.PickerBuilder()
      .addView(
        new google.picker.DocsView(google.picker.ViewId.PRESENTATIONS).setMode(
          google.picker.DocsViewMode.LIST,
        ),
      )
      .setOAuthToken(accessToken)
      .setCallback((data) => onFileSelected(data, accessToken))
      .setAppId(
        pluginApi.env
          .getCustomEnv("PLUGIN_GOOGLE_SLIDES_CLIENT_ID")
          .split("-")?.[0],
      )
      .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
      .build()
      .setVisible(true);
  }, [getAccessToken, onFileSelected, pluginApi.env]);

  const scriptLoaded = useMemo(
    () => loadedApi && !errorApi && loadedGsi && !errorGsi,
    [errorApi, errorGsi, loadedApi, loadedGsi],
  );

  return children({
    isLoading: !scriptLoaded,
    openPicker,
  });
};
