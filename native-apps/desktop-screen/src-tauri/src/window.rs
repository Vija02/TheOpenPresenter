//! Window management: the settings window, the main render window's
//! lifecycle / visibility / navigation, and webview audio (mute).
//!
//! Linux/Windows keep a single persistent `main` render window and hide it
//! (plus mute) when "off". macOS has no per-webview mute API, so the render
//! window is transient there — created on show, closed on hide — and a
//! persistent hidden `auth` helper window carries the session cookie.

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_store::StoreExt;

use crate::state::{is_user_muted, MuteState};

// ---------------------------------------------------------------------------
// Settings window
// ---------------------------------------------------------------------------

const SETTINGS_LABEL: &str = "settings";

pub(crate) fn show_settings_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(SETTINGS_LABEL) {
        w.show()?;
        w.unminimize()?;
        w.set_focus()?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_settings(app: AppHandle) -> Result<(), String> {
    show_settings_window(&app).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Audio (mute)
// ---------------------------------------------------------------------------

/// Mute/unmute the whole render webview natively
///
/// macOS has no public per-webview mute API. On that
/// platform we instead close the window to stop audio (see `set_screen_visible`)
/// and the Settings mute button is hidden (`mute_supported` returns false).
#[allow(unused_variables)]
fn set_main_muted(w: &WebviewWindow, muted: bool) {
    #[cfg(target_os = "linux")]
    {
        let _ = w.with_webview(move |webview| {
            use webkit2gtk::WebViewExt;
            webview.inner().set_is_muted(muted);
        });
    }
    #[cfg(target_os = "windows")]
    {
        let _ = w.with_webview(move |webview| {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_8;
            use windows::core::Interface;
            unsafe {
                if let Ok(core) = webview.controller().CoreWebView2() {
                    if let Ok(core8) = core.cast::<ICoreWebView2_8>() {
                        let _ = core8.SetIsMuted(muted);
                    }
                }
            }
        });
    }
}

#[tauri::command]
pub fn mute_supported() -> bool {
    cfg!(any(target_os = "linux", target_os = "windows"))
}

#[tauri::command]
pub fn set_screen_muted(app: AppHandle, muted: bool) -> Result<(), String> {
    if let Ok(mut g) = app.state::<MuteState>().0.lock() {
        *g = muted;
    }
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        set_main_muted(&w, muted || !visible);
    }
    let _ = app.emit("screen-muted", muted);
    Ok(())
}

#[tauri::command]
pub fn is_screen_muted(app: AppHandle) -> Result<bool, String> {
    Ok(is_user_muted(&app))
}

// ---------------------------------------------------------------------------
// macOS-only helper windows
// ---------------------------------------------------------------------------

/// (macOS) Build the render window fresh. macOS can't mute a live webview, so
/// the render window only exists while visible.
#[cfg(target_os = "macos")]
fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("TheOpenPresenter Screen")
        .inner_size(1280.0, 800.0)
        .visible(true)
        .build()
}

/// (macOS) A hidden helper window parked on the server origin, used purely to
/// set (during login) and read the session cookie. The render window is
/// transient on macOS, so we can't rely on it for cookie work; this one
/// persists. Dashboard/login pages don't autoplay audio, so it stays silent.
#[cfg(target_os = "macos")]
pub(crate) fn ensure_auth_window(app: &AppHandle, root_url: &str) -> tauri::Result<WebviewWindow> {
    use tauri::{Url, WebviewUrl, WebviewWindowBuilder};
    if let Some(w) = app.get_webview_window("auth") {
        return Ok(w);
    }
    let url = Url::parse(root_url)
        .map(WebviewUrl::External)
        .unwrap_or_else(|_| WebviewUrl::App("index.html".into()));
    WebviewWindowBuilder::new(app, "auth", url)
        .title("TheOpenPresenter")
        .inner_size(800.0, 600.0)
        .visible(false)
        .build()
}

// ---------------------------------------------------------------------------
// Main render window visibility
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
fn apply_screen_visible(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    if visible {
        match app.get_webview_window("main") {
            Some(w) => {
                w.show()?;
                w.unminimize()?;
                w.set_focus()?;
            }
            // Recreate the render window; MainScreen renders the stored screen.
            None => {
                create_main_window(app)?;
            }
        }
    } else if let Some(w) = app.get_webview_window("main") {
        // Tear the webview down — destroying it is what stops the audio.
        w.close()?;
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn apply_screen_visible(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window("main") {
        if visible {
            apply_stored_monitor(app, &w);
            w.show()?;
            w.unminimize()?;
            w.set_focus()?;
            let _ = w.set_fullscreen(true);
            // Restore the user's mute choice when showing.
            set_main_muted(&w, is_user_muted(app));
        } else {
            set_main_muted(&w, true);
            w.hide()?;
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn apply_stored_monitor(app: &AppHandle, w: &WebviewWindow) {
    let Some(name) = stored_monitor_pref(app) else {
        return;
    };
    let Ok(monitors) = w.available_monitors() else {
        return;
    };
    let Some(target) = monitors
        .iter()
        .find(|m| m.name().map(|n| n == &name).unwrap_or(false))
    else {
        return;
    };
    let pos = *target.position();
    let size = *target.size();
    let _ = w.set_position(PhysicalPosition::new(pos.x, pos.y));
    let _ = w.set_size(PhysicalSize::new(size.width, size.height));
}

#[cfg(not(target_os = "macos"))]
fn stored_monitor_pref(app: &AppHandle) -> Option<String> {
    let store = app.store("config.json").ok()?;
    let settings = store.get("settings")?;
    let monitor = settings.get("monitor")?.as_str()?;
    if monitor == "current" || monitor.is_empty() {
        None
    } else {
        Some(monitor.to_string())
    }
}

pub(crate) fn set_screen_visible(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    apply_screen_visible(app, visible)?;
    let _ = app.emit("screen-visibility", visible);
    Ok(())
}

#[tauri::command]
pub fn show_screen(app: AppHandle) -> Result<(), String> {
    set_screen_visible(&app, true).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_screen(app: AppHandle) -> Result<(), String> {
    set_screen_visible(&app, false).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn refresh_screen(app: AppHandle) -> Result<(), String> {
    // On macOS the window may be closed (hidden state). Nothing to refresh.
    let Some(w) = app.get_webview_window("main") else {
        return Ok(());
    };
    w.eval("window.location.reload()")
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn is_screen_visible(app: AppHandle) -> Result<bool, String> {
    match app.get_webview_window("main") {
        Some(w) => w.is_visible().map_err(|e| e.to_string()),
        None => Ok(false),
    }
}

#[tauri::command]
#[cfg_attr(target_os = "macos", allow(unused_variables))]
pub fn navigate_main(app: AppHandle, url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(w) = app.get_webview_window("main") {
            w.close().map_err(|e| e.to_string())?;
        }
        let _ = app.emit("screen-visibility", false);
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let w = app
            .get_webview_window("main")
            .ok_or_else(|| "main window not found".to_string())?;
        // `eval`-based navigation works whether the main window is currently on
        // the React bundle or already on a remote URL.
        let escaped = url.replace('\\', "\\\\").replace('\'', "\\'");
        w.eval(&format!("window.location.replace('{escaped}')"))
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Esc-to-hide (Linux: WebKit2GTK key handler)
// ---------------------------------------------------------------------------
#[cfg(target_os = "linux")]
pub(crate) fn install_esc_handler(app: &AppHandle) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    let app_for_handler = app.clone();
    let _ = w.with_webview(move |webview| {
        use gtk::gdk;
        use gtk::glib;
        use gtk::prelude::WidgetExt;
        let wv = webview.inner();
        wv.connect_key_press_event(move |_, event_key| {
            if event_key.keyval() == gdk::keys::constants::Escape {
                let _ = set_screen_visible(&app_for_handler, false);
                return glib::Propagation::Stop;
            }
            glib::Propagation::Proceed
        });
    });
}
