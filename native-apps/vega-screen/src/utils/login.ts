import {CookieManager} from '@amazon-devices/webview';
import type {Cookie} from '@amazon-devices/webview';

import {navigate, RootStackParamList} from './navigation';
import {queryClient} from './queryClient';
import {getRootUrl, setRootUrl} from './rootUrl';

/**
 * Parse a single Set-Cookie response header into a Cookie object suitable for
 * @amazon-devices/webview's CookieManager.set. The webview CookieManager does
 * not expose setFromResponse, so we parse the header ourselves.
 *
 * Example input:
 *   "connect.sid=s%3Aabc; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; HttpOnly; Secure"
 */
const parseSetCookie = (header: string): Cookie | null => {
  const parts = header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const firstEq = parts[0].indexOf('=');
  if (firstEq === -1) {
    return null;
  }

  const name = parts[0].slice(0, firstEq).trim();
  const value = parts[0].slice(firstEq + 1).trim();
  if (!name) {
    return null;
  }

  const cookie: Cookie = {name, value};

  for (let i = 1; i < parts.length; i++) {
    const attr = parts[i];
    const eq = attr.indexOf('=');
    const key = (eq === -1 ? attr : attr.slice(0, eq)).trim().toLowerCase();
    const val = eq === -1 ? '' : attr.slice(eq + 1).trim();

    switch (key) {
      case 'path':
        cookie.path = val;
        break;
      case 'domain':
        cookie.domain = val;
        break;
      case 'expires':
        // RFC 6265 uses an HTTP-date; the webview API wants an ISO8601 string.
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            cookie.expires = d.toISOString();
          }
        } catch {
          // ignore unparseable dates
        }
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      // Max-Age / SameSite are not supported by the webview Cookie type.
      default:
        break;
    }
  }

  return cookie;
};

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

  const cookie = parseSetCookie(setCookieHeader);
  if (!cookie) {
    throw new Error('login: could not parse Set-Cookie header');
  }
  await CookieManager.set(url, cookie);

  queryClient.clear();

  navigate(redirectTo);
};
