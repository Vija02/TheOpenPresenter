const GA_MEASUREMENT_ID = "G-J48W7BRV67";

const PRODUCTION_HOSTNAME = "theopenpresenter.com";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const isProductionHost =
  window.location.hostname === PRODUCTION_HOSTNAME ||
  window.location.hostname.endsWith(`.${PRODUCTION_HOSTNAME}`);

if (
  isProductionHost &&
  GA_MEASUREMENT_ID &&
  !GA_MEASUREMENT_ID.includes("XXXX")
) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // GA expects the raw arguments object pushed onto the dataLayer.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

export {};
