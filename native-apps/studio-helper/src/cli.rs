//! Command line: the desktop shell (`serve`) or a person at a terminal.

use std::path::PathBuf;

#[derive(Debug, PartialEq, Eq)]
pub enum Cli {
    Serve,
    RemoteStart,
    RemoteStatus,
    RemoteConnect(String),
    /// The grab stays with the device, which the app keeps open.
    GrabInput,
    Help,
    Version,
}

#[derive(Debug, Default)]
pub struct Options {
    pub root: Option<PathBuf>,
    pub port: Option<u16>,
    pub json: bool,
}

#[derive(Debug)]
pub struct Parsed {
    pub cli: Cli,
    pub options: Options,
}

/// `interactive` (stdin is a terminal) decides what a bare invocation means.
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
        let mut next = || {
            index += 1;
            args.get(index).cloned()
        };
        match arg.split_once('=') {
            Some(("--root", value)) => options.root = Some(PathBuf::from(value)),
            Some(("--port", value)) => options.port = value.parse().ok(),
            _ if arg == "--root" => options.root = next().map(PathBuf::from),
            _ if arg == "--port" => options.port = next().and_then(|v| v.parse().ok()),
            _ if arg == "--json" => options.json = true,
            _ => positional.push(arg.clone()),
        }
        index += 1;
    }

    let cli = match positional.first().map(String::as_str) {
        Some("serve") => Cli::Serve,
        Some("grab-input") => Cli::GrabInput,
        Some("remote") => match positional.get(1).map(String::as_str) {
            Some("start") | Some("on") => Cli::RemoteStart,
            Some("connect") | Some("join") => match positional.get(2) {
                Some(peer) => Cli::RemoteConnect(peer.clone()),
                None => Cli::Help,
            },
            // A typo must never start a tunnel.
            _ => Cli::RemoteStatus,
        },
        Some("--version" | "-V" | "version") => Cli::Version,
        Some("--help" | "-h" | "help") => Cli::Help,
        None if !interactive => Cli::Serve,
        _ => Cli::Help,
    };

    Parsed { cli, options }
}

pub const USAGE: &str = "\
TheOpenPresenter helper

Native pieces of the desktop app that Electron can't do by itself.
Embedded in the app as a sidecar; usable directly from a terminal.

USAGE:
    top-studio-helper [SUBCOMMAND] [OPTIONS]

SUBCOMMANDS:
    serve              Speak newline-delimited JSON on stdin/stdout.
    remote [start|status]
                       Peer-to-peer access to the running server, for
                       reaching it from outside the building without port
                       forwarding. `start` runs in the foreground, prints a
                       ticket to share, and stops on Ctrl-C. Start the
                       server first with `top-runtime-manager start`.
    remote connect <TICKET|ID>
                       Join another computer's server and serve it here on
                       a local port. Takes a ticket from `remote start` or
                       just its endpoint ID. Stops on Ctrl-C.
    grab-input         Grab the input device on fd 3 (Linux, used by the app).

OPTIONS:
    --root <DIR>       Where runtimes and data live. Must match the runtime
                       manager's. [env: TOP_RUNTIME_ROOT]
    --port <PORT>      With `start`: forward to this local port instead of
                       the runtime's. With `connect`: the local port to
                       serve on, if free.
    --json             Machine-readable output.
    -h, --help         Print this help.
    -V, --version      Print the version.

ENVIRONMENT:
    TOP_STUDIO_HELPER_LOG     Log filter, e.g. debug. [default: info]
";

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_args(args: &[&str], interactive: bool) -> Parsed {
        parse(args.iter().map(|s| s.to_string()), interactive)
    }

    #[test]
    fn a_bare_invocation_serves_from_a_pipe_and_helps_on_a_terminal() {
        assert_eq!(parse_args(&[], false).cli, Cli::Serve);
        assert_eq!(parse_args(&[], true).cli, Cli::Help);
    }

    #[test]
    fn grab_input_is_its_own_subcommand() {
        // Spawned from a pipe by the app; must not fall through to serve.
        assert_eq!(parse_args(&["grab-input"], false).cli, Cli::GrabInput);
    }

    #[test]
    fn remote_defaults_to_status_and_typos_never_start() {
        assert_eq!(parse_args(&["remote"], true).cli, Cli::RemoteStatus);
        assert_eq!(
            parse_args(&["remote", "sttart"], true).cli,
            Cli::RemoteStatus
        );
        assert_eq!(parse_args(&["remote", "start"], true).cli, Cli::RemoteStart);
    }

    #[test]
    fn connect_needs_a_peer() {
        assert_eq!(
            parse_args(&["remote", "connect", "abc", "--port", "4000"], true).cli,
            Cli::RemoteConnect("abc".into())
        );
        assert_eq!(parse_args(&["remote", "connect"], true).cli, Cli::Help);
    }

    #[test]
    fn options_take_inline_and_separate_values() {
        let parsed = parse_args(&["--root", "/r", "--port=4000", "serve"], false);
        assert_eq!(parsed.options.root, Some(PathBuf::from("/r")));
        assert_eq!(parsed.options.port, Some(4000));
        assert_eq!(parsed.cli, Cli::Serve);
    }
}
