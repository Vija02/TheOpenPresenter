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

const getCustomEnv = (envName: string) =>
  (window as any)?.__APP_DATA__?.[envName];

export const appData = {
  getRootURL,
  getCSRFToken,
  getMediaUploadChunkSize,
  getCustomEnv,
};
