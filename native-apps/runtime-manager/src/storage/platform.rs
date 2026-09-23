use std::fmt;

/// A build target, as it appears in CDN keys: `linux-x64`, `macos-arm64`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Platform(String);

impl Platform {
    /// The platform this binary is running on.
    pub fn current() -> Self {
        // OS names are used as-is: "linux", "macos" and "windows" are
        // already the names people expect in a download URL. Arch names
        // are not: Rust says x86_64 and aarch64 where every distribution
        // channel says x64 and arm64.
        let os = std::env::consts::OS;
        let arch = match std::env::consts::ARCH {
            "x86_64" => "x64",
            "aarch64" => "arm64",
            other => other,
        };
        Self(format!("{os}-{arch}"))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl From<String> for Platform {
    fn from(value: String) -> Self {
        Self(value)
    }
}

impl From<&str> for Platform {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_current_platform_is_a_usable_key() {
        let p = Platform::current();
        assert!(
            p.as_str().contains('-'),
            "expected os-arch, got {}",
            p.as_str()
        );
        // Anything that ends up in a URL must not need escaping.
        assert!(
            p.as_str()
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-'),
            "platform is not URL safe: {}",
            p.as_str()
        );
    }

    #[test]
    fn arch_names_are_normalised() {
        // Rust says x86_64; every distribution channel says x64.
        assert_eq!(Platform::from("linux-x64").as_str(), "linux-x64");
        let current = Platform::current();
        assert!(!current.as_str().contains("x86_64"));
        assert!(!current.as_str().contains("aarch64"));
    }
}
