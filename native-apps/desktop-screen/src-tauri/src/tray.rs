//! Note on Linux: the protocol does not distinguish left vs right click
//! So in linux, every click opens the menu

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Listener, Manager,
};

use crate::window::{set_screen_visible, show_settings_window};

pub(crate) fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings_item =
        MenuItem::with_id(app, "tray:settings", "Settings\u{2026}", true, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "tray:show", "Show screen", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "tray:hide", "Hide screen", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "tray:quit", "Quit", true, None::<&str>)?;

    // Seed enabled states from the current window visibility so the menu is
    // honest the first time the user opens it
    let initial_visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    let _ = show_item.set_enabled(!initial_visible);
    let _ = hide_item.set_enabled(initial_visible);

    let menu = Menu::with_items(app, &[&settings_item, &show_item, &hide_item, &quit_item])?;

    // Keep the menu in sync with the real visibility
    let show_for_listener = show_item.clone();
    let hide_for_listener = hide_item.clone();
    app.listen("screen-visibility", move |event| {
        let visible = serde_json::from_str::<bool>(event.payload()).unwrap_or(false);
        let _ = show_for_listener.set_enabled(!visible);
        let _ = hide_for_listener.set_enabled(visible);
    });

    TrayIconBuilder::new()
        .tooltip("TheOpenPresenter Screen")
        .icon(
            app.default_window_icon()
                .cloned()
                .expect("default window icon present"),
        )
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "tray:settings" => {
                let _ = show_settings_window(app);
            }
            "tray:show" => {
                let _ = set_screen_visible(app, true);
            }
            "tray:hide" => {
                let _ = set_screen_visible(app, false);
            }
            "tray:quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left-click → toggle main window visibility. The menu is on the
            // right-click (set above with `show_menu_on_left_click(false)`).
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let visible = w.is_visible().unwrap_or(false);
                    let focused = w.is_focused().unwrap_or(false);
                    let want_visible = !(visible && focused);
                    let _ = set_screen_visible(app, want_visible);
                }
            }
        })
        .build(app)?;

    Ok(())
}
