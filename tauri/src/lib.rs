use notify_rust::Notification;
use std::sync::{Arc, Mutex};
use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Notification::new()
        .summary("TheOpenPresenter")
        .body("Starting TheOpenPresenter")
        // .timeout(Timeout::Milliseconds(6000)) //milliseconds
        .show()
        .unwrap();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let resource_path = app
                .path()
                .resolve("node-server/run_pg.mjs", BaseDirectory::Resource)?;
            let sidecar_command = app.shell().sidecar("node").unwrap();
            let (mut rx, child) = sidecar_command
                .args([resource_path])
                .spawn()
                .expect("Failed to spawn sidecar");

            // Wrap the child process in Arc<Mutex<>> for shared access
            let child = Arc::new(Mutex::new(Some(child)));

            // Clone the Arc to move into the async task
            let child_clone = Arc::clone(&child);

            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();

            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let mut child_lock = child_clone.lock().unwrap();
                    if let Some(mut child_process) = child_lock.take() {
                        api.prevent_close();

                        if let Err(e) = child_process.kill() {
                            eprintln!("Failed to kill child process: {}", e);
                        }

                        window_clone.close().unwrap();
                    }
                }
            });

            tauri::async_runtime::spawn(async move {
                // read events such as stdout
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line_bytes) = &event {
                        let line = std::str::from_utf8(&line_bytes).unwrap();

                        println!("JS: {:?}", line);
                    }
                    if let CommandEvent::Stderr(line_bytes) = &event {
                        let line = std::str::from_utf8(&line_bytes).unwrap();

                        println!("JS: {:?}", line);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
