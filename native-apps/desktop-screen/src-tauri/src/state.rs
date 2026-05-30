use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio::task::JoinHandle;

#[derive(Default)]
pub struct PairingState {
    pub task: Mutex<Option<JoinHandle<()>>>,
}

pub struct InitialMainUrl(pub Mutex<Option<String>>);

impl Default for InitialMainUrl {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Default)]
pub struct MuteState(pub Mutex<bool>);

pub fn is_user_muted(app: &AppHandle) -> bool {
    app.state::<MuteState>()
        .0
        .lock()
        .map(|g| *g)
        .unwrap_or(false)
}
