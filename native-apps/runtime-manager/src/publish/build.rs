//! Assembling a runtime tree from a repo checkout.
//!
//! The file list lives in `runtime.toml`, and this module is its only
//! consumer, so the local publisher and CI cannot drift apart.
//!
//! What makes this fiddly is that almost nothing here is discoverable by
//! static analysis:
//!
//! - native addons build their filename at runtime from `process.platform`
//! - the server shells out to scripts that are not under `dist/`
//! - `@repo/*` resolves through a workspace layout the copy does not keep
//! - a bare import at the tree root resolves upward, not into the app
//!
//! Each of those was a real runtime failure. The `[verify]` section exists
//! so the next one fails at publish time instead.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{bail, Context, Result};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct BuildConfig {
    pub runtime: RuntimeSection,
    #[serde(default)]
    pub copy: Vec<CopySection>,
    pub trace: TraceSection,
    #[serde(default)]
    pub verify: VerifySection,
}

#[derive(Debug, Deserialize)]
pub struct RuntimeSection {
    pub entry: String,
    pub entry_source: String,
    #[serde(default)]
    pub plugins: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CopySection {
    pub from: String,
    #[serde(default)]
    pub exclude: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct TraceSection {
    #[serde(default)]
    pub scripts: Vec<String>,
    pub results: String,
    #[serde(default)]
    pub native_addons: bool,
    #[serde(default)]
    pub workspace_packages: Vec<String>,
    #[serde(default)]
    pub root_packages: Vec<String>,
    /// Packages nft cannot find, copied whole with their dependency tree.
    #[serde(default)]
    pub include_packages: Vec<String>,
    /// Extra files copied verbatim from the repo's `node_modules`.
    #[serde(default)]
    pub include_module_files: Vec<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct VerifySection {
    #[serde(default)]
    pub required: Vec<String>,
}

impl BuildConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("Could not read {}", path.display()))?;
        toml::from_str(&text).with_context(|| format!("{} is not valid", path.display()))
    }
}

/// Assemble a runtime tree at `into` from the checkout at `repo`.
pub fn assemble(config: &BuildConfig, repo: &Path, into: &Path, log: &dyn Fn(&str)) -> Result<()> {
    // A stale tree would publish files that are no longer part of the
    // build, which is invisible until something fails at runtime.
    if into.exists() {
        std::fs::remove_dir_all(into)?;
    }
    std::fs::create_dir_all(into)?;

    // run_server.mjs resolves everything relative to ./theopenpresenter.
    let inner = into.join("theopenpresenter");
    std::fs::create_dir_all(&inner)?;

    let entry_src = repo.join(&config.runtime.entry_source);
    if !entry_src.is_file() {
        bail!("Entrypoint {} does not exist", entry_src.display());
    }
    copy_file(&entry_src, &into.join(&config.runtime.entry))?;

    for part in &config.copy {
        let from = repo.join(&part.from);
        if !from.exists() {
            bail!(
                "{} is missing. The runtime is the server as it actually \
                 runs, so the repo has to be built first.",
                part.from
            );
        }
        let count = copy_tree(&from, &inner.join(&part.from), &part.exclude)?;
        log(&format!("  + {} ({count} files)", part.from));
    }

    copy_plugins(config, repo, &inner, log)?;
    copy_dependencies(config, repo, into, log)?;
    verify(config, into)?;
    Ok(())
}

/// Copy the enabled plugins, and only those.
///
/// The server symlinks each into `loadedPlugins/` at startup and fails on
/// a directory it does not expect, so shipping everything in `plugins/`
/// breaks boot. It also refuses to start when one is missing, which makes
/// this list worth checking against the server's own.
fn copy_plugins(config: &BuildConfig, repo: &Path, inner: &Path, log: &dyn Fn(&str)) -> Result<()> {
    let declared = enabled_plugins_in_server(repo)?;
    let configured: BTreeSet<&String> = config.runtime.plugins.iter().collect();
    let declared_set: BTreeSet<&String> = declared.iter().collect();

    if !declared.is_empty() && configured != declared_set {
        // Two lists that disagree means the runtime either ships a plugin
        // the server will not load, or omits one it requires and refuses
        // to start without.
        let missing: Vec<_> = declared_set.difference(&configured).collect();
        let extra: Vec<_> = configured.difference(&declared_set).collect();
        bail!(
            "runtime.toml plugins do not match ENABLED_PLUGINS in {}.\n  \
             missing here: {missing:?}\n  not in the server list: {extra:?}",
            config.runtime.entry_source
        );
    }

    for plugin in &config.runtime.plugins {
        let from = repo.join("plugins").join(plugin);
        if !from.is_dir() {
            bail!("Plugin {plugin} is enabled but plugins/{plugin} does not exist");
        }
        copy_tree(
            &from,
            &inner.join("plugins").join(plugin),
            &["node_modules".to_string()],
        )?;
    }
    log(&format!(
        "  + plugins/ ({} enabled)",
        config.runtime.plugins.len()
    ));
    Ok(())
}

/// Copy the dependencies the server needs at runtime.
fn copy_dependencies(
    config: &BuildConfig,
    repo: &Path,
    into: &Path,
    log: &dyn Fn(&str),
) -> Result<()> {
    run_traces(config, repo, log)?;

    let modules = into.join("theopenpresenter/node_modules");
    let mut copied = 0usize;
    let mut unavailable = 0usize;

    for relative in traced_paths(config, repo)? {
        let from = repo.join(&relative);
        if !from.exists() {
            unavailable += 1;
            continue;
        }
        // Strip the leading node_modules/ so the destination keeps the
        // same shape the resolver expects.
        let Ok(rest) = Path::new(&relative).strip_prefix("node_modules") else {
            continue;
        };
        let to = modules.join(rest);
        if to.exists() {
            continue;
        }
        if from.is_dir() {
            copied += copy_tree(&from, &to, &[])?;
        } else {
            copy_file(&from, &to)?;
            copied += 1;
        }
    }
    log(&format!(
        "  + node_modules ({copied} paths, {unavailable} unavailable)"
    ));

    if config.trace.native_addons {
        let n = copy_native_addons(repo, &modules)?;
        log(&format!("  + native packages ({n})"));
    }

    if !config.trace.include_packages.is_empty() {
        let mut seen = BTreeSet::new();
        let mut count = 0;
        for name in &config.trace.include_packages {
            count += copy_package_tree(repo, &modules, name, None, &mut seen)?;
        }
        log(&format!("  + declared packages ({count})"));
    }

    for relative in &config.trace.include_module_files {
        let from = repo.join("node_modules").join(relative);
        if !from.exists() {
            bail!(
                "{} is listed in include_module_files but is not in node_modules",
                relative
            );
        }
        let to = modules.join(relative);
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(&from, &to)?;
    }

    // Workspace packages are relative symlinks into packages/, so copying
    // the links alone produces a tree whose @repo/* all dangle. The
    // server then dies on its first import with "Cannot find module
    // '@repo/observability'". Materialise what they point at instead.
    for scope in &config.trace.workspace_packages {
        let from = repo.join("node_modules").join(scope);
        if from.exists() {
            let n = copy_tree_dereferencing(&from, &modules.join(scope))?;
            log(&format!("  + {scope} ({n} files, links resolved)"));
        }
    }

    // Bare imports from the tree root resolve upward from the importing
    // file, so the root needs its own node_modules rather than relying on
    // the one inside theopenpresenter/.
    for name in &config.trace.root_packages {
        let from = repo.join("node_modules").join(name);
        if from.exists() {
            copy_tree(&from, &into.join("node_modules").join(name), &[])?;
            log(&format!("  + {name} (tree root)"));
        }
    }
    Ok(())
}

/// Regenerate the dependency traces.
///
/// Rather than trusting whatever is on disk: stale traces produce a
/// runtime that boots and then fails on the first request needing an
/// untraced package. Found the hard way, with a missing `ipaddr.js`.
fn run_traces(config: &BuildConfig, repo: &Path, log: &dyn Fn(&str)) -> Result<()> {
    for script in &config.trace.scripts {
        let status = Command::new("node")
            .arg(repo.join(script))
            .current_dir(repo)
            .status()
            .with_context(|| format!("Could not run {script}. Is node on PATH?"))?;
        if !status.success() {
            bail!("{script} failed");
        }
    }
    if !config.trace.scripts.is_empty() {
        log(&format!(
            "  traced ({} scripts)",
            config.trace.scripts.len()
        ));
    }
    Ok(())
}

fn traced_paths(config: &BuildConfig, repo: &Path) -> Result<BTreeSet<String>> {
    let dir = repo.join(&config.trace.results);
    let mut all = BTreeSet::new();

    for entry in
        std::fs::read_dir(&dir).with_context(|| format!("No trace results at {}", dir.display()))?
    {
        let path = entry?.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let text = std::fs::read_to_string(&path)?;
        let list: Vec<String> = serde_json::from_str(&text)
            .with_context(|| format!("{} is not a list of paths", path.display()))?;
        all.extend(list.into_iter().filter(|p| p.starts_with("node_modules")));
    }

    if all.is_empty() {
        bail!(
            "The traces in {} are empty. A runtime without dependencies \
             installs fine and dies on boot.",
            dir.display()
        );
    }
    Ok(all)
}

/// Copy every package containing a native `.node` addon.
///
/// nft cannot follow these: the filename is built from `process.platform`
/// and `process.arch` at runtime. The whole package is copied rather than
/// the bare `.node` file, because they are resolved as packages and Node
/// needs the `package.json` to find them.
/// Copy a package and everything it depends on, including optional deps.
///
/// `optionalDependencies` is the important part and the reason this cannot
/// just be a directory copy: that is where the per-platform native packages
/// live (`@esbuild/linux-x64`, `@tailwindcss/oxide-*`). npm installs only
/// the entries matching the current machine, so walking them yields exactly
/// this platform's binaries and nothing else.
///
/// Nested `node_modules` win over the top-level copy, matching how Node
/// itself resolves, so a package pinned to its own version of a dependency
/// keeps it.
fn copy_package_tree(
    repo: &Path,
    modules: &Path,
    name: &str,
    parent: Option<&Path>,
    seen: &mut BTreeSet<PathBuf>,
) -> Result<usize> {
    let root = repo.join("node_modules");
    let nested = parent.map(|p| p.join("node_modules").join(name));
    let from = match nested {
        Some(path) if path.is_dir() => path,
        _ => root.join(name),
    };

    if !seen.insert(from.clone()) {
        return Ok(0);
    }
    // A missing optional dependency is normal: they are per-platform, so
    // most of the set is absent on any given machine.
    if !from.is_dir() {
        return Ok(0);
    }

    let mut count = 0;
    let relative = from.strip_prefix(&root).unwrap_or(Path::new(name));
    let to = modules.join(relative);
    // Merge rather than skip when the directory already exists. Tracing
    // usually got there first with the package's JS, and skipping on that
    // basis is exactly how the binary went missing: the wrapper is present,
    // so the package looks copied, while the executable never arrives.
    let added = copy_tree(&from, &to, &[])?;
    if added > 0 {
        count += 1;
    }

    let manifest_path = from.join("package.json");
    if !manifest_path.is_file() {
        return Ok(count);
    }
    let Ok(text) = std::fs::read_to_string(&manifest_path) else {
        return Ok(count);
    };
    let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Ok(count);
    };

    for field in ["dependencies", "optionalDependencies"] {
        let Some(deps) = manifest.get(field).and_then(|v| v.as_object()) else {
            continue;
        };
        for dep in deps.keys() {
            count += copy_package_tree(repo, modules, dep, Some(&from), seen)?;
        }
    }
    Ok(count)
}

/// Copy packages containing a compiled `.node` addon.
///
/// nft cannot follow these: the filename is built from `process.platform`
/// and `process.arch` at runtime. The whole package is copied rather than
/// the bare `.node` file, because they are resolved as packages and Node
/// needs the `package.json` to find them.
fn copy_native_addons(repo: &Path, modules: &Path) -> Result<usize> {
    let mut packages = BTreeSet::new();
    let mut stack = vec![repo.join("node_modules")];

    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("node") {
                if let Some(pkg) = nearest_package(&path) {
                    packages.insert(pkg);
                }
            }
        }
    }

    let mut count = 0;
    for package in &packages {
        let Ok(rest) = package.strip_prefix(repo.join("node_modules")) else {
            continue;
        };
        let to = modules.join(rest);
        if to.exists() {
            continue;
        }
        copy_tree(package, &to, &[])?;
        count += 1;
    }
    Ok(count)
}

/// Walk up from a file to the directory holding its `package.json`.
fn nearest_package(file: &Path) -> Option<PathBuf> {
    let mut at = file.parent()?;
    loop {
        if at.join("package.json").is_file() {
            return Some(at.to_path_buf());
        }
        at = at.parent()?;
        if !at.to_string_lossy().contains("node_modules") {
            return None;
        }
    }
}

/// Whether a `[verify] required` entry is satisfied.
fn required_path_exists(tree: &Path, pattern: &str) -> bool {
    let Some(prefix) = pattern.strip_suffix('*') else {
        return tree.join(pattern).exists();
    };

    let full = tree.join(prefix);
    let (Some(dir), Some(stem)) = (full.parent(), full.file_name()) else {
        return false;
    };
    let stem = stem.to_string_lossy().to_string();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries
        .flatten()
        .any(|e| e.file_name().to_string_lossy().starts_with(&stem))
}

/// Fail the build when something the server needs at runtime is absent.
///
/// A trailing `*` matches any suffix, which is how a per-platform binary
/// gets checked: `ffmpeg-static/ffmpeg*` is satisfied by `ffmpeg` on Unix
/// and `ffmpeg.exe` on Windows, so one list covers every runner.
fn verify(config: &BuildConfig, tree: &Path) -> Result<()> {
    let missing: Vec<&String> = config
        .verify
        .required
        .iter()
        .filter(|p| !required_path_exists(tree, p))
        .collect();

    if !missing.is_empty() {
        bail!(
            "The assembled runtime is missing files the server needs at \
             runtime:\n{}\nPublishing it would produce a release that \
             installs and migrates cleanly, then fails once running.",
            missing
                .iter()
                .map(|p| format!("  - {p}"))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }
    Ok(())
}

/// Copy a tree, replacing symlinked directories with their contents.
///
/// For workspace packages only. The general copy preserves symlinks
/// because soname chains depend on them, but a workspace link points at
/// a sibling directory that is not itself shipped, so preserving it
/// leaves a dangling reference.
fn copy_tree_dereferencing(from: &Path, to: &Path) -> Result<usize> {
    std::fs::create_dir_all(to)?;
    let mut count = 0;

    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let src = entry.path();
        let dst = to.join(entry.file_name());

        // Resolve the link, then copy what is behind it. node_modules is
        // excluded: each workspace package has its own, and they are
        // already covered by the traced dependencies.
        let resolved = std::fs::canonicalize(&src).unwrap_or(src.clone());
        if resolved.is_dir() {
            count += copy_tree(&resolved, &dst, &["node_modules".to_string()])?;
        } else if resolved.is_file() {
            copy_file(&resolved, &dst)?;
            count += 1;
        }
    }
    Ok(count)
}

fn copy_file(from: &Path, to: &Path) -> Result<()> {
    if let Some(parent) = to.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(from, to)
        .with_context(|| format!("Failed to copy {} to {}", from.display(), to.display()))?;
    Ok(())
}

/// Recursive copy, preserving symlinks.
///
/// Symlinks are kept as symlinks: dereferencing collapses the soname
/// chains the dynamic linker needs, and PostgreSQL then fails to start
/// with an error that looks like a missing binary rather than a missing
/// library.
fn copy_tree(from: &Path, to: &Path, exclude: &[String]) -> Result<usize> {
    let mut count = 0;
    let mut stack = vec![(from.to_path_buf(), to.to_path_buf())];

    while let Some((src, dst)) = stack.pop() {
        std::fs::create_dir_all(&dst)?;
        for entry in std::fs::read_dir(&src)? {
            let entry = entry?;
            let name = entry.file_name();
            let name_str = name.to_string_lossy();

            // Tested against the name, not the destination path: the
            // destination always contains "node_modules", so matching on
            // it would reject every file.
            if exclude.iter().any(|e| e.as_str() == name_str) {
                continue;
            }

            let child_src = entry.path();
            let child_dst = dst.join(&name);
            let meta = std::fs::symlink_metadata(&child_src)?;

            if meta.is_dir() {
                stack.push((child_src, child_dst));
            } else if meta.is_symlink() {
                copy_symlink(&child_src, &child_dst)?;
                count += 1;
            } else {
                std::fs::copy(&child_src, &child_dst)?;
                count += 1;
            }
        }
    }
    Ok(count)
}

fn copy_symlink(from: &Path, to: &Path) -> Result<()> {
    let target = std::fs::read_link(from)?;

    // An absolute link would point outside the runtime once installed, so
    // materialise what it resolves to instead.
    if target.is_absolute() {
        if from.is_file() {
            std::fs::copy(from, to)?;
        }
        return Ok(());
    }

    #[cfg(unix)]
    {
        if to.exists() {
            std::fs::remove_file(to)?;
        }
        std::os::unix::fs::symlink(&target, to)?;
    }
    #[cfg(windows)]
    {
        // Symlinks need admin or developer mode on Windows, so copy.
        if from.is_file() {
            std::fs::copy(from, to)?;
        }
    }
    Ok(())
}

/// Read `ENABLED_PLUGINS` out of the server entrypoint.
///
/// Returns empty rather than failing when it cannot be found: the check
/// that uses this is a cross-reference, and a parse that silently breaks
/// should not block a release on its own.
fn enabled_plugins_in_server(repo: &Path) -> Result<Vec<String>> {
    let path = repo.join("tauri/node-server/run_server.mjs");
    let Ok(source) = std::fs::read_to_string(&path) else {
        return Ok(Vec::new());
    };

    let Some(start) = source.find("ENABLED_PLUGINS:") else {
        return Ok(Vec::new());
    };
    let rest = &source[start..];
    let Some(open) = rest.find('"') else {
        return Ok(Vec::new());
    };
    let Some(close) = rest[open + 1..].find('"') else {
        return Ok(Vec::new());
    };

    Ok(rest[open + 1..open + 1 + close]
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect())
}
