use tauri::{Manager, Position};

#[cfg(target_os = "macos")]
const ABOVE_MENU_BAR_LEVEL: isize = 25;

/// (macOS) Lift the renderer above the Dock and menu bar.
#[cfg(target_os = "macos")]
fn raise_above_menu_bar(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};

    let ns_window = window.ns_window()? as *mut Object;
    if ns_window.is_null() {
        return Ok(());
    }

    // SAFETY: Tauri hands back this window's live NSWindow, and commands taking
    // an AppHandle are dispatched on the main thread, where AppKit requires it.
    unsafe {
        let _: () = msg_send![ns_window, setLevel: ABOVE_MENU_BAR_LEVEL];
    }

    Ok(())
}

/// Open or navigate the renderer window to a specified URL on a given monitor
#[tauri::command]
pub async fn open_renderer(
    app: tauri::AppHandle,
    url: String,
    mindex: usize,
) -> Result<(), tauri::Error> {
    let renderer_window = match app.get_webview_window("renderer") {
        Some(window) => window,
        None => tauri::WebviewWindowBuilder::new(
            &app,
            "renderer",
            tauri::WebviewUrl::External(url.parse().unwrap()),
        )
        .title("TheOpenPresenter Renderer")
        .fullscreen(false)
        .decorations(false)
        .build()?,
    };

    if let Ok(current_url) = renderer_window.url() {
        if current_url.to_string() != url {
            renderer_window.eval(&format!("window.location.replace('{}')", url))?;
        }
    }

    let monitors = app.available_monitors()?;
    let monitor = monitors.get(mindex).ok_or(tauri::Error::WindowNotFound)?;
    let position = *monitor.position();

    // macOS deliberately does NOT use native fullscreen
    #[cfg(target_os = "macos")]
    {
        let size = *monitor.size();
        renderer_window.set_resizable(false)?;
        renderer_window.set_position(Position::Physical(tauri::PhysicalPosition {
            x: position.x,
            y: position.y,
        }))?;
        renderer_window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: size.width,
            height: size.height,
        }))?;
        raise_above_menu_bar(&renderer_window)?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        if renderer_window.is_fullscreen().unwrap_or(false) {
            renderer_window.set_fullscreen(false)?;
        }
        renderer_window.set_position(Position::Physical(tauri::PhysicalPosition {
            x: position.x,
            y: position.y,
        }))?;
        renderer_window.set_fullscreen(true)?;
    }

    renderer_window.show()?;

    Ok(())
}
