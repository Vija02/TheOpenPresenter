use std::time::Duration;

/// Check if we can reach this host
#[tauri::command]
pub async fn check_host(url: String) -> Result<bool, String> {
    if url.is_empty() {
        return Ok(false);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;
    Ok(client.get(&url).send().await.is_ok())
}
