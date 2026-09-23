use std::io::Read;
use std::path::PathBuf;
use std::time::Duration;

use anyhow::{bail, Context, Result};

use crate::storage::platform::Platform;

/// Layout of a release CDN:
///
/// ```text
/// channels/<platform>/<channel>.json   {"channel":"stable","version":"1.9.0"}
/// versions/<platform>.json             every published version
/// runtimes/<platform>/<version>/manifest.json
/// blobs/<aa>/<sha256>                  zstd blob, shared across platforms
/// packs/<platform>/<from>__<to>.tar.zst
/// packs/<platform>/full__<version>.tar.zst
/// ```
pub trait Source: Send + Sync {
    fn get(&self, key: &str) -> Result<Vec<u8>>;

    /// Whether an optional artifact exists. Used to decide between a delta
    /// pack, a full pack and per-blob fetches without a failed download
    /// counting as an error.
    fn exists(&self, key: &str) -> bool {
        self.get(key).is_ok()
    }
}

pub fn channel_key(channel: &str, platform: &Platform) -> String {
    format!("channels/{platform}/{channel}.json")
}

pub fn manifest_key(platform: &Platform, version: &str) -> String {
    format!("runtimes/{platform}/{version}/manifest.json")
}

pub fn blob_key(sha256: &str) -> String {
    format!("blobs/{}/{}", &sha256[..2.min(sha256.len())], sha256)
}

pub fn delta_pack_key(platform: &Platform, from: &str, to: &str) -> String {
    format!("packs/{platform}/{from}__{to}.tar.zst")
}

pub fn full_pack_key(platform: &Platform, version: &str) -> String {
    format!("packs/{platform}/full__{version}.tar.zst")
}

/// Index of every published version, used to find a chain of delta packs
/// when no single delta covers the hop.
pub fn versions_key(platform: &Platform) -> String {
    format!("versions/{platform}.json")
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

pub struct HttpSource {
    base_url: String,
    agent: ureq::Agent,
}

impl HttpSource {
    pub fn new(base_url: impl Into<String>) -> Self {
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(15))
            .timeout_read(Duration::from_secs(300))
            .build();
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            agent,
        }
    }

    fn url(&self, key: &str) -> String {
        format!("{}/{}", self.base_url, key.trim_start_matches('/'))
    }
}

/// Hard cap on a single artifact, so a hostile or broken CDN cannot make the
/// manager allocate without bound.
const MAX_ARTIFACT_BYTES: u64 = 4 * 1024 * 1024 * 1024;

impl Source for HttpSource {
    fn get(&self, key: &str) -> Result<Vec<u8>> {
        let url = self.url(key);
        let response = self
            .agent
            .get(&url)
            .call()
            .with_context(|| format!("Failed to fetch {url}"))?;

        let declared: u64 = response
            .header("content-length")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);
        if declared > MAX_ARTIFACT_BYTES {
            bail!("{url} declares {declared} bytes, over the {MAX_ARTIFACT_BYTES} byte cap");
        }

        let mut buf = Vec::with_capacity(declared.min(8 * 1024 * 1024) as usize);
        response
            .into_reader()
            .take(MAX_ARTIFACT_BYTES)
            .read_to_end(&mut buf)
            .with_context(|| format!("Failed to read body of {url}"))?;
        Ok(buf)
    }

    fn exists(&self, key: &str) -> bool {
        self.agent
            .head(&self.url(key))
            .call()
            .map(|r| r.status() < 400)
            .unwrap_or(false)
    }
}

// ---------------------------------------------------------------------------
// Local directory
// ---------------------------------------------------------------------------

/// Serves artifacts from a directory laid out like the CDN. Used by tests and
/// by `--source file://…` for offline installs from a USB stick.
pub struct DirSource {
    root: PathBuf,
}

impl DirSource {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
}

impl Source for DirSource {
    fn get(&self, key: &str) -> Result<Vec<u8>> {
        let path = self.root.join(key);
        std::fs::read(&path).with_context(|| format!("Failed to read {}", path.display()))
    }

    fn exists(&self, key: &str) -> bool {
        self.root.join(key).is_file()
    }
}

/// A release hosted as GitHub Release assets.
///
/// GitHub gives every asset a flat name in a single namespace: there are no
/// directories and a name containing `/` is rejected. The publish workflow
/// therefore flattens each key with `__`, and this puts it back, so the
/// rest of the manager works in ordinary CDN keys and never has to know
/// where a release happens to be hosted.
///
/// The asset for a key lives at a predictable URL, so no API call (and no
/// token, and no rate limit) is needed to find it.
pub struct GithubSource {
    repo: String,
    tag: String,
    inner: HttpSource,
}

impl GithubSource {
    /// `github:owner/repo@runtime-v1.9.0`
    pub fn parse(spec: &str) -> Option<Self> {
        let rest = spec.strip_prefix("github:")?;
        let (repo, tag) = rest.split_once('@')?;
        if repo.is_empty() || tag.is_empty() {
            return None;
        }
        Some(Self {
            repo: repo.to_string(),
            tag: tag.to_string(),
            // Overridable so the download path can be exercised against a
            // local server. Without this the only way to test it is to
            // publish a real release and hope.
            inner: HttpSource::new(
                std::env::var("TOP_RUNTIME_GITHUB_BASE")
                    .unwrap_or_else(|_| "https://github.com".to_string()),
            ),
        })
    }

    fn asset_name(key: &str) -> String {
        key.replace('/', "__")
    }
}

impl Source for GithubSource {
    fn get(&self, key: &str) -> Result<Vec<u8>> {
        self.inner.get(&format!(
            "{}/releases/download/{}/{}",
            self.repo,
            self.tag,
            Self::asset_name(key)
        ))
    }
}

/// Build a source from a `--source` argument.
///
/// Accepts `github:owner/repo@tag`, `https://…`, `file://…`, or a bare
/// path.
pub fn source_from_arg(arg: &str) -> Box<dyn Source> {
    if let Some(source) = GithubSource::parse(arg) {
        Box::new(source)
    } else if arg.starts_with("http://") || arg.starts_with("https://") {
        Box::new(HttpSource::new(arg))
    } else if let Some(path) = arg.strip_prefix("file://") {
        Box::new(DirSource::new(path))
    } else {
        Box::new(DirSource::new(arg))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_match_the_published_layout() {
        let p = Platform::from("linux-x64");
        assert_eq!(channel_key("stable", &p), "channels/linux-x64/stable.json");
        assert_eq!(
            manifest_key(&p, "1.9.0"),
            "runtimes/linux-x64/1.9.0/manifest.json"
        );
        assert_eq!(
            delta_pack_key(&p, "1.8.3", "1.9.0"),
            "packs/linux-x64/1.8.3__1.9.0.tar.zst"
        );
        assert_eq!(
            full_pack_key(&p, "1.9.0"),
            "packs/linux-x64/full__1.9.0.tar.zst"
        );
        assert_eq!(versions_key(&p), "versions/linux-x64.json");
    }

    #[test]
    fn a_github_source_flattens_keys_into_asset_names() {
        // GitHub Releases has no directories: the workflow flattens keys
        // with "__" on upload, and this has to agree exactly or every
        // fetch is a 404.
        let source = GithubSource::parse("github:vija02/theopenpresenter@runtime-v1.9.0").unwrap();
        assert_eq!(source.repo, "vija02/theopenpresenter");
        assert_eq!(source.tag, "runtime-v1.9.0");
        assert_eq!(
            GithubSource::asset_name("channels/linux-x64/stable.json"),
            "channels__linux-x64__stable.json"
        );
        assert_eq!(
            GithubSource::asset_name("blobs/ab/abcdef"),
            "blobs__ab__abcdef"
        );
    }

    #[test]
    fn a_non_github_source_is_left_alone() {
        assert!(GithubSource::parse("https://runtime.example.com").is_none());
        assert!(GithubSource::parse("/tmp/cdn").is_none());
        // A tag is required: without one there is nothing to download.
        assert!(GithubSource::parse("github:owner/repo").is_none());
    }

    #[test]
    fn blobs_are_shared_between_platforms() {
        // The saving that makes a multi-platform CDN affordable: identical
        // JavaScript is stored once no matter how many platforms ship it.
        assert_eq!(blob_key("ab12cd"), "blobs/ab/ab12cd");
    }

    #[test]
    fn two_platforms_never_collide() {
        let linux = Platform::from("linux-x64");
        let mac = Platform::from("macos-arm64");
        assert_ne!(channel_key("stable", &linux), channel_key("stable", &mac));
        assert_ne!(manifest_key(&linux, "1.0.0"), manifest_key(&mac, "1.0.0"));
        assert_ne!(versions_key(&linux), versions_key(&mac));
    }

    #[test]
    fn a_dir_source_reads_and_reports_existence() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("channels")).unwrap();
        std::fs::write(tmp.path().join("channels/stable.json"), b"{}").unwrap();

        let source = DirSource::new(tmp.path());
        assert!(source.exists("channels/stable.json"));
        assert!(!source.exists("channels/beta.json"));
        assert_eq!(source.get("channels/stable.json").unwrap(), b"{}");
        assert!(source.get("channels/beta.json").is_err());
    }

    #[test]
    fn source_arg_picks_the_right_backend() {
        // Only observable through behaviour: a file path must resolve reads
        // relative to that directory.
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("x"), b"y").unwrap();

        let via_path = source_from_arg(tmp.path().to_str().unwrap());
        assert_eq!(via_path.get("x").unwrap(), b"y");

        let via_url = source_from_arg(&format!("file://{}", tmp.path().display()));
        assert_eq!(via_url.get("x").unwrap(), b"y");
    }
}
