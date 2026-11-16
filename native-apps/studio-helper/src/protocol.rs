//! Line-delimited JSON spoken over stdin/stdout, the same shape as the
//! runtime manager's: requests carry an `id` that the response echoes.

use serde::{Deserialize, Serialize};

pub use top_runtime_manager::shell::protocol::{encode, Response};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    /// Start peer-to-peer remote access to the running server.
    RemoteStart {
        /// Forward to this port instead of the runtime under the root.
        #[serde(default)]
        port: Option<u16>,
    },
    /// Stop remote access.
    RemoteStop,
    /// Report remote access state and the ticket, if any.
    RemoteStatus,
    /// Exit the helper.
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(flatten)]
    pub command: Command,
}

/// Parse one request line. Returns `None` for blank lines so a stray newline
/// is not reported as a protocol error.
pub fn parse_line(line: &str) -> Option<Result<Request, serde_json::Error>> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(serde_json::from_str(trimmed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_start_takes_an_optional_port() {
        let request = parse_line(r#"{"id":3,"cmd":"remote_start"}"#)
            .unwrap()
            .unwrap();
        assert_eq!(request.id, Some(3));
        assert!(matches!(
            request.command,
            Command::RemoteStart { port: None }
        ));

        let request = parse_line(r#"{"cmd":"remote_start","port":4000}"#)
            .unwrap()
            .unwrap();
        assert!(matches!(
            request.command,
            Command::RemoteStart { port: Some(4000) }
        ));
    }

    #[test]
    fn the_remote_commands_keep_the_managers_names() {
        // Studio sent these to the manager before they moved here.
        for cmd in ["remote_stop", "remote_status", "shutdown"] {
            let line = format!(r#"{{"cmd":"{cmd}"}}"#);
            assert!(parse_line(&line).unwrap().is_ok(), "{cmd}");
        }
    }

    #[test]
    fn blank_lines_are_ignored_and_unknown_commands_are_errors() {
        assert!(parse_line("  ").is_none());
        assert!(parse_line(r#"{"cmd":"ensure"}"#).unwrap().is_err());
    }
}
