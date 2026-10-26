use std::path::Path;
use std::time::{Duration, Instant};

/// Fast shutdown first, so PostgreSQL closes its files. Immediate shutdown
/// only if that hangs; it recovers from that on the next start.
const FAST_SHUTDOWN_GRACE: Duration = Duration::from_secs(15);
const IMMEDIATE_SHUTDOWN_GRACE: Duration = Duration::from_secs(5);

/// Stop a PostgreSQL still running on `pgdata`. Returns whether one was found.
///
/// Only call this once no live runtime owns the directory: it does not ask
/// whose PostgreSQL it is, only whether it is one.
pub fn stop_orphan(pgdata: &Path) -> bool {
    let Some(pid) = orphan_pid(pgdata) else {
        return false;
    };

    tracing::warn!(
        pid,
        "Stopping a PostgreSQL left running by a previous runtime"
    );
    signal(pid, Shutdown::Fast);
    if wait_for_exit(pid, FAST_SHUTDOWN_GRACE) {
        return true;
    }

    tracing::warn!(pid, "PostgreSQL ignored a fast shutdown; forcing it");
    signal(pid, Shutdown::Immediate);
    if !wait_for_exit(pid, IMMEDIATE_SHUTDOWN_GRACE) {
        tracing::warn!(pid, "PostgreSQL is still running; the next start may fail");
    }
    true
}

/// The pid in `postmaster.pid`, if it is a live PostgreSQL serving `pgdata`.
///
/// A pid file outlives its process, and the OS recycles pids, so a live pid
/// alone proves nothing. Both the process name and the data directory the
/// file names have to match before anything is signalled.
fn orphan_pid(pgdata: &Path) -> Option<u32> {
    let contents = std::fs::read_to_string(pgdata.join("postmaster.pid")).ok()?;
    let mut lines = contents.lines();
    let pid: u32 = lines.next()?.trim().parse().ok()?;
    let data_dir = lines.next()?.trim();

    if !same_dir(Path::new(data_dir), pgdata) {
        return None;
    }
    if !crate::storage::lock::process_alive(pid) {
        // A dead pid's stale file is fine: PostgreSQL clears it itself.
        return None;
    }
    if !process_name(pid).is_some_and(|name| name.to_lowercase().contains("postgres")) {
        tracing::warn!(
            pid,
            "postmaster.pid names a live process that is not PostgreSQL; leaving it"
        );
        return None;
    }
    Some(pid)
}

fn same_dir(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

fn wait_for_exit(pid: u32, grace: Duration) -> bool {
    let deadline = Instant::now() + grace;
    while Instant::now() < deadline {
        if !crate::storage::lock::process_alive(pid) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    !crate::storage::lock::process_alive(pid)
}

enum Shutdown {
    Fast,
    Immediate,
}

#[cfg(unix)]
fn signal(pid: u32, how: Shutdown) {
    // SIGINT and SIGQUIT are PostgreSQL's fast and immediate shutdowns.
    let sig = match how {
        Shutdown::Fast => libc::SIGINT,
        Shutdown::Immediate => libc::SIGQUIT,
    };
    // Safety: a signal to a pid verified above to be our PostgreSQL.
    unsafe {
        libc::kill(pid as libc::pid_t, sig);
    }
}

#[cfg(windows)]
fn signal(pid: u32, how: Shutdown) {
    // Windows has no signals to ask nicely with. `/T` takes the backends too,
    // which would otherwise keep the shared memory alive.
    let mut args = vec!["/PID".to_string(), pid.to_string(), "/T".to_string()];
    if matches!(how, Shutdown::Immediate) {
        args.push("/F".to_string());
    }
    let _ = std::process::Command::new("taskkill").args(&args).output();
}

#[cfg(unix)]
fn process_name(pid: u32) -> Option<String> {
    let out = std::process::Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "comm="])
        .output()
        .ok()?;
    let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!name.is_empty()).then_some(name)
}

#[cfg(windows)]
fn process_name(pid: u32) -> Option<String> {
    let out = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
        .output()
        .ok()?;
    // "postgres.exe","1234","Console","1","5,678 K"
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .find_map(|line| {
            line.split("\",\"")
                .next()
                .map(|n| n.trim_matches('"').to_string())
        })
        .filter(|name| !name.is_empty())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::{Child, Command};

    /// A long-running process with a chosen name: a shell blocked reading
    /// its stdin, which stays open for as long as the `Child` lives.
    fn named_process(dir: &Path, name: &str) -> Child {
        // A link rather than a copy: exec'ing a freshly written binary
        // races other test threads forking ("Text file busy"). Not `sleep`:
        // multi-call coreutils (uutils on Ubuntu 26.04) refuse to run under
        // a name that isn't theirs.
        let bin = dir.join(name);
        std::os::unix::fs::symlink("/bin/sh", &bin).unwrap();
        Command::new(bin)
            .args(["-c", "read _"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .unwrap()
    }

    fn write_pid_file(pgdata: &Path, pid: u32, data_dir: &Path) {
        std::fs::create_dir_all(pgdata).unwrap();
        std::fs::write(
            pgdata.join("postmaster.pid"),
            format!("{pid}\n{}\n1700000000\n7949\n", data_dir.display()),
        )
        .unwrap();
    }

    #[test]
    fn an_orphaned_postgres_is_stopped() {
        let tmp = tempfile::tempdir().unwrap();
        let pgdata = tmp.path().join("db");
        let mut orphan = named_process(tmp.path(), "postgres");
        write_pid_file(&pgdata, orphan.id(), &pgdata);

        // Reaped as it exits, the way init reaps a real orphan. Left
        // unreaped it would linger as a zombie, which still answers
        // `kill(pid, 0)`, and the stop would sit out both grace periods.
        // `wait` closes stdin first, which would end it before the stop.
        let _stdin = orphan.stdin.take();
        let reaper = std::thread::spawn(move || orphan.wait());

        let started = Instant::now();
        assert!(stop_orphan(&pgdata));
        assert!(
            started.elapsed() < FAST_SHUTDOWN_GRACE,
            "a fast shutdown should have been enough"
        );
        assert!(reaper.join().unwrap().is_ok());
    }

    #[test]
    fn a_recycled_pid_that_is_not_postgres_is_left_alone() {
        let tmp = tempfile::tempdir().unwrap();
        let pgdata = tmp.path().join("db");
        let mut bystander = named_process(tmp.path(), "editor");
        write_pid_file(&pgdata, bystander.id(), &pgdata);

        assert!(!stop_orphan(&pgdata));
        assert!(
            bystander.try_wait().unwrap().is_none(),
            "must not be signalled"
        );
        bystander.kill().unwrap();
    }

    #[test]
    fn a_postgres_serving_another_directory_is_left_alone() {
        // A system PostgreSQL that happens to have the pid in a stale file.
        let tmp = tempfile::tempdir().unwrap();
        let pgdata = tmp.path().join("db");
        let elsewhere = tmp.path().join("system-db");
        std::fs::create_dir_all(&elsewhere).unwrap();
        let mut system = named_process(tmp.path(), "postgres");
        write_pid_file(&pgdata, system.id(), &elsewhere);

        assert!(!stop_orphan(&pgdata));
        assert!(
            system.try_wait().unwrap().is_none(),
            "must not be signalled"
        );
        system.kill().unwrap();
    }

    #[test]
    fn a_stale_pid_file_or_none_is_nothing_to_do() {
        let tmp = tempfile::tempdir().unwrap();
        let pgdata = tmp.path().join("db");
        assert!(!stop_orphan(&pgdata));

        let mut gone = named_process(tmp.path(), "postgres");
        let pid = gone.id();
        gone.kill().unwrap();
        gone.wait().unwrap();
        write_pid_file(&pgdata, pid, &pgdata);
        assert!(!stop_orphan(&pgdata));
    }
}
