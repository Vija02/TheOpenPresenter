use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

/// One process's claim on a running runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Holder {
    pub pid: u32,
    pub name: String,
}

/// Who currently owns a runtime root.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeLock {
    /// The manager process that spawned the runtime and owns its pipes.
    pub manager_pid: u32,
    /// The runtime process it supervises, when one is up.
    #[serde(default)]
    pub runtime_pid: Option<u32>,
    #[serde(default)]
    pub http_port: Option<u16>,
    #[serde(default)]
    pub version: Option<String>,
    /// Everyone currently wanting it up, across processes.
    #[serde(default)]
    pub holders: Vec<Holder>,
    /// The iroh ticket, when remote access is on.
    #[serde(default)]
    pub remote: Option<RemoteInfo>,
}

/// Remote access details, shared across processes via the lock file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RemoteInfo {
    pub ticket: String,
    pub node_id: String,
    pub owner_pid: u32,
}

pub fn lock_path(root: &Path) -> PathBuf {
    root.join("runtime.lock")
}

/// Whether a process is still around.
///
/// Signal 0 performs the permission and existence checks without actually
/// delivering anything, which is the standard way to ask.
#[cfg(unix)]
pub fn process_alive(pid: u32) -> bool {
    // Safety: kill with signal 0 has no effect beyond the liveness check.
    unsafe { libc::kill(pid as libc::pid_t, 0) == 0 }
}

#[cfg(windows)]
pub fn process_alive(pid: u32) -> bool {
    use std::process::Command;
    // No portable signal-0 equivalent, so ask the task list. A process that
    // cannot be queried is treated as gone, which errs toward starting a
    // new runtime rather than refusing forever.
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}

/// Read the lock, if one is present and still describes a live runtime.
/// Record that remote access is on, so other processes can see it.
pub fn set_remote(root: &Path, info: Option<RemoteInfo>) {
    let Some(mut lock) = read(root) else {
        return;
    };
    lock.remote = info;
    let _ = write(root, &lock);
}

/// Remote access details, if a live process is running a tunnel.
pub fn remote(root: &Path) -> Option<RemoteInfo> {
    read(root).and_then(|lock| lock.remote)
}

pub fn read(root: &Path) -> Option<RuntimeLock> {
    let path = lock_path(root);
    let text = fs::read_to_string(&path).ok()?;
    let mut lock: RuntimeLock = serde_json::from_str(&text).ok()?;

    let runtime_alive = lock.runtime_pid.map(process_alive).unwrap_or(false);
    if !runtime_alive && !process_alive(lock.manager_pid) {
        let _ = fs::remove_file(&path);
        return None;
    }

    let before = lock.holders.len();
    lock.holders.retain(|h| process_alive(h.pid));

    // A tunnel belongs to the process that opened it. If that manager is
    // gone the tunnel went with it, so drop the entry rather than hand out
    // a ticket that no longer resolves to anything.
    let remote_before = lock.remote.is_some();
    if let Some(remote) = &lock.remote {
        if !process_alive(remote.owner_pid) {
            lock.remote = None;
        }
    }

    if lock.holders.len() != before || remote_before != lock.remote.is_some() {
        let _ = write(root, &lock);
    }

    Some(lock)
}

/// Claim this root for the current process.
pub fn write(root: &Path, lock: &RuntimeLock) -> Result<()> {
    let path = lock_path(root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, serde_json::to_string_pretty(lock)?)
        .with_context(|| format!("Failed to write {}", path.display()))
}

/// Drop this process's claim.
pub fn release(root: &Path) -> bool {
    let Some(mut lock) = read(root) else {
        return true;
    };

    let me = std::process::id();
    lock.holders.retain(|h| h.pid != me);

    if lock.holders.is_empty() {
        let _ = fs::remove_file(lock_path(root));
        return true;
    }

    let _ = write(root, &lock);
    false
}

/// Add this process to the holder list, keeping the rest.
pub fn hold(root: &Path, name: &str, runtime: &RuntimeLock) -> Result<()> {
    let mut lock = read(root).unwrap_or_else(|| runtime.clone());
    lock.manager_pid = runtime.manager_pid;
    lock.runtime_pid = runtime.runtime_pid;
    lock.http_port = runtime.http_port;
    lock.version = runtime.version.clone();

    let me = std::process::id();
    if !lock.holders.iter().any(|h| h.pid == me && h.name == name) {
        lock.holders.push(Holder {
            pid: me,
            name: name.to_string(),
        });
    }
    write(root, &lock)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lock_for(pid: u32) -> RuntimeLock {
        RuntimeLock {
            manager_pid: pid,
            runtime_pid: Some(pid),
            http_port: Some(41234),
            version: Some("1.0.0".into()),
            holders: vec![Holder {
                pid,
                name: "test".into(),
            }],
            remote: None,
        }
    }

    #[test]
    fn the_current_process_is_alive() {
        assert!(process_alive(std::process::id()));
    }

    #[test]
    fn a_lock_naming_a_live_process_is_returned() {
        let root = tempfile::tempdir().unwrap();
        write(root.path(), &lock_for(std::process::id())).unwrap();

        let found = read(root.path()).expect("a live lock should be readable");
        assert_eq!(found.manager_pid, std::process::id());
        assert_eq!(found.http_port, Some(41234));
    }

    /// A manager that died must not make its root permanently unusable.
    /// Without this, one crash means the app never starts again.
    #[test]
    fn a_lock_naming_a_dead_process_is_cleared() {
        let root = tempfile::tempdir().unwrap();

        // Spawn something and wait for it, so the pid is genuinely gone
        // rather than a number guessed to be free.
        let mut child = std::process::Command::new(if cfg!(windows) { "cmd" } else { "true" })
            .args(if cfg!(windows) {
                vec!["/C", "exit"]
            } else {
                vec![]
            })
            .spawn()
            .expect("failed to spawn a short-lived process");
        let dead_pid = child.id();
        child.wait().unwrap();

        write(root.path(), &lock_for(dead_pid)).unwrap();
        assert!(lock_path(root.path()).exists());

        assert!(
            read(root.path()).is_none(),
            "a lock held by a dead process must not count"
        );
        assert!(
            !lock_path(root.path()).exists(),
            "the stale lock should have been removed"
        );
    }

    #[test]
    fn release_only_removes_our_own_lock() {
        let root = tempfile::tempdir().unwrap();

        // A live process that is not us: sleep long enough to still be
        // running for the duration of the check. Using a made-up pid would
        // test the stale path instead of the ownership one.
        let mut other = std::process::Command::new(if cfg!(windows) { "timeout" } else { "sleep" })
            .arg("3")
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("failed to spawn a helper process");

        write(root.path(), &lock_for(other.id())).unwrap();
        release(root.path());
        assert!(
            lock_path(root.path()).exists(),
            "another process's lock must survive our release"
        );

        let _ = other.kill();
        let _ = other.wait();

        write(root.path(), &lock_for(std::process::id())).unwrap();
        release(root.path());
        assert!(!lock_path(root.path()).exists());
    }

    #[test]
    fn a_missing_lock_reads_as_unowned() {
        let root = tempfile::tempdir().unwrap();
        assert!(read(root.path()).is_none());
    }

    /// A truncated or hand-edited file must not be fatal.
    #[test]
    fn a_corrupt_lock_reads_as_unowned() {
        let root = tempfile::tempdir().unwrap();
        fs::write(lock_path(root.path()), "{not json").unwrap();
        assert!(read(root.path()).is_none());
    }

    /// Remote access is per-runtime, not per-process: a second app sharing a
    /// running server must see the tunnel the first one opened.
    #[test]
    fn remote_details_are_shared_through_the_lock() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        let lock = RuntimeLock {
            manager_pid: std::process::id(),
            runtime_pid: Some(std::process::id()),
            http_port: Some(1234),
            version: Some("1.0.0".into()),
            holders: vec![],
            remote: None,
        };
        hold(root, "first", &lock).unwrap();

        set_remote(
            root,
            Some(RemoteInfo {
                ticket: "endpointabc".into(),
                node_id: "node123".into(),
                owner_pid: std::process::id(),
            }),
        );

        let seen = remote(root).expect("another process should see the tunnel");
        assert_eq!(seen.ticket, "endpointabc");
        assert_eq!(seen.node_id, "node123");
    }

    /// A tunnel dies with the process that opened it, so an entry whose owner
    /// is gone must not be handed out as a live ticket.
    #[test]
    fn a_tunnel_whose_owner_died_is_pruned() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        // A real process that will be gone by the time we read.
        let mut child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .unwrap();
        let dead_pid = child.id();

        let lock = RuntimeLock {
            manager_pid: std::process::id(),
            runtime_pid: Some(std::process::id()),
            http_port: Some(1234),
            version: Some("1.0.0".into()),
            holders: vec![],
            remote: None,
        };
        hold(root, "holder", &lock).unwrap();
        set_remote(
            root,
            Some(RemoteInfo {
                ticket: "endpointstale".into(),
                node_id: "nodestale".into(),
                owner_pid: dead_pid,
            }),
        );
        assert!(remote(root).is_some(), "should be visible while alive");

        child.kill().unwrap();
        child.wait().unwrap();

        assert!(
            remote(root).is_none(),
            "a ticket from a dead process must not be handed out"
        );
    }
}
