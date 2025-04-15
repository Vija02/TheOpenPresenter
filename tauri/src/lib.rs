use std::process;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri::Position;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::time::sleep;

async fn wait_for_endpoint(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    loop {
        match client.get(url).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    return Ok(());
                }
            }
            Err(_) => {}
        }
        sleep(Duration::from_millis(500)).await;
    }
}

#[tauri::command]
async fn open_renderer(
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
        .build()
        .unwrap(),
    };

    if let Ok(current_url) = renderer_window.url() {
        if current_url.to_string() != url {
            renderer_window
                .eval(&format!("window.location.replace('{}')", url))
                .unwrap();
        }
    }

    if (renderer_window.is_fullscreen().unwrap()) {
        renderer_window.set_fullscreen(false);
    }

    let monitors = app.available_monitors()?;
    let monitor = monitors.get(mindex).ok_or(tauri::Error::WindowNotFound)?;

    let pos = monitor.position();

    renderer_window.set_position(Position::Physical(tauri::PhysicalPosition {
        x: pos.x,
        y: pos.y,
    }))?;
    renderer_window.set_fullscreen(true);

    renderer_window.show().unwrap();

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_renderer])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .setup(|app| {
            let resource_path = app
                .path()
                .resolve("node-server/run_server.mjs", BaseDirectory::Resource)?;
            let sidecar_command = app.shell().sidecar("node").unwrap();
            let (mut rx, child) = sidecar_command
                .args([resource_path])
                .spawn()
                .expect("Failed to spawn sidecar");

            // Wrap the child process in Arc<Mutex<>> for shared access
            let child = Arc::new(Mutex::new(Some(child)));

            // Clone the Arc to move into the async task
            let child_clone = Arc::clone(&child);
            let child_clone2 = Arc::clone(&child);

            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();

            // Handle cleaning process when window is closed
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let mut child_lock = child_clone.lock().unwrap();
                    if let Some(mut child_process) = child_lock.take() {
                        api.prevent_close();

                        if let Err(e) = child_process.kill() {
                            eprintln!("Failed to kill child process: {}", e);
                        }

                        window_clone.close().unwrap();

                        process::exit(0);
                    }
                }
            });

            // Log stdout and stderr
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line_bytes) = &event {
                        let line = std::str::from_utf8(&line_bytes).unwrap();

                        log::info!("{}", line);
                    }
                    if let CommandEvent::Stderr(line_bytes) = &event {
                        let line = std::str::from_utf8(&line_bytes).unwrap();

                        log::error!("{}", line);
                    }
                }
            });

            // Show splashscreen until we can reach the endpoint
            let splash_window = app.get_webview_window("splashscreen").unwrap();
            let splash_window_clone = window.clone();
            let main_window = app.get_webview_window("main").unwrap();

            tauri::async_runtime::spawn(async move {
                if wait_for_endpoint("http://localhost:5678/o/local")
                    .await
                    .is_ok()
                {
                    main_window
                        .eval("window.location.replace('http://localhost:5678/o/local')")
                        .unwrap();
                    main_window.show().unwrap();
                    splash_window_clone.close().unwrap();
                }
            });

            splash_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let mut child_lock = child_clone2.lock().unwrap();
                    if let Some(mut child_process) = child_lock.take() {
                        api.prevent_close();

                        if let Err(e) = child_process.kill() {
                            eprintln!("Failed to kill child process: {}", e);
                        }

                        splash_window_clone.close().unwrap();

                        process::exit(0);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
