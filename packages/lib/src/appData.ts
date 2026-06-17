const getRootURL = () => (window as any)?.__APP_DATA__?.ROOT_URL;
const getCSRFToken = () => (window as any)?.__APP_DATA__?.CSRF_TOKEN;
const getMediaUploadChunkSize = () => {
  const val = parseInt(
    (window as any)?.__APP_DATA__?.MEDIA_UPLOAD_CHUNK_SIZE,
    10,
  );
  if (Number.isSafeInteger(val)) {
    return val;
  }
  return Infinity;
};
const getOTELEnabled = () => (window as any)?.__APP_DATA__?.ENABLE_OTEL === "1";
const getDeploymentEnv = (): string | undefined =>
  (window as any)?.__APP_DATA__?.DEPLOYMENT_ENV;

const getCustomEnv = (envName: string) =>
  (window as any)?.__APP_DATA__?.[envName];

const getStripePublishableKey = (): string | undefined =>
  (window as any)?.__APP_DATA__?.STRIPE_PUBLISHABLE_KEY;

const getStripePriceIdMonthly = (): string | undefined =>
  (window as any)?.__APP_DATA__?.STRIPE_PRICE_ID_MONTHLY;

const getStripePriceIdAnnual = (): string | undefined =>
  (window as any)?.__APP_DATA__?.STRIPE_PRICE_ID_ANNUAL;

export type ProxyConfig = {
  isProxy: boolean;
  cloudOrgSlug: string | null;
  endpointId: string | null;
  headers: Record<string, string>;
};

const getProxyConfig = (): ProxyConfig => {
  const urlParams = new URLSearchParams(window.location.search);
  const cloudOrgSlug = urlParams.get("pOrg");
  const endpointId = urlParams.get("pEndpoint");

  if (cloudOrgSlug && endpointId) {
    return {
      isProxy: true,
      cloudOrgSlug,
      endpointId,
      headers: {
        "x-organization-slug": cloudOrgSlug,
        "x-iroh-endpoint-id": endpointId,
      },
    };
  }

  return {
    isProxy: false,
    cloudOrgSlug: null,
    endpointId: null,
    headers: {},
  };
};

const getPluginData = () =>
  (window as any)?.__APP_DATA__?.pluginData as Record<
    string,
    { scripts: string[]; css: string[] }
  >;

export const appData = {
  getRootURL,
  getCSRFToken,
  getMediaUploadChunkSize,
  getOTELEnabled,
  getDeploymentEnv,
  getCustomEnv,
  getPluginData,
  getProxyConfig,
  getStripePublishableKey,
  getStripePriceIdMonthly,
  getStripePriceIdAnnual,
};
