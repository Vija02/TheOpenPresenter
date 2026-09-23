//! The environment the server runs under.

use std::collections::BTreeMap;
use std::path::Path;

/// Ports and paths the composed environment needs.
pub struct ServerEnv<'a> {
    pub http_port: u16,
    pub pg_port: u16,
    pub uploads_path: &'a Path,
    /// Plugins the server loads at boot.
    pub plugins: &'a [String],
    /// Extra values, applied last: a user's .env and any overrides the
    /// caller wants to win over the defaults below.
    pub overrides: BTreeMap<String, String>,
}

/// Names forwarded from the manager's own environment when set.
///
/// Kept to an explicit list rather than passing everything through: the
/// server should not inherit whatever happens to be in a developer's
/// shell, and E2E runs depend on exactly these being overridable.
const FORWARDED: &[&str] = &[
    "AI_BASE_URL",
    "AI_API_KEY",
    "AI_MODEL",
    "PLUGIN_LYRICS_PCO_CLIENT_ID",
    "PLUGIN_LYRICS_PCO_CLIENT_SECRET",
    "PLUGIN_LYRICS_PCO_API_URL",
    "PLUGIN_LYRICS_PCO_OAUTH_URL",
    "PUBLIC_ROOT_URL",
];

// Database credentials for the embedded instance.
const DATABASE_NAME: &str = "theopenpresenter";
const DATABASE_OWNER: &str = "theopenpresenter";
const DATABASE_OWNER_PASSWORD: &str = "password_owner";
const DATABASE_AUTHENTICATOR: &str = "theopenpresenter_authenticator";
const DATABASE_AUTHENTICATOR_PASSWORD: &str = "password_authenticator";
const DATABASE_VISITOR: &str = "theopenpresenter_visitor";
const ROOT_PASSWORD: &str = "password";

impl ServerEnv<'_> {
    /// Build the full environment for the server and worker.
    pub fn compose(&self) -> BTreeMap<String, String> {
        let mut env = BTreeMap::new();
        let mut set = |k: &str, v: String| {
            env.insert(k.to_string(), v);
        };

        let e2e = std::env::var("ENABLE_E2E_COMMANDS").is_ok_and(|v| v != "0");
        set("NODE_ENV", "production".into());
        set("LOG_LOCALLY", "1".into());
        set("AUTO_LOGIN", if e2e { "0" } else { "1" }.into());
        set("ENABLE_E2E_COMMANDS", if e2e { "1" } else { "0" }.into());
        set("ENABLE_PROXY_DEVICE_ON_PRODUCTION", "1".into());

        let pg = self.pg_port;
        set("DATABASE_HOST", format!("localhost:{pg}"));
        set(
            "DATABASE_URL",
            format!(
                "postgres://{DATABASE_OWNER}:{DATABASE_OWNER_PASSWORD}@localhost:{pg}/{DATABASE_NAME}"
            ),
        );
        set(
            "ROOT_DATABASE_URL",
            format!("postgres://postgres:{ROOT_PASSWORD}@localhost:{pg}/postgres"),
        );
        set("DATABASE_NAME", DATABASE_NAME.into());
        set("DATABASE_OWNER", DATABASE_OWNER.into());
        set("DATABASE_OWNER_PASSWORD", DATABASE_OWNER_PASSWORD.into());
        set("DATABASE_AUTHENTICATOR", DATABASE_AUTHENTICATOR.into());
        set(
            "DATABASE_AUTHENTICATOR_PASSWORD",
            DATABASE_AUTHENTICATOR_PASSWORD.into(),
        );
        set("DATABASE_VISITOR", DATABASE_VISITOR.into());

        set("PORT", self.http_port.to_string());
        set("ROOT_URL", format!("http://localhost:{}", self.http_port));
        set("SECRET", "cookie_secret".into());
        set("GRAPHILE_TURBO", "1".into());

        set("STORAGE_TYPE", "file".into());
        set("STORAGE_PROXY", "local".into());
        set(
            "UPLOADS_PATH",
            self.uploads_path.to_string_lossy().to_string(),
        );

        set("VIDEO_TRANSCODE_PIPELINE", "mp4".into());

        set("ENABLED_PLUGINS", self.plugins.join(","));
        set("PLUGINS_PATH", "./plugins".into());
        // Tells the runtime shim that everything it needs is already in
        // the environment, so it does not apply its own fallback values.
        set("TOP_MANAGED", "1".into());
        set(
            "PLUGIN_GOOGLE_SLIDES_CLIENT_ID",
            "69245303872-fo9ap9sv2a6a5oiim2aqsk1hnnrmkkdk.apps.googleusercontent.com".into(),
        );

        set(
            "STATIC_FILES_PATH",
            "https://static.theopenpresenter.com".into(),
        );
        set(
            "MEDIA_PROXY_BASE_URL",
            "https://theopenpresenter.com".into(),
        );
        // A local install is reached over plain http on localhost, so HSTS
        // would make the browser refuse it.
        set("DISABLE_HSTS", "1".into());
        set("ALLOW_ANY_ORIGIN", "1".into());

        for name in FORWARDED {
            if let Ok(value) = std::env::var(name) {
                set(name, value);
            }
        }

        // Last, so a user's .env and explicit caller overrides win.
        for (k, v) in &self.overrides {
            set(k, v.clone());
        }
        env
    }
}

/// Parse a dotenv file well enough for the values this app uses.
pub fn parse_env_file(text: &str) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let line = line.strip_prefix("export ").unwrap_or(line);
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|v| v.strip_suffix('"'))
            .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
            .unwrap_or(value);
        out.insert(key.trim().to_string(), value.to_string());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn env_for(plugins: &[String]) -> BTreeMap<String, String> {
        ServerEnv {
            http_port: 4321,
            pg_port: 5555,
            uploads_path: Path::new("/data/uploads"),
            plugins,
            overrides: BTreeMap::new(),
        }
        .compose()
    }

    #[test]
    fn the_server_always_runs_in_production_mode() {
        // A packaged runtime has built assets and no sources. Anything
        // other than production puts vite-express into dev mode, where
        // it serves from source that is not there: every route 404s with
        // "Cannot GET /o" while the process looks healthy, which reads
        // as a routing bug rather than a configuration one.
        //
        // A developer with ENABLE_E2E_COMMANDS=1 in their .env used to
        // get NODE_ENV=test here and a runtime that started and served
        // nothing.
        let env = env_for(&[]);
        assert_eq!(env["NODE_ENV"], "production");
    }

    #[test]
    fn the_database_url_points_at_the_allocated_port() {
        // Ports are allocated per launch, so a hardcoded one here would
        // connect the server to whatever else happened to be running.
        let env = env_for(&[]);
        assert!(
            env["DATABASE_URL"].contains("@localhost:5555/"),
            "got {}",
            env["DATABASE_URL"]
        );
        assert_eq!(env["DATABASE_HOST"], "localhost:5555");
        assert_eq!(env["PORT"], "4321");
        assert_eq!(env["ROOT_URL"], "http://localhost:4321");
    }

    #[test]
    fn overrides_win_over_defaults() {
        // A user's .env has to be able to change these, or self-hosting
        // means editing the binary.
        let mut overrides = BTreeMap::new();
        overrides.insert("SECRET".to_string(), "not-the-default".to_string());
        overrides.insert("ROOT_URL".to_string(), "https://church.example".to_string());

        let env = ServerEnv {
            http_port: 4321,
            pg_port: 5555,
            uploads_path: Path::new("/data/uploads"),
            plugins: &[],
            overrides,
        }
        .compose();

        assert_eq!(env["SECRET"], "not-the-default");
        assert_eq!(env["ROOT_URL"], "https://church.example");
    }

    #[test]
    fn plugins_are_passed_as_the_server_expects() {
        let plugins = vec!["lyrics-presenter".to_string(), "timer".to_string()];
        assert_eq!(
            env_for(&plugins)["ENABLED_PLUGINS"],
            "lyrics-presenter,timer"
        );
    }

    #[test]
    fn env_files_parse_the_shapes_people_write() {
        let parsed = parse_env_file(
            "# a comment\n\
             PLAIN=value\n\
             QUOTED=\"with spaces\"\n\
             SINGLE='single'\n\
             export EXPORTED=yes\n\
             \n\
             EMPTY=\n",
        );
        assert_eq!(parsed["PLAIN"], "value");
        assert_eq!(parsed["QUOTED"], "with spaces");
        assert_eq!(parsed["SINGLE"], "single");
        assert_eq!(parsed["EXPORTED"], "yes");
        assert_eq!(parsed["EMPTY"], "");
    }
}
