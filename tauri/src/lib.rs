use std::{
    net::SocketAddrV4,
    process,
    sync::Arc,
    time::Duration,
};

use tauri::{path::BaseDirectory, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tokio::{time::sleep, sync::Mutex as TokioMutex};

mod iroh_bridge;
mod iroh_commands;
mod renderer_commands;

pub use iroh_commands::{
    get_iroh_status, get_iroh_ticket, start_iroh_bridge, stop_iroh_bridge,
    IrohBridgeState, IrohBridgeStatus,
};
pub use renderer_commands::open_renderer;

type ChildProcess = Arc<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>;

const SERVER_ORG_PAGE_URL: &str = "http://localhost:5678/o/local";
const SERVER_HOST: &str = "http://localhost:5678";
pub(crate) const IROH_TARGET_ADDR: &str = "127.0.0.1:5678";

async fn wait_for_endpoint(url: &str) {
    let client = reqwest::Client::new();
    loop {
        if let Ok(response) = client.get(url).send().await {
            if response.status().is_success() {
                return;
            }
        }
        sleep(Duration::from_millis(500)).await;
    }
}

/// Handles window close event by killing the child process and exiting
fn handle_close_request(
    api: &tauri::CloseRequestApi,
    child: &ChildProcess,
    window: &WebviewWindow,
) {
    if let Some(child_process) = child.lock().unwrap().take() {
        api.prevent_close();
        if let Err(e) = child_process.kill() {
            eprintln!("Failed to kill child process: {}", e);
        }
        window.close().unwrap();
        process::exit(0);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the iroh bridge state
    let iroh_bridge_state: IrohBridgeState = Arc::new(TokioMutex::new(None));

    tauri::Builder::default()
        .manage(iroh_bridge_state.clone())
        .invoke_handler(tauri::generate_handler![
            open_renderer,
            get_iroh_status,
            start_iroh_bridge,
            stop_iroh_bridge,
            get_iroh_ticket
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(move |app| {
            let resource_path = app
                .path()
                .resolve("node-server/run_server.mjs", BaseDirectory::Home)?;

            let (mut rx, child) = app
                .shell()
                .sidecar("node")
                .expect("Failed to create sidecar")
                .args([resource_path])
                .spawn()
                .expect("Failed to spawn sidecar");

            let child: ChildProcess = Arc::new(std::sync::Mutex::new(Some(child)));

            let main_window = app.get_webview_window("main").unwrap();
            let splash_window = app.get_webview_window("splashscreen").unwrap();

            // Set up close handlers for both windows
            let (child_for_main, main_window_ref) = (Arc::clone(&child), main_window.clone());
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    handle_close_request(api, &child_for_main, &main_window_ref);
                }
            });

            let (child_for_splash, splash_window_ref) = (Arc::clone(&child), splash_window.clone());
            splash_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    handle_close_request(api, &child_for_splash, &splash_window_ref);
                }
            });

            // Log sidecar stdout and stderr
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match &event {
                        CommandEvent::Stdout(bytes) => {
                            if let Ok(line) = std::str::from_utf8(bytes) {
                                log::info!("{}", line);
                            }
                        }
                        CommandEvent::Stderr(bytes) => {
                            if let Ok(line) = std::str::from_utf8(bytes) {
                                log::error!("{}", line);
                            }
                        }
                        _ => {}
                    }
                }
            });

            // Get data dir for iroh bridge
            let data_dir = app.path().app_data_dir()?;
            let bridge_state_for_startup = iroh_bridge_state.clone();

            // Wait for server and transition from splash to main window
            // Also start the iroh bridge once the server is ready
            let splash_to_destroy = splash_window.clone();
            tauri::async_runtime::spawn(async move {
                wait_for_endpoint(SERVER_ORG_PAGE_URL).await;
                
                // Start the iroh bridge automatically
                let target_addr: SocketAddrV4 = IROH_TARGET_ADDR.parse().expect("Invalid server address");
                match iroh_bridge::start_bridge(target_addr, data_dir).await {
                    Ok(bridge) => {
                        let (ticket, node_id) = {
                            let bridge_locked = bridge.lock().await;
                            (
                                bridge_locked.ticket().to_string(),
                                bridge_locked.node_id().to_string()
                            )
                        };
                        log::info!("Iroh bridge started successfully");
                        log::info!("Connection ticket: {}", ticket);
                        log::info!("Node ID: {}", node_id);
                        
                        let mut state = bridge_state_for_startup.lock().await;
                        *state = Some(bridge);
                        
                        // Send POST request to /device/host/init
                        let init_url = format!("{}/device/host/init", SERVER_HOST);
                        let client = reqwest::Client::new();
                        let init_body = serde_json::json!({
                            "irohEndpointId": node_id,
                            "irohTicket": ticket
                        });
                        
                        match client.post(&init_url)
                            .header("x-top-csrf-protection", "1")
                            .json(&init_body)
                            .send()
                            .await
                        {
                            Ok(response) => {
                                if response.status().is_success() {
                                    log::info!("Successfully initialized host device with iroh connection info");
                                } else {
                                    log::error!("Failed to initialize host device: HTTP {}", response.status());
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to send init request: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to start iroh bridge: {}", e);
                    }
                }
                
                main_window
                    .eval(&format!("window.location.replace('{}')", SERVER_ORG_PAGE_URL))
                    .unwrap();
                main_window.show().unwrap();
                splash_to_destroy.destroy().unwrap();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
