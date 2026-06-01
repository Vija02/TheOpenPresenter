//! Window management: the settings window, the main render window's
//! lifecycle / visibility / navigation, and webview audio (mute).
//!
//! Per-platform render path:
//!
//! - **Linux / Windows** — single persistent `main` webview window, hidden
//!   + muted when "off".
//! - **macOS** — WKWebView has no per-webview mute API, so the render
//!   window is transient (created on show, closed on hide). A persistent
//!   hidden `auth` helper carries the session cookie. The render window
//!   uses borderless + positioned-to-target-monitor instead of native
//!   fullscreen — Cocoa's `toggleFullScreen:` creates a Mission Control
//!   Space bound to whichever display it picks, which disagrees with
//!   `set_position` on multi-monitor setups (kiosk reliably lands on the
//!   wrong screen). See `create_main_window` below.

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

/// Mute/unmute the whole render webview natively (Linux / Windows).
/// macOS has no public per-webview mute API; the render window is destroyed
/// to silence audio (see `set_screen_visible`).
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
///
/// Deliberately NOT using native macOS fullscreen (`set_fullscreen(true)` →
/// `NSWindow.toggleFullScreen:`) because it creates a Mission Control Space
/// bound to whichever display Cocoa thinks the window belongs to — which
/// disagrees with `set_position` in multi-monitor setups, so the kiosk
/// reliably lands on the wrong screen
#[cfg(target_os = "macos")]
fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    let ((x, y), (w, h)) = target_geometry(app).unwrap_or(((0, 0), (1280, 800)));
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("TheOpenPresenter Screen")
        .position(x as f64, y as f64)
        .inner_size(w as f64, h as f64)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .visible(true)
        .build()
}

/// (macOS) Resolve the chosen monitor's absolute (x, y) + (w, h). Falls back
/// to the primary monitor when the user hasn't picked one or the saved name
/// no longer matches a connected output
#[cfg(target_os = "macos")]
fn target_geometry(app: &AppHandle) -> Option<((i32, i32), (u32, u32))> {
    let settings = app.get_webview_window("settings")?;
    let monitors = settings.available_monitors().ok()?;
    if monitors.is_empty() {
        return None;
    }

    let pref = stored_monitor_pref(app);
    let chosen = pref
        .as_deref()
        .and_then(|name| {
            monitors
                .iter()
                .find(|m| m.name().map(|n| n == name).unwrap_or(false))
        })
        .or_else(|| {
            let primary_name = settings
                .primary_monitor()
                .ok()
                .flatten()
                .and_then(|m| m.name().cloned());
            primary_name
                .as_deref()
                .and_then(|n| monitors.iter().find(|m| m.name() == Some(&n.to_string())))
        })
        .or_else(|| monitors.first())?;

    let pos = *chosen.position();
    let size = *chosen.size();
    Some(((pos.x, pos.y), (size.width, size.height)))
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
                if let Some(((x, y), (gw, gh))) = target_geometry(app) {
                    let _ = w.set_position(PhysicalPosition::new(x, y));
                    let _ = w.set_size(PhysicalSize::new(gw, gh));
                }
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

/// Read the user's monitor preference from `config.json`. Returns None when
/// the pref is missing, blank, or set to "current" (the explicit "stay on
/// whichever display the window already has" sentinel).
fn stored_monitor_pref(app: &AppHandle) -> Option<String> {
    let store = app.store("config.json").ok()?;
    let settings = store.get("settings")?;
    let monitor = settings.get("monitor")?.as_str()?.to_string();
    if monitor == "current" || monitor.is_empty() {
        None
    } else {
        Some(monitor)
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
