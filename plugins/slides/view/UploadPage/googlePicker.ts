type PickedDeck = { id: string; name?: string; token: string };

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });

const getAccessToken = (clientId: string) =>
  new Promise<string | null>((resolve) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp: any) => resolve(resp?.access_token ?? null),
    });
    client.requestAccessToken();
  });

export const openGooglePicker = async ({
  clientId,
  appId,
}: {
  clientId: string;
  appId: string;
}): Promise<PickedDeck | null> => {
  await loadScript("https://accounts.google.com/gsi/client");
  await loadScript("https://apis.google.com/js/api.js");

  const token = await getAccessToken(clientId);
  if (!token) return null;

  await new Promise<void>((resolve) =>
    (window as any).gapi.load("picker", () => resolve()),
  );

  const google = (window as any).google;

  return new Promise<PickedDeck | null>((resolve) => {
    const view = new google.picker.DocsView(
      google.picker.ViewId.PRESENTATIONS,
    ).setMimeTypes("application/vnd.google-apps.presentation");

    const picker = new google.picker.PickerBuilder()
      .setAppId(appId)
      .setOAuthToken(token)
      .addView(view)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name, token } : null);
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();

    picker.setVisible(true);
  });
};
