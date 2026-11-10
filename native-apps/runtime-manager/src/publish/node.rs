//! A real Node in the runtime, for platforms where Studio's Electron cannot
//! stand in for one.
//!
//! On Linux, Electron loads the system's GLib, and sharp's libvips brings
//! its own. The two clash and the server crashes on its first image. The
//! manager prefers `bin/node` in the runtime over Electron, so shipping one
//! is enough.
//!
//! The official build is used, never the build machine's own `node`: a
//! distribution's Node links against that distribution's libraries and will
//! not start on another one.

use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::Deserialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Deserialize)]
pub struct NodeSection {
    /// e.g. "24.22.2", without the leading v.
    pub version: String,
    /// The official `.tar.gz` for each platform that gets a Node, by its
    /// sha256 from nodejs.org's SHASUMS256.txt.
    pub sha256: BTreeMap<String, String>,
}

const DIST: &str = "https://nodejs.org/dist";

/// Put Node at `into/bin/node` when this platform gets one.
pub fn bundle(
    section: &NodeSection,
    platform: &str,
    into: &Path,
    log: &dyn Fn(&str),
) -> Result<()> {
    let Some(expected) = section.sha256.get(platform) else {
        return Ok(());
    };
    let name = format!("node-v{}-{platform}", section.version);
    let archive = fetch(&format!("{name}.tar.gz"), &section.version, expected)?;

    let bin = into.join("bin");
    std::fs::create_dir_all(&bin)?;
    let wanted = [
        (format!("{name}/bin/node"), bin.join("node")),
        (format!("{name}/LICENSE"), bin.join("node.LICENSE")),
    ];

    let mut found = 0;
    let decoder = flate2::read::GzDecoder::new(std::fs::File::open(&archive)?);
    let mut tar = tar::Archive::new(decoder);
    for entry in tar.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.to_string_lossy().into_owned();
        if let Some((_, to)) = wanted.iter().find(|(from, _)| *from == path) {
            entry.unpack(to)?;
            found += 1;
        }
    }
    if found != wanted.len() {
        bail!("{name}.tar.gz does not contain bin/node and LICENSE");
    }

    log(&format!("  + bin/node (Node {})", section.version));
    Ok(())
}

/// The archive, from a previous run when it is still intact.
fn fetch(file: &str, version: &str, expected: &str) -> Result<PathBuf> {
    let cache = std::env::temp_dir().join("top-runtime-node");
    std::fs::create_dir_all(&cache)?;
    let path = cache.join(file);

    if path.is_file() && sha256_file(&path)? == expected {
        return Ok(path);
    }

    let url = format!("{DIST}/v{version}/{file}");
    let response = ureq::get(&url)
        .call()
        .with_context(|| format!("Could not download {url}"))?;
    let mut bytes = Vec::new();
    response.into_reader().read_to_end(&mut bytes)?;

    let actual = hex::encode(Sha256::digest(&bytes));
    if actual != expected {
        bail!("{url} has sha256 {actual}, but runtime.toml expects {expected}");
    }
    std::fs::write(&path, &bytes)?;
    Ok(path)
}

fn sha256_file(path: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    std::io::copy(&mut std::fs::File::open(path)?, &mut hasher)?;
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::publish::build::BuildConfig;

    #[test]
    fn platforms_without_a_node_are_left_alone() {
        let into = tempfile::tempdir().unwrap();
        let section = NodeSection {
            version: "24.0.0".into(),
            sha256: BTreeMap::from([("linux-x64".into(), "abc".into())]),
        };
        bundle(&section, "windows-x64", into.path(), &|_| {}).unwrap();
        assert!(!into.path().join("bin").exists());
    }

    #[test]
    fn the_repo_ships_node_on_linux() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../runtime.toml");
        let config = BuildConfig::load(&path).unwrap();
        let node = config.node.expect("runtime.toml has a [node] section");
        assert!(node.version.starts_with("24."));
        assert_eq!(node.sha256.get("linux-x64").map(String::len), Some(64));
    }
}
