# TheOpenPresenter TV

Android TV / Apple TV companion app for TheOpenPresenter. Renders an assigned screen from your TheOpenPresenter server in full-screen, with a back-button menu for refresh / controller QR / sign out / exit.

## What it does

1. **First launch — pairing.** Subscribes to the server's `/qr-auth/screen-select/request` SSE stream, displays the returned QR code. The user scans it with their phone, signs in on the web, and picks which screen this device represents. The server returns a login token over the SSE stream; the app persists the session cookie + screen identity in AsyncStorage and navigates to the render surface.

2. **Steady state — rendering.** Loads `${rootUrl}/render/s/:orgSlug/:screenSlug` in a WebView. The render endpoint pushes presentation content over its own real-time channel; this app is just the host.

3. **Back / TV menu button** opens an in-app menu:
   - **Refresh page** — reloads the WebView.
   - **Open controller** — shows a QR code linking to `/o/:orgSlug/screens/:screenSlug/control` so a phone in the room can drive this screen.
   - **Sign out** — clears the session and screen identity, returns to pairing.
   - **Exit app** — `BackHandler.exitApp()` (Android only).

## Stack

- Expo SDK 55 + expo-router
- [react-native-tvos](https://github.com/react-native-tvos/react-native-tvos) (TV-aware RN fork)
- [@react-native-tvos/config-tv](https://github.com/react-native-tvos/config-tv) (prebuild plugin for TV native config)
- `react-native-webview` — screen content
- `react-native-qrcode-svg` — pairing + controller QR codes
- `react-native-sse` — pairing SSE stream
- `@tanstack/react-query` — session/cookie state
- `@expo/vector-icons` (Ionicons) — menu icons

## App layout

- `app/_layout.tsx` — providers (QueryClient, SafeArea, ToastManager) and initialises root URL + cached screen identity from AsyncStorage before rendering routes.
- `app/index.tsx` — pairing screen.
- `app/screen.tsx` — main render surface, WebView + action menu + controller-QR overlay.
- `utils/` — `rootUrl`, `screen`, `login`, `logout`, `queryClient` helpers.
- `api/useCookie.ts` — session cookie query.
- `plugins/withCleartextTraffic.js` — config plugin permitting cleartext HTTP on Android (for self-hosted servers without TLS).

## App identity

| Field | Value |
|---|---|
| Display name | TheOpenPresenter TV |
| Slug | TheOpenPresenter-tv |
| Android `package` | `com.theopenpresenter.tv` |
| iOS `bundleIdentifier` | `com.theopenpresenter.tv` |
| EAS project | `1336fc03-9568-45c6-b040-85142bd386b0` |
| Runtime version policy | `appVersion` (1.0.0) |

The mobile app (when it exists) will use a different identifier (`com.theopenpresenter` or `.mobile`) so the two are independent in stores and on-device.

## Configuration

Server URL is read from `EXPO_PUBLIC_ROOT_URL` at build / OTA-bundle time and baked into the JS bundle. Set it per environment in EAS:

```sh
npx eas-cli env:create --environment preview     # EXPO_PUBLIC_ROOT_URL = https://preview.example.com
npx eas-cli env:create --environment production  # EXPO_PUBLIC_ROOT_URL = https://example.com
```

For local development, create a `.env` with `EXPO_PUBLIC_ROOT_URL=...`.

## Local development

Prebuild regenerates `android/` and `ios/` from `app.json` — required whenever native config changes (package name, plugins, etc.).

```sh
npm install
npm run prebuild:tv     # EXPO_TV=1 expo prebuild --clean
npm run android         # EXPO_TV=1 expo run:android
npm run ios             # EXPO_TV=1 expo run:ios
```

Setting `EXPO_TV=1` activates the TV config plugin. Drop it (and use `prebuild` / non-TV `run:*`) if you ever need a mobile build from the same source.

## EAS Update (OTA)

Ships a fresh JS bundle to existing installs without rebuilding native. The runtime version (currently `1.0.0`) must match what's installed on device.

```sh
# Preview (internal testing builds)
npx eas-cli update \
  --branch preview --platform all \
  --environment preview \
  --message "..." \
  --non-interactive

# Production (released installs) — CI does this automatically; rarely needed manually
npx eas-cli update \
  --branch production --platform all \
  --environment production \
  --message "..." \
  --non-interactive
```

Inspect a published update group:

```sh
npx eas-cli update:view <update-group-id>
```

## EAS Build (native binary)

Required when you change native config (package name, plugins, native deps) or to cut a new release that existing installs can't reach via OTA.

```sh
# Production Android APK (the CI path; produces a store-distribution build)
npx eas-cli build --platform android --profile production --non-interactive

# Preview (internal distribution)
npx eas-cli build --platform android --profile preview --non-interactive

# Watch / inspect
npx eas-cli build:view <build-id> --json
npx eas-cli build:list --limit 5
```

Build profiles live in `eas.json`. The `production` profile auto-increments `versionCode` and ties to the `production` channel.

## CI

`.github/workflows/native-screen.yml` runs on push to `main` when paths under `native-apps/native-screen/**` (or the workflow file itself) change. It runs a single job:

- Checks out, `npm ci`, then `npx eas-cli update --branch production --platform all --environment production --message "<first line of commit>"`.

Native binary builds are intentionally not in CI — kick them off locally with the `eas-cli build` command above when needed.

Required secret: **`EXPO_TOKEN`** (account-scoped Expo access token from <https://expo.dev/settings/access-tokens>).

## Common workflows

| Goal | Command |
|---|---|
| Develop locally on Android TV | `npm install && npm run prebuild:tv && npm run android` |
| Push a UI fix to preview testers | `npx eas-cli update --branch preview --platform all --environment preview --message "fix: ..." --non-interactive` |
| Push a UI fix to production | Merge to `main`; CI publishes the OTA. |
| Cut a new APK (e.g. native dep changed) | `npx eas-cli build --platform android --profile production --non-interactive` |
| Type-check | `npx tsc --noEmit` |
| Lint | `npm run lint` |

## Troubleshooting

- **`Slug for project identified by "extra.eas.projectId" does not match the "slug" field`** — `app.json` slug and the EAS dashboard slug have drifted. Slugs on expo.dev are immutable; either change the local `slug` back to match or `npx eas-cli init --force` to bind to a new project.
- **OTA published but device shows nothing new** — runtime version must match. App version in `app.json` and the installed binary must agree (we use the `appVersion` policy, so bumping `version` invalidates older installs for that runtime).
- **Cleartext HTTP refused on Android** — covered by `plugins/withCleartextTraffic.js`; only takes effect after a native rebuild (EAS Build or local prebuild), not via OTA.
