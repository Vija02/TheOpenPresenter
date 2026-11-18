//! This install's iroh identity. The helper connects with it, and the server
//! learns its id so it can tell this computer from joined ones.

use std::io::Write;
use std::path::Path;

use anyhow::{Context, Result};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

const SECRET_KEY_FILE: &str = "iroh_secret_key";

/// The 32-byte secret key, created on first use.
pub fn secret_key_bytes(state_dir: &Path) -> Result<[u8; 32]> {
    let key_path = state_dir.join(SECRET_KEY_FILE);
    if let Some(bytes) = read_key(&key_path)? {
        return Ok(bytes);
    }

    std::fs::create_dir_all(state_dir).context("Failed to create the data directory")?;
    let bytes = SigningKey::generate(&mut OsRng).to_bytes();

    // Written whole to a temp file, then linked in: another process never
    // sees a half-written key, and whoever links first wins.
    let mut temp = tempfile::NamedTempFile::new_in(state_dir)
        .context("Failed to write the iroh secret key")?;
    temp.write_all(&bytes)
        .and_then(|_| temp.as_file().sync_all())
        .context("Failed to write the iroh secret key")?;
    // Anyone with the key can impersonate this install.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(temp.path(), std::fs::Permissions::from_mode(0o600));
    }
    match std::fs::hard_link(temp.path(), &key_path) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
            return read_key(&key_path)?.context("The iroh secret key is empty");
        }
        Err(err) => return Err(err).context("Failed to write the iroh secret key"),
    }

    Ok(bytes)
}

fn read_key(key_path: &Path) -> Result<Option<[u8; 32]>> {
    match std::fs::read(key_path) {
        Ok(bytes) => bytes
            .try_into()
            .map(Some)
            .map_err(|_| anyhow::anyhow!("The iroh secret key is the wrong length")),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err).context("Failed to read the iroh secret key"),
    }
}

/// The endpoint id iroh shows for this install: its public key, in lowercase hex.
pub fn node_id(state_dir: &Path) -> Result<String> {
    let secret = secret_key_bytes(state_dir)?;
    Ok(hex::encode(
        SigningKey::from_bytes(&secret).verifying_key().to_bytes(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_the_key_once_and_keeps_the_id() {
        let dir = tempfile::tempdir().unwrap();
        let first = node_id(dir.path()).unwrap();
        assert_eq!(first.len(), 64);
        assert_eq!(node_id(dir.path()).unwrap(), first);
        assert_eq!(
            std::fs::read(dir.path().join(SECRET_KEY_FILE))
                .unwrap()
                .len(),
            32
        );
    }

    #[test]
    fn processes_starting_together_get_one_key() {
        let dir = tempfile::tempdir().unwrap();
        let ids: Vec<String> = std::thread::scope(|scope| {
            let handles: Vec<_> = (0..8)
                .map(|_| scope.spawn(|| node_id(dir.path()).unwrap()))
                .collect();
            handles.into_iter().map(|h| h.join().unwrap()).collect()
        });
        assert!(ids.iter().all(|id| id == &ids[0]));
        let leftovers = std::fs::read_dir(dir.path()).unwrap().count();
        assert_eq!(leftovers, 1);
    }

    #[test]
    fn rejects_a_key_of_the_wrong_length() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(SECRET_KEY_FILE), b"short").unwrap();
        assert!(node_id(dir.path()).is_err());
    }
}
