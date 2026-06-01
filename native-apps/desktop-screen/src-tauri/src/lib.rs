mod host;
mod monitor;
mod pairing;
mod platform;
mod session;
mod state;
mod tray;
mod window;

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
#[cfg(not(target_os = "linux"))]
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_global_shortcut::{Code, ShortcutState};

use state::{InitialMainUrl, MuteState, PairingState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        platform::fix_webkit_vm_rendering();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Subsequent invocations open Settings
            let _ = window::show_settings_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Esc → hide the main "screen" window
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if shortcut.key == Code::Escape
                        && shortcut.mods.is_empty()
                        && event.state == ShortcutState::Pressed
                    {
                        let _ = window::set_screen_visible(app, false);
                    }
                })
                .build(),
        )
        .manage(PairingState::default())
        .manage(InitialMainUrl::default())
        .manage(MuteState::default())
        .setup(|app| {
            tray::setup_tray(app.handle())?;

            #[cfg(target_os = "linux")]
            window::install_esc_handler(app.handle());

            if let Some(w) = app.get_webview_window("main") {
                if let Ok(url) = w.url() {
                    if let Ok(mut guard) = app.state::<InitialMainUrl>().0.lock() {
                        *guard = Some(url.to_string());
                    }
                }
            }

            let app_for_monitors = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                monitor::watch_monitors(app_for_monitors).await;
            });

            // The main render window is hidden by default. If the user has
            // enabled OS-level autostart, we treat this launch as a kiosk
            // launch and show it on top of the Settings window.
            //
            // When `requireHostReachable` is also on, the show is deferred
            // until a background poll confirms the server is up
            let handle = app.handle().clone();
            let autostart_enabled = handle.autolaunch().is_enabled().unwrap_or(false);
            if autostart_enabled {
                if host::stored_require_host_reachable(&handle) {
                    let app_for_task = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        host::wait_for_host_and_show(app_for_task).await;
                    });
                } else {
                    let _ = window::set_screen_visible(&handle, true);
                }
            } else {
                #[cfg(target_os = "macos")]
                if let Some(w) = handle.get_webview_window("main") {
                    let _ = w.close();
                    let _ = handle.emit("screen-visibility", false);
                }
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = window::set_screen_visible(&handle, false);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    "main" => {
                        #[cfg(not(target_os = "macos"))]
                        {
                            api.prevent_close();
                            let _ = window::set_screen_visible(window.app_handle(), false);
                        }
                        #[cfg(target_os = "macos")]
                        {
                            let _ = window.app_handle().emit("screen-visibility", false);
                        }
                    }
                    "settings" => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                }
            }

            #[cfg(not(target_os = "linux"))]
            if window.label() == "main" {
                if let WindowEvent::Focused(focused) = event {
                    let gsm = window.app_handle().global_shortcut();
                    if *focused {
                        let _ = gsm.register("Escape");
                    } else {
                        let _ = gsm.unregister("Escape");
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            pairing::start_pairing,
            pairing::stop_pairing,
            window::open_settings,
            window::show_screen,
            window::hide_screen,
            window::refresh_screen,
            window::is_screen_visible,
            window::set_screen_muted,
            window::is_screen_muted,
            window::mute_supported,
            window::navigate_main,
            monitor::list_monitors,
            monitor::apply_monitor,
            host::check_host,
            session::establish_session,
            session::list_screens,
            session::clear_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
