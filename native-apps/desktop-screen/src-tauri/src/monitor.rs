use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

#[derive(Serialize)]
pub struct MonitorInfo {
    name: String,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    is_primary: bool,
}

type MonitorSig = (String, u32, u32, i32, i32);

fn monitor_signatures(app: &AppHandle) -> Vec<MonitorSig> {
    let w = app
        .get_webview_window("settings")
        .or_else(|| app.get_webview_window("main"));
    let Some(w) = w else {
        return vec![];
    };
    let Ok(monitors) = w.available_monitors() else {
        return vec![];
    };
    monitors
        .into_iter()
        .map(|m| {
            let name = m.name().cloned().unwrap_or_default();
            let size = m.size();
            let pos = m.position();
            (name, size.width, size.height, pos.x, pos.y)
        })
        .collect()
}

/// Long-running background task: poll the OS monitor list every ~5s, emit
/// `monitors-changed` when the signature changes, and re-apply kiosk
/// geometry if the kiosk is currently visible (so a re-plugged monitor
/// snaps the window back to its configured display).
pub(crate) async fn watch_monitors(app: AppHandle) {
    let mut last = monitor_signatures(&app);
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;
        let now = monitor_signatures(&app);
        if now == last {
            continue;
        }
        last = now;
        let _ = app.emit("monitors-changed", ());

        if let Some(w) = app.get_webview_window("main") {
            if w.is_visible().unwrap_or(false) {
                let _ = crate::window::set_screen_visible(&app, true);
            }
        }
    }
}

#[tauri::command]
pub fn list_monitors(window: tauri::WebviewWindow) -> Result<Vec<MonitorInfo>, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let primary = window.primary_monitor().map_err(|e| e.to_string())?;
    let primary_name = primary.as_ref().and_then(|m| m.name().cloned());

    Ok(monitors
        .into_iter()
        .enumerate()
        .map(|(i, m)| {
            let name = m
                .name()
                .cloned()
                .unwrap_or_else(|| format!("Monitor {}", i + 1));
            let size = m.size();
            let pos = m.position();
            let is_primary = primary_name.as_deref() == Some(name.as_str());
            MonitorInfo {
                name,
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                is_primary,
            }
        })
        .collect())
}

/// Kiosk-mode apply: move the main "screen" window to the chosen monitor.
///
/// Per-platform sequence:
///
/// - **macOS** — `set_position` + `set_size`. No native fullscreen toggle:
///   the kiosk window is borderless + always-on-top (see
///   `window.rs::create_main_window`) so it covers the target monitor
///   without entering a Mission Control Space. Cocoa's Space-binding
///   semantics make `toggleFullScreen:` unreliable on multi-monitor setups.
/// - **Linux / Windows** — exit fullscreen → wait for the transition to
///   settle → set position + size → re-enter fullscreen. Position alone
///   leaves the window's *centre* potentially on the old display, and most
///   WMs pick the fullscreen monitor by centre.
///
/// Caveat: some Linux WMs (notably tiling ones like i3 / sway) own window
/// placement via their own container model and ignore `set_position` for
/// cross-output moves. On those, the user will need to move the kiosk
/// window via the WM's native binding.
#[tauri::command]
pub async fn apply_monitor(app: AppHandle, monitor_name: String) -> Result<(), String> {
    // On macOS the render window may be closed (hidden state); nothing to
    // move yet — the next show will create it on the chosen monitor.
    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    let monitors = main.available_monitors().map_err(|e| e.to_string())?;
    let target = monitors
        .iter()
        .find(|m| m.name().map(|n| n == &monitor_name).unwrap_or(false))
        .ok_or_else(|| format!("monitor not found: {monitor_name}"))?;

    let pos = *target.position();
    let size = *target.size();

    #[cfg(target_os = "macos")]
    {
        // Borderless + always-on-top; native fullscreen Space is
        // deliberately skipped
        main.set_position(PhysicalPosition::new(pos.x, pos.y))
            .map_err(|e| e.to_string())?;
        main.set_size(PhysicalSize::new(size.width, size.height))
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Don't touch a hidden window. The user just changed the monitor
        // pref via Settings
        if !main.is_visible().unwrap_or(false) {
            return Ok(());
        }

        if main.is_fullscreen().unwrap_or(false) {
            main.set_fullscreen(false).map_err(|e| e.to_string())?;
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
        main.set_position(PhysicalPosition::new(pos.x, pos.y))
            .map_err(|e| e.to_string())?;
        main.set_size(PhysicalSize::new(size.width, size.height))
            .map_err(|e| e.to_string())?;
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        main.set_fullscreen(true).map_err(|e| e.to_string())?;
    }

    Ok(())
}
