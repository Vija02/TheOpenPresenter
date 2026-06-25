use std::{
    net::SocketAddrV4,
    process,
    sync::Arc,
    time::Duration,
};

use tauri::{path::BaseDirectory, AppHandle, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
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

#[tauri::command]
fn get_local_ip() -> Option<String> {
    local_ip_address::local_ip().ok().map(|ip| ip.to_string())
}

type ChildProcess = Arc<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>;

const SERVER_ORG_PAGE_URL: &str = "http://localhost:5678/o/local";
const SERVER_HOST: &str = "http://localhost:5678";
pub(crate) const IROH_TARGET_ADDR: &str = "127.0.0.1:5678";

/// Always-up cloud instance that receives diagnosis bundles
const DIAGNOSTICS_CLOUD_HOST: &str = "https://theopenpresenter.com";
/// Number of trailing log lines to include in a diagnosis
const MAX_LOG_LINES: usize = 300;
const MAX_LOG_BYTES: u64 = 64 * 1024;

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

/// Kills the node server, shows a blocking error dialog, then exits the app.
fn show_fatal_error_and_exit(app_handle: &AppHandle, child: &ChildProcess, message: &str) {
    // Make sure the node server is dead before we exit.
    if let Some(child_process) = child.lock().unwrap().take() {
        if let Err(e) = child_process.kill() {
            eprintln!("Failed to kill child process: {}", e);
        }
    }

    app_handle
        .dialog()
        .message(message)
        .kind(MessageDialogKind::Error)
        .title("TheOpenPresenter - Fatal Error")
        .blocking_show();

    process::exit(1);
}

/// Reads the most-recently-modified `.log` file in `log_dir` and returns its
/// trailing content as `(file_name, content, truncated)` — the last
/// `MAX_LOG_LINES` lines, further capped to `MAX_LOG_BYTES`. `truncated` is true
/// if anything earlier in the file was dropped.
fn collect_latest_log(log_dir: &std::path::Path) -> Option<(String, String, bool)> {
    use std::io::{Read, Seek, SeekFrom};

    let mut logs: Vec<_> = std::fs::read_dir(log_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "log").unwrap_or(false))
        .collect();
    if logs.is_empty() {
        return None;
    }

    // Most-recently-modified last, then take it.
    logs.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    let latest = logs.last()?;
    let path = latest.path();

    let size = std::fs::metadata(&path).ok()?.len();
    // Read a bounded window from the end; we only ever keep a slice of this.
    let read_window = MAX_LOG_BYTES.saturating_mul(4);
    let start = size.saturating_sub(read_window);

    let mut file = std::fs::File::open(&path).ok()?;
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).ok()?;
    let raw = String::from_utf8_lossy(&buf);

    // Keep only the last MAX_LOG_LINES lines.
    let lines: Vec<&str> = raw.lines().collect();
    let kept_from = lines.len().saturating_sub(MAX_LOG_LINES);
    let mut content = lines[kept_from..].join("\n");

    // Safety net: hard byte cap (e.g. against a single huge line).
    let mut truncated = start > 0 || kept_from > 0;
    let cap = MAX_LOG_BYTES as usize;
    if content.len() > cap {
        // Cut on a char boundary, keeping the most recent bytes.
        let mut cut = content.len() - cap;
        while !content.is_char_boundary(cut) {
            cut += 1;
        }
        content = content[cut..].to_string();
        truncated = true;
    }

    let name = path.file_name()?.to_string_lossy().to_string();
    Some((name, content, truncated))
}

/// Gathers the latest log tail + system info and POST it
async fn report_diagnosis(
    app_handle: &AppHandle,
    reason: &str,
    recent_output: &str,
) -> Result<(), String> {
    let log_dir = app_handle
        .path()
        .app_log_dir()
        .map_err(|e| format!("Failed to resolve log dir: {}", e))?;

    let logs = match collect_latest_log(&log_dir) {
        Some((name, content, truncated)) => serde_json::json!([{
            "name": name,
            "content": content,
            "truncated": truncated,
        }]),
        None => serde_json::json!([]),
    };

    let pkg = app_handle.package_info();
    let cpu_count = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(0);

    let system_info = serde_json::json!({
        "source": "tauri",
        "reason": reason,
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
        "appName": pkg.name,
        "appVersion": pkg.version.to_string(),
        "cpuCount": cpu_count,
        "logDir": log_dir.to_string_lossy(),
        "recentOutput": recent_output,
    });

    let body = serde_json::json!({ "systemInfo": system_info, "logs": logs });

    let host = std::env::var("DIAGNOSTICS_CLOUD_HOST")
        .unwrap_or_else(|_| DIAGNOSTICS_CLOUD_HOST.to_string());
    let url = format!("{}/diagnostics/report", host.trim_end_matches('/'));

    let response = reqwest::Client::new()
        .post(&url)
        .header("x-top-csrf-protection", "1")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to send diagnosis: {}", e))?;

    if response.status().is_success() {
        log::info!("Diagnosis sent to cloud successfully");
        Ok(())
    } else {
        Err(format!("Cloud returned HTTP {}", response.status()))
    }
}

/// Manually trigger a diagnosis upload from the UI.
#[tauri::command]
async fn send_diagnosis(app_handle: AppHandle) -> Result<(), String> {
    report_diagnosis(&app_handle, "manual", "").await
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
            get_iroh_ticket,
            get_local_ip,
            send_diagnosis
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
                .resolve("node-server/run_server.mjs", BaseDirectory::Resource)?;

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

            // Log sidecar stdout and stderr, and bail out if the server errors/dies.
            let app_handle = app.handle().clone();
            let child_for_error = Arc::clone(&child);
            tauri::async_runtime::spawn(async move {
                // Keep the most recent stderr output so we can show it in the error dialog.
                let mut stderr_buffer = String::new();
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
                                stderr_buffer.push_str(line);
                            }
                        }
                        CommandEvent::Error(err) => {
                            log::error!("Node server error: {}", err);
                            let message = format!(
                                "The node server encountered an error and the application will now close.\n\nError: {}\n\nServer output:\n{}",
                                err,
                                stderr_buffer.trim()
                            );
                            let reason = format!("node_server_error: {}", err);
                            if let Err(e) =
                                report_diagnosis(&app_handle, &reason, stderr_buffer.trim()).await
                            {
                                log::error!("Failed to report diagnosis: {}", e);
                            }
                            show_fatal_error_and_exit(&app_handle, &child_for_error, &message);
                        }
                        CommandEvent::Terminated(payload) => {
                            // Exit code 0 means a clean shutdown (e.g. we killed it on close).
                            if payload.code != Some(0) {
                                log::error!(
                                    "Node server terminated unexpectedly (code: {:?}, signal: {:?})",
                                    payload.code,
                                    payload.signal
                                );
                                let message = format!(
                                    "The node server stopped unexpectedly and the application will now close.\n\nExit code: {:?}\nSignal: {:?}\n\nServer output:\n{}",
                                    payload.code,
                                    payload.signal,
                                    stderr_buffer.trim()
                                );
                                let reason = format!(
                                    "node_server_terminated: code={:?} signal={:?}",
                                    payload.code, payload.signal
                                );
                                if let Err(e) =
                                    report_diagnosis(&app_handle, &reason, stderr_buffer.trim()).await
                                {
                                    log::error!("Failed to report diagnosis: {}", e);
                                }
                                show_fatal_error_and_exit(&app_handle, &child_for_error, &message);
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
