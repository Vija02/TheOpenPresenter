use std::net::SocketAddrV4;
use std::sync::Arc;

use tauri::{Manager, State};
use tokio::sync::Mutex as TokioMutex;

use crate::iroh_bridge;

pub type IrohBridgeState = Arc<TokioMutex<Option<Arc<TokioMutex<iroh_bridge::IrohBridge>>>>>;

/// Response type for iroh bridge status
#[derive(serde::Serialize)]
pub struct IrohBridgeStatus {
    pub enabled: bool,
    pub ticket: Option<String>,
    pub node_id: Option<String>,
}

/// Get the current status of the iroh bridge
#[tauri::command]
pub async fn get_iroh_status(
    bridge_state: State<'_, IrohBridgeState>,
) -> Result<IrohBridgeStatus, String> {
    let state = bridge_state.lock().await;
    
    match state.as_ref() {
        Some(bridge) => {
            let bridge_locked = bridge.lock().await;
            Ok(IrohBridgeStatus {
                enabled: true,
                ticket: Some(bridge_locked.ticket().to_string()),
                node_id: Some(bridge_locked.node_id().to_string()),
            })
        }
        None => Ok(IrohBridgeStatus {
            enabled: false,
            ticket: None,
            node_id: None,
        }),
    }
}

/// Start the iroh bridge manually (if not auto-started)
#[tauri::command]
pub async fn start_iroh_bridge(
    app: tauri::AppHandle,
    bridge_state: State<'_, IrohBridgeState>,
) -> Result<IrohBridgeStatus, String> {
    {
        let state = bridge_state.lock().await;
        if state.is_some() {
            return Err("Iroh bridge is already running".to_string());
        }
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    
    let target_addr: SocketAddrV4 = crate::IROH_TARGET_ADDR
        .parse()
        .map_err(|e: std::net::AddrParseError| e.to_string())?;
    
    let bridge = iroh_bridge::start_bridge(target_addr, data_dir)
        .await
        .map_err(|e| e.to_string())?;
    
    let status = {
        let bridge_locked = bridge.lock().await;
        IrohBridgeStatus {
            enabled: true,
            ticket: Some(bridge_locked.ticket().to_string()),
            node_id: Some(bridge_locked.node_id().to_string()),
        }
    };
    
    {
        let mut state = bridge_state.lock().await;
        *state = Some(bridge);
    }
    
    Ok(status)
}

/// Stop the iroh bridge
#[tauri::command]
pub async fn stop_iroh_bridge(
    bridge_state: State<'_, IrohBridgeState>,
) -> Result<(), String> {
    let bridge = {
        let mut state = bridge_state.lock().await;
        state.take()
    };
    
    if let Some(bridge) = bridge {
        let mut bridge_locked = bridge.lock().await;
        bridge_locked.shutdown().await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// Get just the connection ticket string
#[tauri::command]
pub async fn get_iroh_ticket(
    bridge_state: State<'_, IrohBridgeState>,
) -> Result<Option<String>, String> {
    let state = bridge_state.lock().await;
    
    match state.as_ref() {
        Some(bridge) => {
            let bridge_locked = bridge.lock().await;
            Ok(Some(bridge_locked.ticket().to_string()))
        }
        None => Ok(None),
    }
}
