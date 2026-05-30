use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, State};

use crate::state::PairingState;

#[tauri::command]
pub async fn start_pairing(
    app: AppHandle,
    state: State<'_, PairingState>,
    root_url: String,
) -> Result<(), String> {
    stop_pairing_inner(&state);

    let url = format!("{}/qr-auth/request", root_url.trim_end_matches('/'));
    let app_for_task = app.clone();
    let task = tokio::spawn(async move {
        if let Err(e) = sse_loop(&app_for_task, &url).await {
            let _ = app_for_task.emit("pairing-error", e.to_string());
        }
    });

    *state
        .task
        .lock()
        .map_err(|e| format!("pairing state lock poisoned: {e}"))? = Some(task);
    Ok(())
}

/// Cancel any in-flight pairing SSE task
#[tauri::command]
pub fn stop_pairing(state: State<'_, PairingState>) {
    stop_pairing_inner(&state);
}

fn stop_pairing_inner(state: &PairingState) {
    if let Ok(mut guard) = state.task.lock() {
        if let Some(h) = guard.take() {
            h.abort();
        }
    }
}

async fn sse_loop(app: &AppHandle, url: &str) -> anyhow::Result<()> {
    // No request timeout — SSE streams are long-lived by design.
    let client = reqwest::Client::builder().build()?;
    let resp = client
        .get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await?
        .error_for_status()?;

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        buf.push_str(std::str::from_utf8(&chunk)?);
        while let Some(idx) = buf.find("\n\n") {
            let block: String = buf.drain(..idx + 2).collect();
            for line in block.lines() {
                if let Some(data) = line.strip_prefix("data:") {
                    let payload = data.trim_start().to_string();
                    if !payload.is_empty() {
                        let _ = app.emit("pairing-message", payload);
                    }
                }
            }
        }
    }
    Ok(())
}
