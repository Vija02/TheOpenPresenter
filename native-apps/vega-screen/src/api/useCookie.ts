import {CookieManager} from '@amazon-devices/webview';
import {useQuery} from '@tanstack/react-query';

import {getRootUrl} from '../utils/rootUrl';

export const useCookie = () => {
  return useQuery({
    queryKey: ['cookie'],
    queryFn: async () => {
      const cookies = await CookieManager.get(getRootUrl());
      return cookies?.['connect.sid']?.value ?? null;
    },
  });
};
