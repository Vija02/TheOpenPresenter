//! Command line surface.
//!
//! The manager has two users
//!
//! A shell (Electron or Tauri) speaking newline-delimited JSON on stdin and stdout
//! Use through `serve`
//!
//! A CLI usage as normal CLI application

use std::path::PathBuf;

/// What the user asked us to do.
#[derive(Debug, PartialEq, Eq)]
pub enum Cli {
    /// Speak NDJSON on stdin/stdout for a shell to drive.
    Serve,
    /// Print the on-disk state as text.
    Status,
    /// Resolve a channel to a version without downloading.
    Check { channel: String },
    /// Download a version without switching to it.
    Install {
        channel: Option<String>,
        version: Option<String>,
        /// Switch to it once downloaded.
        activate: bool,
    },
    /// Switch to an already-installed version.
    Activate { version: Option<String> },
    /// Start the server and stay in the foreground until interrupted.
    Start,
    /// Delete an installed version, including the active one.
    Remove {
        version: Option<String>,
        /// Skip the confirmation prompt.
        force: bool,
    },
    /// Delete every runtime except the active one, then unreferenced blobs.
    Prune,
    /// Print where everything lives.
    Paths,
    /// Print usage.
    Help,
    /// Print the version.
    Version,
}

#[derive(Debug, Default)]
pub struct Options {
    pub root: Option<PathBuf>,
    pub source: Option<String>,
    /// Emit machine-readable JSON from the one-shot subcommands too.
    pub json: bool,
    /// Activate immediately after installing.
    pub activate: bool,
    /// Skip confirmation prompts.
    pub force: bool,
}

pub struct Parsed {
    pub cli: Cli,
    pub options: Options,
}

/// Parse arguments. `interactive` is whether stdin is a terminal, which
/// decides what a bare invocation means.
pub fn parse<I>(args: I, interactive: bool) -> Parsed
where
    I: IntoIterator<Item = String>,
{
    let args: Vec<String> = args.into_iter().collect();
    let mut options = Options::default();
    let mut positional: Vec<String> = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        let take_value = |inline: Option<&str>, index: &mut usize| -> Option<String> {
            if let Some(value) = inline {
                return Some(value.to_string());
            }
            *index += 1;
            args.get(*index).cloned()
        };

        match arg.split_once('=') {
            Some(("--root", value)) => options.root = Some(PathBuf::from(value)),
            Some(("--source", value)) => options.source = Some(value.to_string()),
            _ if arg == "--root" => options.root = take_value(None, &mut index).map(PathBuf::from),
            _ if arg == "--source" => options.source = take_value(None, &mut index),
            _ if arg == "--json" => options.json = true,
            _ if arg == "--activate" => options.activate = true,
            _ if arg == "--force" || arg == "-f" => options.force = true,
            _ => positional.push(arg.clone()),
        }
        index += 1;
    }

    let cli = match positional.first().map(String::as_str) {
        Some("serve") => Cli::Serve,
        Some("status") => Cli::Status,
        Some("check") => Cli::Check {
            channel: positional
                .get(1)
                .cloned()
                .unwrap_or_else(|| "stable".to_string()),
        },
        Some("install") => {
            // `install 1.2.3` pins a version; `install stable` follows a
            // channel. Anything that parses as a version is treated as one,
            // because pinning is the case where being wrong is expensive.
            let argument = positional.get(1).cloned();
            match argument {
                Some(value) if looks_like_version(&value) => Cli::Install {
                    channel: None,
                    version: Some(value),
                    activate: options.activate,
                },
                Some(value) => Cli::Install {
                    channel: Some(value),
                    version: None,
                    activate: options.activate,
                },
                None => Cli::Install {
                    channel: Some("stable".to_string()),
                    version: None,
                    activate: options.activate,
                },
            }
        }
        Some("activate") => Cli::Activate {
            version: positional.get(1).cloned(),
        },
        Some("start") => Cli::Start,
        Some("remove" | "uninstall" | "rm") => Cli::Remove {
            version: positional.get(1).cloned(),
            force: options.force,
        },
        Some("prune") => Cli::Prune,
        Some("paths") => Cli::Paths,
        Some("--version" | "-V" | "version") => Cli::Version,
        Some("--help" | "-h" | "help") => Cli::Help,
        // A shell pipes us commands and passes no subcommand, so a
        // non-terminal stdin means "serve". A terminal means a person, and
        // a person who typed nothing wants to know what this is.
        None if !interactive => Cli::Serve,
        None => Cli::Help,
        Some(_) => Cli::Help,
    };

    Parsed { cli, options }
}

/// Whether a string looks like a version rather than a channel name.
fn looks_like_version(value: &str) -> bool {
    value
        .chars()
        .next()
        .map(|c| c.is_ascii_digit())
        .unwrap_or(false)
}

pub const USAGE: &str = "\
TheOpenPresenter runtime manager

Downloads, verifies and runs the server runtime. Embedded in the desktop
app as a sidecar; usable directly for inspection and recovery.

USAGE:
    top-runtime-manager [SUBCOMMAND] [OPTIONS]

SUBCOMMANDS:
    serve              Speak newline-delimited JSON on stdin/stdout.
    status             Show installed versions and what is active.
    check [CHANNEL]    Report the newest version on a channel.
    install [TARGET]   Download without switching to it. TARGET is a
                       channel name (stable) or a version (1.9.0).
                       Defaults to stable. Add --activate to switch
                       immediately.
    activate [VERSION] Switch to an installed version. Defaults to the
                       most recently downloaded one. Takes effect when
                       the server next starts.
    start              Run the server in the foreground until Ctrl-C.
    remove [VERSION]   Delete an installed version, including the active
                       one. Defaults to the active version. Asks first
                       unless --force. Never touches your data.
    prune              Delete inactive runtimes and unreferenced data.
    paths              Show where runtimes, data and logs are stored.

OPTIONS:
    --root <DIR>       Where runtimes and data live.
                       [env: TOP_RUNTIME_ROOT]
    --source <URL>     Where releases are downloaded from. Accepts a
                       directory path for local testing.
                       [env: TOP_RUNTIME_SOURCE]
    --json             Machine-readable output.
    -f, --force        Do not ask for confirmation.
    -h, --help         Print this help.
    -V, --version      Print the version.

ENVIRONMENT:
    TOP_RUNTIME_PUBKEY  Override the signing key releases are verified
                        against. The release key is compiled in; this is
                        for testing against a locally published runtime.
    TOP_RUNTIME_LOG     Log filter, e.g. debug. [default: info]
";

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_args(args: &[&str], interactive: bool) -> Parsed {
        parse(args.iter().map(|s| s.to_string()), interactive)
    }

    #[test]
    fn a_bare_invocation_on_a_terminal_prints_help() {
        // The bug this pins: every invocation used to start the daemon, so
        // `top-runtime-manager --help` printed a log line and then hung
        // waiting on stdin with no indication it wanted input.
        assert_eq!(parse_args(&[], true).cli, Cli::Help);
        assert_eq!(parse_args(&["--help"], true).cli, Cli::Help);
        assert_eq!(parse_args(&["-h"], false).cli, Cli::Help);
    }

    #[test]
    fn a_bare_invocation_from_a_pipe_serves() {
        // The desktop shell spawns us with piped stdio and sends commands
        // without a subcommand. That must keep working.
        assert_eq!(parse_args(&[], false).cli, Cli::Serve);
    }

    #[test]
    fn an_unknown_subcommand_does_not_silently_become_a_daemon() {
        assert_eq!(parse_args(&["instal"], false).cli, Cli::Help);
    }

    #[test]
    fn options_parse_both_spellings() {
        let parsed = parse_args(&["status", "--root", "/data"], true);
        assert_eq!(parsed.options.root, Some(PathBuf::from("/data")));

        let parsed = parse_args(&["status", "--root=/data"], true);
        assert_eq!(parsed.options.root, Some(PathBuf::from("/data")));

        let parsed = parse_args(&["serve", "--source=/tmp/cdn", "--json"], true);
        assert_eq!(parsed.options.source.as_deref(), Some("/tmp/cdn"));
        assert!(parsed.options.json);
    }

    #[test]
    fn install_tells_a_version_from_a_channel() {
        // Getting this backwards would install the newest stable when the
        // user asked for a specific version, which is the expensive
        // direction to be wrong in.
        assert_eq!(
            parse_args(&["install", "1.9.0"], true).cli,
            Cli::Install {
                channel: None,
                version: Some("1.9.0".to_string()),
                activate: false
            }
        );
        assert_eq!(
            parse_args(&["install", "beta"], true).cli,
            Cli::Install {
                channel: Some("beta".to_string()),
                version: None,
                activate: false
            }
        );
        assert_eq!(
            parse_args(&["install"], true).cli,
            Cli::Install {
                channel: Some("stable".to_string()),
                version: None,
                activate: false
            }
        );
    }

    #[test]
    fn installing_does_not_activate_unless_asked() {
        // Downloading an update must not swap the runtime under a machine
        // that is mid-presentation. Activation is a separate decision.
        let Cli::Install { activate, .. } = parse_args(&["install"], true).cli else {
            panic!("expected an install");
        };
        assert!(!activate, "install must not activate by default");

        let Cli::Install { activate, .. } = parse_args(&["install", "--activate"], true).cli else {
            panic!("expected an install");
        };
        assert!(activate);
    }

    #[test]
    fn activate_takes_an_optional_version() {
        assert_eq!(
            parse_args(&["activate"], true).cli,
            Cli::Activate { version: None }
        );
        assert_eq!(
            parse_args(&["activate", "1.9.0"], true).cli,
            Cli::Activate {
                version: Some("1.9.0".to_string())
            }
        );
    }

    #[test]
    fn remove_defaults_to_the_active_version_and_asks_first() {
        // Deleting what is in use should need a deliberate yes, but
        // naming no version is the common case: "this one is broken".
        assert_eq!(
            parse_args(&["remove"], true).cli,
            Cli::Remove {
                version: None,
                force: false
            }
        );
        assert_eq!(
            parse_args(&["remove", "1.9.0", "--force"], true).cli,
            Cli::Remove {
                version: Some("1.9.0".to_string()),
                force: true
            }
        );
        // The names people actually reach for.
        for alias in ["rm", "uninstall"] {
            assert!(matches!(
                parse_args(&[alias, "1.9.0"], true).cli,
                Cli::Remove { .. }
            ));
        }
    }

    #[test]
    fn check_defaults_to_stable() {
        assert_eq!(
            parse_args(&["check"], true).cli,
            Cli::Check {
                channel: "stable".to_string()
            }
        );
    }
}
