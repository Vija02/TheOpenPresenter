import CookieManager from '@amazon-devices/react-native-cookies__cookies';

import {navigate, RootStackParamList} from './navigation';
import {queryClient} from './queryClient';
import {getRootUrl, setRootUrl} from './rootUrl';

export const login = async (
  setCookieHeader: string,
  rootUrl?: string,
  redirectTo: keyof RootStackParamList = 'Setup',
) => {
  const url = rootUrl ?? getRootUrl();

  // Save the root URL if provided
  if (rootUrl) {
    await setRootUrl(rootUrl);
  }

  await CookieManager.setFromResponse(url, setCookieHeader);

  queryClient.clear();

  navigate(redirectTo);
};
