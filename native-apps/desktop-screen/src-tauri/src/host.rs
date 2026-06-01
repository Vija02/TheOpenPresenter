use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

const POLL_INTERVAL_SECS: u64 = 5;
const PROBE_TIMEOUT_SECS: u64 = 5;
const DEFAULT_ROOT_URL: &str = "https://theopenpresenter.com";
const STORE_FILE: &str = "config.json";

/// Reachability probe
async fn probe(url: &str) -> bool {
    if url.is_empty() {
        return false;
    }
    let Ok(client) = reqwest::Client::builder()
        .timeout(Duration::from_secs(PROBE_TIMEOUT_SECS))
        .build()
    else {
        return false;
    };
    client.get(url).send().await.is_ok()
}

#[tauri::command]
pub async fn check_host(url: String) -> Result<bool, String> {
    Ok(probe(&url).await)
}

fn stored_root_url(app: &AppHandle) -> String {
    let Ok(store) = app.store(STORE_FILE) else {
        return DEFAULT_ROOT_URL.to_string();
    };
    store
        .get("rootUrl")
        .and_then(|v| v.as_str().map(String::from))
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_ROOT_URL.to_string())
}

pub(crate) fn stored_require_host_reachable(app: &AppHandle) -> bool {
    let Ok(store) = app.store(STORE_FILE) else {
        return true;
    };
    let Some(settings) = store.get("settings") else {
        return true;
    };
    settings
        .get("requireHostReachable")
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

/// Background task: poll the configured host until reachable, then show the
/// main "screen" window. Spawned at startup when both `autostart` and
/// `requireHostReachable` are on so the kiosk doesn't briefly render a
/// connection-failed page on a cold boot.
pub(crate) async fn wait_for_host_and_show(app: AppHandle) {
    use serde_json::json;
    let mut attempt: u32 = 0;
    loop {
        if let Some(w) = app.get_webview_window("main") {
            if w.is_visible().unwrap_or(false) {
                let _ = app.emit("host-wait", json!({ "status": "ready" }));
                return;
            }
        }

        attempt += 1;
        let root_url = stored_root_url(&app);

        if probe(&root_url).await {
            let _ = app.emit(
                "host-wait",
                json!({ "status": "ready", "attempt": attempt, "rootUrl": root_url }),
            );

            // Before revealing the kiosk window, reload the webview
            #[cfg(not(target_os = "macos"))]
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.eval("window.location.reload()");
            }

            let _ = crate::window::set_screen_visible(&app, true);
            return;
        }

        let _ = app.emit(
            "host-wait",
            json!({ "status": "waiting", "attempt": attempt, "rootUrl": root_url }),
        );
        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
    }
}
