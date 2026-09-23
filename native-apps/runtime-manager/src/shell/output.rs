//! Turning events into output.
//! For both JSON output and human readable

use std::io::Write;

use crate::runtime::install::Progress;
use crate::shell::protocol::Event;

pub static HUMAN_PROGRESS: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

pub fn human_progress() -> bool {
    HUMAN_PROGRESS.load(std::sync::atomic::Ordering::Relaxed)
}

pub fn emit(event: &Event) {
    if human_progress() {
        render_human(event);
        return;
    }
    let mut stdout = std::io::stdout().lock();
    let _ = writeln!(stdout, "{}", crate::shell::protocol::encode(event));
    let _ = stdout.flush();
}

/// One rewritten line on stderr, so a slow install looks alive.
pub fn render_human(event: &Event) {
    let mut err = std::io::stderr().lock();
    let line = match event {
        Event::Progress {
            phase, done, total, ..
        } if phase == "download" => {
            format!("Downloading… {done}/{total} files")
        }
        Event::Progress {
            phase, done, total, ..
        } if phase == "assemble" => {
            let percent = if *total > 0 { done * 100 / total } else { 0 };
            format!("Installing… {percent}%")
        }
        Event::Progress { phase, .. } if phase.starts_with("resolved:") => {
            format!("Found {}", phase.trim_start_matches("resolved:"))
        }
        _ => return,
    };
    // \r rather than \n: one line that updates, not a wall of them.
    let _ = write!(err, "\r\x1b[K{line}");
    let _ = err.flush();
}

/// Clear the progress line before printing a result.
pub fn finish_human_progress() {
    if human_progress() {
        let _ = write!(std::io::stderr(), "\r\x1b[K");
        let _ = std::io::stderr().flush();
    }
}

pub fn emit_progress(progress: Progress) {
    let event = match progress {
        Progress::Resolved { version } => Event::Progress {
            phase: format!("resolved:{version}"),
            done: 0,
            total: 0,
            bytes: None,
        },
        Progress::Download { done, total, bytes } => Event::Progress {
            phase: "download".into(),
            done,
            total,
            bytes: Some(bytes),
        },
        Progress::Assemble { done, total } => Event::Progress {
            phase: "assemble".into(),
            done,
            total,
            bytes: None,
        },
        Progress::Activated { version } => Event::Progress {
            phase: format!("activated:{version}"),
            done: 1,
            total: 1,
            bytes: None,
        },
    };
    emit(&event);
}
