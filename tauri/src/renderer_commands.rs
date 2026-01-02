use tauri::{Manager, Position};

/// Open or navigate the renderer window to a specified URL on a given monitor
#[tauri::command]
pub async fn open_renderer(
    app: tauri::AppHandle,
    url: String,
    mindex: usize,
) -> Result<(), tauri::Error> {
    let renderer_window = app.get_webview_window("renderer").unwrap_or_else(|| {
        tauri::WebviewWindowBuilder::new(
            &app,
            "renderer",
            tauri::WebviewUrl::External(url.parse().unwrap()),
        )
        .title("TheOpenPresenter Renderer")
        .fullscreen(false)
        .decorations(false)
        .build()
        .unwrap()
    });

    if let Ok(current_url) = renderer_window.url() {
        if current_url.to_string() != url {
            renderer_window
                .eval(&format!("window.location.replace('{}')", url))
                .unwrap();
        }
    }

    if renderer_window.is_fullscreen().unwrap_or(false) {
        renderer_window.set_fullscreen(false).unwrap();
    }

    let monitors = app.available_monitors()?;
    let monitor = monitors.get(mindex).ok_or(tauri::Error::WindowNotFound)?;
    let pos = monitor.position();

    renderer_window.set_position(Position::Physical(tauri::PhysicalPosition {
        x: pos.x,
        y: pos.y,
    }))?;
    renderer_window.set_fullscreen(true)?;
    renderer_window.show()?;

    Ok(())
}
