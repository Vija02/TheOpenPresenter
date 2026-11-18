//! NDJSON over stdin/stdout, the same shape as the runtime manager's.

use serde::{Deserialize, Serialize};

pub use top_runtime_manager::shell::protocol::{encode, Response};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    RemoteStart {
        /// Instead of the runtime's port.
        #[serde(default)]
        port: Option<u16>,
        /// Shown to Studios on the local network. Defaults to the hostname.
        #[serde(default)]
        name: Option<String>,
    },
    RemoteStop,
    RemoteConnect {
        /// A ticket or endpoint ID.
        peer: String,
        /// Preferred local port; another is used if it's taken.
        #[serde(default)]
        port: Option<u16>,
    },
    RemoteDisconnect,
    /// List hosts on the local network, with `host_discovered` and
    /// `host_expired` events after.
    DiscoverStart,
    DiscoverStop,
    RemoteStatus,
    /// This install's endpoint id, whether or not remote access is on.
    NodeId,
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(flatten)]
    pub command: Command,
}

/// `None` for blank lines.
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
            Command::RemoteStart {
                port: None,
                name: None,
            }
        ));

        let request = parse_line(r#"{"cmd":"remote_start","port":4000}"#)
            .unwrap()
            .unwrap();
        assert!(matches!(
            request.command,
            Command::RemoteStart {
                port: Some(4000),
                name: None,
            }
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
