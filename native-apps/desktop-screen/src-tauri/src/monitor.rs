use serde::Serialize;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

#[derive(Serialize)]
pub struct MonitorInfo {
    name: String,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    is_primary: bool,
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

/// Kiosk-mode apply: move the main "screen" window to the chosen monitor
/// and fullscreen it there.
///
/// Sequence (most-frequent failure modes in parentheses):
///
///   1. Exit fullscreen — `set_position` is silently dropped while the
///      window is fullscreen on Win/macOS (window stays put).
///   2. Wait ~150ms for the exit transition to settle on platforms that
///      animate it (race: move issued mid-transition is ignored).
///   3. Set both position AND size to the target monitor's rect. Position
///      alone leaves the window's *centre* potentially on the old display,
///      and most WMs choose the fullscreen monitor by centre.
///   4. Brief settle, then re-enter fullscreen.
///
/// Standard fullscreen hides decorations on all three platforms — no extra
/// `set_decorations(false)` needed.
///
/// Caveat: some Linux WMs (notably tiling ones like i3 / sway) own window
/// placement via their own container model and ignore `set_position` for
/// cross-output moves. On those, the user will need to move the kiosk
/// window via the WM's native binding.
#[tauri::command]
pub async fn apply_monitor(app: AppHandle, monitor_name: String) -> Result<(), String> {
    // On macOS the render window may be closed (hidden state)
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
    Ok(())
}
