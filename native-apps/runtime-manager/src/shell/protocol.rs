//! Line-delimited JSON protocol spoken over stdin/stdout.
//!
//! A subprocess plus JSON rather than a native addon: it is simpler, it can
//! be driven identically from Electron and Tauri, and it can be debugged by
//! hand with a terminal.
//!
//! Requests carry an `id`; the matching response echoes it. Events are
//! unsolicited and carry no `id`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    /// Report installed versions, the active one, and state.
    Status,
    /// Resolve a channel to a version without downloading anything.
    Check { channel: String },
    /// Make a version present on disk. `channel` resolves to the newest.
    ///
    /// Does not activate unless asked. An update that swapped the runtime
    /// the moment it finished downloading would do so during whatever the
    /// user is in the middle of.
    Ensure {
        #[serde(default)]
        channel: Option<String>,
        #[serde(default)]
        version: Option<String>,
        #[serde(default)]
        activate: bool,
    },
    /// Activate an installed version.
    Activate { version: String },
    /// Launch the active runtime and report the URL it listens on.
    Start,
    /// Stop the running runtime, giving PostgreSQL time to shut down.
    Stop,
    /// Delete runtimes other than the ones named, and unreferenced blobs.
    Prune { keep: Vec<String> },
    /// Delete one installed version, even the active one.
    Remove { version: String },
    /// Report where runtimes, data and logs are stored, so the shell can
    /// show the user their log without hardcoding the layout.
    Paths,
    /// Record that the active runtime migrated the database.
    RecordMigration { schema_version: u32 },
    /// Exit the manager.
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    #[serde(default)]
    pub id: Option<u64>,
    #[serde(flatten)]
    pub command: Command,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub id: Option<u64>,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Response {
    pub fn ok(id: Option<u64>, result: serde_json::Value) -> Self {
        Self {
            id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    pub fn err(id: Option<u64>, error: impl std::fmt::Display) -> Self {
        Self {
            id,
            ok: false,
            result: None,
            error: Some(error.to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    Progress {
        phase: String,
        done: u64,
        total: u64,
        #[serde(skip_serializing_if = "Option::is_none")]
        bytes: Option<u64>,
    },
    /// Something the user should know that is not a failure, e.g. the
    /// install will succeed but leaves the disk nearly full.
    Warning {
        message: String,
    },
    Ready {
        version: String,
        root: String,
        entry: String,
    },
    Listening {
        url: String,
        port: u16,
    },
    Log {
        stream: String,
        line: String,
    },
    /// The runtime exited. `reverted_to` is set when repeated early crashes
    /// caused the manager to fall back to the last good version.
    Exited {
        code: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        reverted_to: Option<String>,
    },
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

pub fn encode<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value)
        .unwrap_or_else(|e| format!(r#"{{"ok":false,"error":"Failed to encode response: {e}"}}"#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_command_with_an_id_round_trips() {
        let request = parse_line(r#"{"id":1,"cmd":"ensure","channel":"stable"}"#)
            .unwrap()
            .unwrap();
        assert_eq!(request.id, Some(1));
        match request.command {
            Command::Ensure {
                channel,
                version,
                activate,
            } => {
                assert_eq!(channel.as_deref(), Some("stable"));
                assert_eq!(version, None);
                // An older shell omits the field entirely. It must default
                // to not activating, so a download can never swap the
                // runtime out from under a running presentation.
                assert!(!activate);
            }
            other => panic!("unexpected command: {other:?}"),
        }
    }

    #[test]
    fn an_id_is_optional() {
        let request = parse_line(r#"{"cmd":"status"}"#).unwrap().unwrap();
        assert_eq!(request.id, None);
        assert!(matches!(request.command, Command::Status));
    }

    #[test]
    fn blank_lines_are_ignored_rather_than_failing() {
        assert!(parse_line("").is_none());
        assert!(parse_line("   \n").is_none());
    }

    #[test]
    fn an_unknown_command_is_a_parse_error_not_a_panic() {
        assert!(parse_line(r#"{"cmd":"rm_rf"}"#).unwrap().is_err());
    }

    #[test]
    fn responses_carry_the_request_id_back() {
        let ok = Response::ok(Some(7), serde_json::json!({"port": 53411}));
        let encoded = encode(&ok);
        assert!(encoded.contains(r#""id":7"#));
        assert!(encoded.contains(r#""ok":true"#));

        let err = Response::err(Some(7), "boom");
        let encoded = encode(&err);
        assert!(encoded.contains(r#""ok":false"#));
        assert!(encoded.contains("boom"));
    }

    #[test]
    fn events_are_tagged_and_carry_no_id() {
        let event = Event::Listening {
            url: "http://localhost:53411".into(),
            port: 53411,
        };
        let encoded = encode(&event);
        assert!(encoded.contains(r#""event":"listening""#));
        assert!(!encoded.contains(r#""id""#));
    }

    #[test]
    fn a_response_is_a_single_line() {
        let encoded = encode(&Response::err(None, "a\nmultiline\nerror"));
        assert_eq!(
            encoded.lines().count(),
            1,
            "a newline in a payload would corrupt the line-delimited stream"
        );
    }
}
