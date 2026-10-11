/** Standalone pages for the Google sign-in and the cloud-hosted picker. */

const safeJson = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const baseStyle = `
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box;
    color: #18181b; background: #fafafa;
  }
  main { max-width: 32rem; text-align: center; }
  p { font-size: 16px; line-height: 1.5; }
  .muted { color: #71717a; font-size: 14px; }
  button {
    font: inherit; padding: 10px 20px; border-radius: 8px; cursor: pointer;
    border: 1px solid #d4d4d8; background: #18181b; color: #fafafa;
  }
  a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    body { background: #18181b; color: #f4f4f5; }
    .muted { color: #a1a1aa; }
    button { background: #f4f4f5; color: #18181b; border-color: #3f3f46; }
  }`;

/** Shown in the sign-in popup opened by the web app. Reports back and closes. */
export const renderPopupResult = ({
  nonce,
  origin,
  payload,
}: {
  nonce: string;
  origin: string;
  payload: { ok: boolean; error?: string };
}) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Google</title><style>${baseStyle}</style></head>
<body>
<main><p>${
  payload.ok
    ? "Google account connected. You can close this window."
    : `Google connection failed: ${escapeHtml(payload.error ?? "unknown error")}`
}</p></main>
<script nonce="${nonce}">
  (function () {
    var message = ${safeJson({ source: "top-google-oauth", ...payload })};
    try {
      if (window.opener) window.opener.postMessage(message, ${safeJson(origin)});
    } catch (e) {}
    if (message.ok) window.close();
  })();
</script>
</body>
</html>`;

/** A message and nothing else, for links that cannot be used. */
export const renderMessagePage = (message: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TheOpenPresenter</title><style>${baseStyle}</style></head>
<body><main><p>${escapeHtml(message)}</p></main></body>
</html>`;

/**
 * The cloud-hosted picker. Opened in the system browser by a local install,
 * which cannot run Google's Picker itself. Authorized by the intent in the
 * URL, not a browser session.
 */
export const renderPickPage = ({
  nonce,
  config,
}: {
  nonce: string;
  config: {
    intentId: string;
    /** Null for "Import once", which sends the token back instead */
    connectionId: string | null;
    accessToken: string;
    appId: string;
    accountLabel: string;
    switchAccountUrl: string;
  };
}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Choose a presentation</title>
<style>${baseStyle}</style>
</head>
<body>
<main>
  <p id="status">Opening Google Drive…</p>
  <p><button id="open" hidden>Choose a presentation</button></p>
  <p class="muted">
    Using ${escapeHtml(config.accountLabel)} ·
    <a href="${escapeHtml(config.switchAccountUrl)}">Use a different account</a>
  </p>
</main>
<script nonce="${nonce}">
  (function () {
    var config = ${safeJson(config)};
    var statusEl = document.getElementById("status");
    var openEl = document.getElementById("open");
    var done = false;

    function setStatus(text) { statusEl.textContent = text; }

    function submit(doc) {
      done = true;
      openEl.hidden = true;
      setStatus("Adding “" + (doc.name || "presentation") + "”…");
      fetch(window.location.pathname + window.location.search, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-top-csrf-protection": "1" },
        body: JSON.stringify({
          presentationId: doc.id,
          name: doc.name || null,
          connectionId: config.connectionId,
          accessToken: config.connectionId ? undefined : config.accessToken,
        }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || "Something went wrong.");
          });
        })
        .then(function () {
          setStatus("Done. You can close this tab and go back to TheOpenPresenter.");
        })
        .catch(function (err) {
          done = false;
          openEl.hidden = false;
          setStatus(err.message);
        });
    }

    function showPicker() {
      var google = window.google;
      var view = new google.picker.DocsView(google.picker.ViewId.PRESENTATIONS)
        .setMimeTypes("application/vnd.google-apps.presentation");
      var picker = new google.picker.PickerBuilder()
        .setAppId(config.appId)
        .setOAuthToken(config.accessToken)
        .addView(view)
        .setCallback(function (data) {
          if (data.action === google.picker.Action.PICKED && data.docs && data.docs[0]) {
            submit(data.docs[0]);
          } else if (data.action === google.picker.Action.CANCEL && !done) {
            setStatus("No presentation chosen.");
            openEl.hidden = false;
          }
        })
        .build();
      picker.setVisible(true);
    }

    openEl.addEventListener("click", showPicker);

    var script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.nonce = ${safeJson(nonce)};
    script.onload = function () {
      window.gapi.load("picker", function () {
        setStatus("Choose a presentation to add.");
        openEl.hidden = false;
        showPicker();
      });
    };
    script.onerror = function () { setStatus("Could not load Google Drive. Please refresh."); };
    document.head.appendChild(script);
  })();
</script>
</body>
</html>`;
