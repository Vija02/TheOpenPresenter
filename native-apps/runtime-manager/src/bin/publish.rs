//! `top-runtime-publish` - turns a built runtime directory into a signed,
//! CDN-ready release.
//!
//! Usage:
//! ```text
//! top-runtime-publish --runtime ./build --version 1.9.0 --schema 7 \
//!   --entry run_server.mjs --out ./cdn --key ./release.key [--previous 1.8.3]
//! ```

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey};
use top_runtime_manager::runtime::fetch;
use top_runtime_manager::runtime::manifest::{FileEntry, Manifest};
use top_runtime_manager::storage::cas::hash_bytes;
use top_runtime_manager::storage::platform::Platform;

fn arg(name: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut iter = args.iter();
    while let Some(a) = iter.next() {
        if a == name {
            return iter.next().cloned();
        }
        if let Some(rest) = a.strip_prefix(&format!("{name}=")) {
            return Some(rest.to_string());
        }
    }
    None
}

fn required(name: &str) -> Result<String> {
    arg(name).with_context(|| format!("Missing required argument {name}"))
}

/// Walk a directory into manifest entries, hashing as we go.
fn walk(root: &Path) -> Result<Vec<(FileEntry, Vec<u8>)>> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            // symlink_metadata, not metadata: the latter follows links, so
            // the symlink check below would never fire.
            let meta = fs::symlink_metadata(&path)?;

            if meta.is_dir() {
                stack.push(path);
                continue;
            }

            let relative = path
                .strip_prefix(root)?
                .to_string_lossy()
                .replace('\\', "/");

            // Shared libraries rely on soname chains
            // (libicuuc.so.60 -> libicuuc.so.60.2). Recording the link
            // rather than copying its target keeps the names the dynamic
            // linker looks up; collapsing them makes PostgreSQL fail to
            // start with a misleading exit 127.
            if meta.file_type().is_symlink() {
                let raw = fs::read_link(&path)?;

                // A relative link is a soname chain within the tree: keep
                // it as a link so the names the dynamic linker looks up
                // survive.
                if !raw.is_absolute() {
                    out.push((
                        FileEntry {
                            path: relative,
                            sha256: String::new(),
                            size: 0,
                            mode: "0777".to_string(),
                            link: Some(raw.to_string_lossy().replace('\\', "/")),
                        },
                        Vec::new(),
                    ));
                    continue;
                }

                // An absolute link points at the build machine and would
                // dangle everywhere else, so ship the content it resolves
                // to instead. Costs a copy; keeps the filename working.
                let Ok(content) = fs::read(&path) else {
                    eprintln!("  skipping unreadable symlink: {relative}");
                    continue;
                };
                let target_mode = fs::metadata(&path)
                    .map(|m| mode_of(&m))
                    .unwrap_or_else(|_| "0644".into());

                out.push((
                    FileEntry {
                        path: relative,
                        sha256: hash_bytes(&content),
                        size: content.len() as u64,
                        mode: target_mode,
                        link: None,
                    },
                    content,
                ));
                continue;
            }

            let content =
                fs::read(&path).with_context(|| format!("Failed to read {}", path.display()))?;

            out.push((
                FileEntry {
                    path: relative,
                    sha256: hash_bytes(&content),
                    size: content.len() as u64,
                    mode: mode_of(&meta),
                    link: None,
                },
                content,
            ));
        }
    }

    out.sort_by(|a, b| a.0.path.cmp(&b.0.path));
    Ok(out)
}

#[cfg(unix)]
fn mode_of(meta: &fs::Metadata) -> String {
    use std::os::unix::fs::PermissionsExt;
    format!("{:04o}", meta.permissions().mode() & 0o7777)
}

#[cfg(not(unix))]
fn mode_of(_meta: &fs::Metadata) -> String {
    "0644".to_string()
}

fn load_key(path: &Path) -> Result<SigningKey> {
    let text = fs::read_to_string(path)
        .with_context(|| format!("Failed to read signing key at {}", path.display()))?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .context("Signing key is not valid base64")?;
    let array: [u8; 32] = bytes
        .try_into()
        .map_err(|_| anyhow::anyhow!("Signing key is not 32 bytes"))?;
    Ok(SigningKey::from_bytes(&array))
}

/// Read the file hashes a previously published manifest referenced, so the
/// delta pack can contain only what is genuinely new.
fn hashes_of_published(cdn: &Path, platform: &Platform, version: &str) -> Result<HashSet<String>> {
    let path = cdn.join(fetch::manifest_key(platform, version));
    let bytes = fs::read(&path)
        .with_context(|| format!("No published manifest for {version} at {}", path.display()))?;
    let envelope: serde_json::Value = serde_json::from_slice(&bytes)?;
    let manifest: Manifest = serde_json::from_str(
        envelope["manifest"]
            .as_str()
            .context("Published manifest envelope has no manifest field")?,
    )?;
    Ok(manifest.files.into_iter().map(|f| f.sha256).collect())
}

fn write_pack(dest: &Path, blobs: &[(&str, &[u8])]) -> Result<u64> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut tar_bytes = Vec::new();
    {
        let mut builder = tar::Builder::new(&mut tar_bytes);
        for (hash, content) in blobs {
            let mut header = tar::Header::new_gnu();
            header.set_size(content.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, hash, *content)?;
        }
        builder.finish()?;
    }
    let compressed = zstd::stream::encode_all(&tar_bytes[..], 10)?;
    fs::write(dest, &compressed)?;
    Ok(compressed.len() as u64)
}

/// Shared inputs for `assemble` and `build`.
fn build_inputs() -> Result<(top_runtime_manager::publish::build::BuildConfig, PathBuf)> {
    let repo = PathBuf::from(arg("--repo").unwrap_or_else(|| ".".to_string()))
        .canonicalize()
        .context("--repo does not exist")?;
    let config_path = arg("--config")
        .map(PathBuf::from)
        .unwrap_or_else(|| repo.join("runtime.toml"));
    let config = top_runtime_manager::publish::build::BuildConfig::load(&config_path)?;
    Ok((config, repo))
}

/// `build`: assemble a tree from a checkout, then publish it.
///
/// Re-executes the normal publish path rather than duplicating it, so
/// there is still exactly one implementation of sign-hash-pack.
fn build_and_publish() -> Result<()> {
    let (config, repo) = build_inputs()?;
    require_built(&repo)?;
    let key = resolve_key(&repo)?;

    let out = PathBuf::from(required("--out")?);
    // Stage inside the output so the assembled tree lands on the same
    // filesystem as the blobs it becomes.
    let stage = out.join(".stage");

    eprintln!("assembling from {}", repo.display());
    top_runtime_manager::publish::build::assemble(&config, &repo, &stage, &|line| {
        eprintln!("{line}")
    })?;

    // Hand the assembled tree to the publish path by rewriting argv,
    // dropping the flags that only make sense for the build step.
    let mut cleaned = Vec::new();
    let mut skip = false;
    for a in std::env::args().skip(2) {
        if skip {
            skip = false;
            continue;
        }
        // --key is re-added below from resolve_key, which may have
        // generated one; --dev-key is a build-step concept only.
        if a == "--repo" || a == "--config" || a == "--key" {
            skip = true;
            continue;
        }
        if a == "--dev-key" {
            continue;
        }
        cleaned.push(a);
    }

    let exe = std::env::current_exe()?;
    let status = std::process::Command::new(exe)
        .args(&cleaned)
        .arg("--runtime")
        .arg(&stage)
        .arg("--entry")
        .arg(&config.runtime.entry)
        .arg("--plugins")
        .arg(config.runtime.plugins.join(","))
        .arg("--key")
        .arg(&key)
        .status()?;

    if !status.success() {
        bail!("publishing the assembled runtime failed");
    }

    // The staged tree has served its purpose: every file in it is now a
    // blob and a pack. Leaving it behind doubles the size of the output
    // directory with a copy nothing reads.
    std::fs::remove_dir_all(&stage)
        .with_context(|| format!("Failed to remove {}", stage.display()))?;
    Ok(())
}

/// Resolve the signing key, generating a development one on demand.
///
/// `--dev-key` exists so a local publish is a single command: without it
/// every contributor has to know to run keygen first, and the failure
/// when they do not is an unhelpful "missing --key". Never use this for a
/// real release: it writes an unencrypted private key next to the repo.
fn resolve_key(repo: &Path) -> Result<PathBuf> {
    if let Some(explicit) = arg("--key") {
        return Ok(PathBuf::from(explicit));
    }
    if !has_flag("--dev-key") {
        bail!("Missing required argument --key (or pass --dev-key for local testing)");
    }

    let path = repo.join("native-apps/runtime-manager/dev-private.key");
    if path.is_file() {
        return Ok(path);
    }

    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;
    let key = SigningKey::generate(&mut OsRng);
    let encoded = base64::engine::general_purpose::STANDARD.encode(key.to_bytes());

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, &encoded)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }

    eprintln!("generated a development signing key at {}", path.display());
    eprintln!(
        "  public key: {}",
        base64::engine::general_purpose::STANDARD.encode(key.verifying_key().to_bytes())
    );
    Ok(path)
}

fn has_flag(name: &str) -> bool {
    std::env::args().any(|a| a == name)
}

/// Fail early when the repo has not been built.
///
/// The runtime is the server as it actually runs, so a missing dist/ is
/// not something to work around: assembling anyway produces a release
/// that installs cleanly and serves nothing.
fn require_built(repo: &Path) -> Result<()> {
    for path in ["backend/server/dist", "apps/project/dist"] {
        if !repo.join(path).exists() {
            bail!("{path} is missing. Run `yarn build` at the repo root first.");
        }
    }
    Ok(())
}

fn main() -> Result<()> {
    if std::env::args().nth(1).as_deref() == Some("assemble") {
        let (config, repo) = build_inputs()?;
        let into = PathBuf::from(required("--into")?);
        eprintln!("assembling from {}", repo.display());
        top_runtime_manager::publish::build::assemble(&config, &repo, &into, &|l| {
            eprintln!("{l}")
        })?;
        eprintln!("assembled {}", into.display());
        return Ok(());
    }

    if std::env::args().nth(1).as_deref() == Some("build") {
        return build_and_publish();
    }

    let runtime_dir = PathBuf::from(required("--runtime")?);
    let version = required("--version")?;
    let out = PathBuf::from(required("--out")?);
    let key_path = PathBuf::from(required("--key")?);
    let entry = arg("--entry").unwrap_or_else(|| "run_server.mjs".to_string());
    let schema_version: u32 = arg("--schema")
        .unwrap_or_else(|| "1".to_string())
        .parse()
        .context("--schema must be a number")?;
    let channel = arg("--channel").unwrap_or_else(|| "stable".to_string());
    // Defaults to this machine, because in CI the runner building the
    // runtime is by definition the platform it is for.
    let platform = arg("--platform")
        .map(Platform::from)
        .unwrap_or_else(Platform::current);
    let min_shell = arg("--min-shell");

    if !runtime_dir.is_dir() {
        bail!("{} is not a directory", runtime_dir.display());
    }
    if !runtime_dir.join(&entry).is_file() {
        bail!(
            "Entrypoint {entry} not found in {}. Publishing a runtime that cannot start \
             would break every client that downloads it.",
            runtime_dir.display()
        );
    }

    let key = load_key(&key_path)?;
    println!("Hashing {}...", runtime_dir.display());
    let files = walk(&runtime_dir)?;
    println!("  {} files", files.len());

    // 1. Blobs, deduped by hash.
    let mut written = 0usize;
    let mut seen = HashSet::new();
    for (entry, content) in &files {
        // Symlinks carry no content, so there is no blob to publish.
        if entry.link.is_some() || !seen.insert(entry.sha256.clone()) {
            continue;
        }
        let blob = out.join(format!("blobs/{}/{}", &entry.sha256[..2], entry.sha256));
        if blob.is_file() {
            continue;
        }
        fs::create_dir_all(blob.parent().unwrap())?;
        fs::write(&blob, zstd::stream::encode_all(&content[..], 10)?)?;
        written += 1;
    }
    println!("  {written} new blobs ({} unique)", seen.len());

    // 2. Signed manifest.
    let manifest = Manifest {
        version: version.clone(),
        min_shell,
        schema_version,
        entry: entry.clone(),
        // Recorded so the launcher can configure the server from the
        // runtime itself. Passed by `build`; a bare `--runtime` publish
        // of a pre-assembled tree can name them with --plugins.
        plugins: arg("--plugins")
            .map(|list| {
                list.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default(),
        files: files.iter().map(|(e, _)| e.clone()).collect(),
    };
    manifest.validate_paths()?;

    let manifest_json = serde_json::to_string(&manifest)?;
    let signature = base64::engine::general_purpose::STANDARD
        .encode(key.sign(manifest_json.as_bytes()).to_bytes());

    let manifest_path = out.join(fetch::manifest_key(&platform, &version));
    fs::create_dir_all(manifest_path.parent().unwrap())?;
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&serde_json::json!({
            "manifest": manifest_json,
            "signature": signature,
        }))?,
    )?;
    println!("  manifest signed ({} bytes total)", manifest.total_size());

    // 3. Full pack.
    let mut unique: Vec<(&str, &[u8])> = Vec::new();
    let mut packed = HashSet::new();
    for (e, content) in &files {
        if e.link.is_none() && packed.insert(&e.sha256) {
            unique.push((&e.sha256, content));
        }
    }
    let full_size = write_pack(
        &out.join(fetch::full_pack_key(&platform, &version)),
        &unique,
    )?;
    println!("  full pack: {} MB", full_size / 1_048_576);

    // 4. Delta packs. `node_modules` is tens of thousands of files, so an
    //    update of 3,000 small blobs as 3,000 HTTPS GETs can be slower than
    //    downloading everything; one pack per common hop avoids that.
    for previous in std::env::args()
        .collect::<Vec<_>>()
        .windows(2)
        .filter(|w| w[0] == "--previous")
        .map(|w| w[1].clone())
    {
        let old_hashes = match hashes_of_published(&out, &platform, &previous) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("  skipping delta from {previous}: {e}");
                continue;
            }
        };
        let delta: Vec<(&str, &[u8])> = unique
            .iter()
            .filter(|(hash, _)| !old_hashes.contains(*hash))
            .copied()
            .collect();

        let size = write_pack(
            &out.join(fetch::delta_pack_key(&platform, &previous, &version)),
            &delta,
        )?;
        println!(
            "  delta {previous} -> {version}: {} blobs, {} MB",
            delta.len(),
            size / 1_048_576
        );
    }

    // 5. Version index, so a far-behind client can find a chain of deltas
    //    rather than guessing version numbers. Written before the channel
    //    pointer for the same reason the pointer goes last.
    let versions_path = out.join(fetch::versions_key(&platform));
    let mut known: Vec<String> = fs::read(&versions_path)
        .ok()
        .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
        .and_then(|v| {
            v.get("versions").and_then(|a| a.as_array()).map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(String::from))
                    .collect()
            })
        })
        .unwrap_or_default();
    if !known.iter().any(|v| v.as_str() == version) {
        known.push(version.to_string());
    }
    fs::create_dir_all(versions_path.parent().unwrap())?;
    fs::write(
        &versions_path,
        serde_json::to_vec_pretty(&serde_json::json!({ "versions": known }))?,
    )?;

    // 6. Channel pointer, written last so a client never resolves a version
    //    whose blobs are still uploading.
    let channel_path = out.join(fetch::channel_key(&channel, &platform));
    fs::create_dir_all(channel_path.parent().unwrap())?;
    fs::write(
        &channel_path,
        serde_json::to_vec_pretty(&serde_json::json!({
            "channel": channel,
            "version": version,
        }))?,
    )?;

    println!("Published {version} to {}", out.display());
    Ok(())
}
