const getRootURL = () => (window as any)?.__APP_DATA__?.ROOT_URL;
const getCSRFToken = () => (window as any)?.__APP_DATA__?.CSRF_TOKEN;

const getCustomEnv = (envName: string) =>
  (window as any)?.__APP_DATA__?.[envName];

export const appData = { getRootURL, getCSRFToken, getCustomEnv };
