import CookieManager from '@amazon-devices/react-native-cookies__cookies';

import {navigate} from './navigation';
import {queryClient} from './queryClient';
import {clearRootUrl} from './rootUrl';
import {clearScreen} from './screen';

export const logout = async () => {
  await CookieManager.clearAll();
  await clearRootUrl();
  await clearScreen();
  queryClient.clear();

  navigate('Setup');
};
