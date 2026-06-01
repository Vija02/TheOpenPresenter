use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::webview::Cookie;
use tauri::{AppHandle, Emitter, Manager, State, Url};

use crate::state::InitialMainUrl;

const SESSION_COOKIE: &str = "connect.sid";

fn session_cookie_header(app: &AppHandle, root_url: &str) -> Option<String> {
    #[cfg(target_os = "macos")]
    let w = crate::window::ensure_auth_window(app, root_url).ok()?;
    #[cfg(not(target_os = "macos"))]
    let w = app.get_webview_window("main")?;
    let url = Url::parse(root_url).ok()?;
    let cookies = w.cookies_for_url(url).ok()?;
    if !cookies.iter().any(|c| c.name() == SESSION_COOKIE) {
        return None;
    }
    let header = cookies
        .iter()
        .map(|c| format!("{}={}", c.name(), c.value()))
        .collect::<Vec<_>>()
        .join("; ");
    Some(header)
}

/// Exchange a short-lived `loginToken` for a real session.
#[tauri::command]
pub async fn establish_session(
    app: AppHandle,
    token: String,
    root_url: String,
) -> Result<(), String> {
    let base = root_url.trim_end_matches('/');
    let login_url = format!("{base}/qr-auth/login?token={token}&persist-session=1&next=/");

    // 1. Exchange the token for the session cookie
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&login_url)
        .send()
        .await
        .map_err(|e| format!("Login request failed: {e}"))?;
    let status = resp.status();
    let raw_cookies: Vec<String> = resp
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok().map(str::to_string))
        .collect();

    // 2. Inject the cookies into the jar the render webview uses
    #[cfg(target_os = "macos")]
    let w = crate::window::ensure_auth_window(&app, &root_url).map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    let w = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let host = Url::parse(&root_url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string));

    let mut saw_session = false;
    for raw in &raw_cookies {
        let Ok(parsed) = Cookie::parse(raw.clone()) else {
            continue;
        };
        let mut cookie = parsed.into_owned();
        let is_session = cookie.name() == SESSION_COOKIE;
        if cookie.domain().is_none() {
            if let Some(h) = &host {
                cookie.set_domain(h.clone());
            }
        }
        if cookie.path().is_none() {
            cookie.set_path("/");
        }
        match w.set_cookie(cookie) {
            Ok(()) if is_session => saw_session = true,
            Ok(()) => {}
            Err(e) if is_session => {
                return Err(format!("Failed to store session cookie: {e}"));
            }
            // A non-essential cookie failed to store — log and keep going.
            Err(e) => eprintln!("[establish_session] skipped a cookie: {e}"),
        }
    }

    if !saw_session {
        return Err(format!(
            "Login did not return a {SESSION_COOKIE} cookie (HTTP {status}). \
             The pairing token was probably invalid or already used."
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
struct GqlResponse {
    data: Option<GqlData>,
}
#[derive(Deserialize)]
struct GqlData {
    #[serde(rename = "currentUser")]
    current_user: Option<GqlCurrentUser>,
}
#[derive(Deserialize)]
struct GqlCurrentUser {
    #[serde(rename = "organizationMemberships")]
    organization_memberships: GqlMemberships,
}
#[derive(Deserialize)]
struct GqlMemberships {
    nodes: Vec<GqlMembership>,
}
#[derive(Deserialize)]
struct GqlMembership {
    organization: Option<GqlOrg>,
}
#[derive(Deserialize)]
struct GqlOrg {
    id: String,
    name: String,
    slug: String,
    screens: GqlScreens,
}
#[derive(Deserialize)]
struct GqlScreens {
    nodes: Vec<GqlScreen>,
}
#[derive(Deserialize)]
struct GqlScreen {
    id: String,
    name: String,
    slug: String,
}

#[derive(Serialize)]
pub(crate) struct ScreenItem {
    id: String,
    name: String,
    slug: String,
}
#[derive(Serialize)]
pub(crate) struct OrgItem {
    id: String,
    name: String,
    slug: String,
    screens: Vec<ScreenItem>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScreenListResult {
    /// False when there's no session cookie or the server reports no user.
    logged_in: bool,
    orgs: Vec<OrgItem>,
}

const SCREENS_QUERY: &str = "query DesktopScreens { currentUser { id organizationMemberships(first: 20) { nodes { id organization { id name slug screens(orderBy: [NAME_ASC]) { nodes { id name slug } } } } } } }";

/// List the orgs + screens visible to the logged-in user
#[tauri::command]
pub async fn list_screens(app: AppHandle, root_url: String) -> Result<ScreenListResult, String> {
    let cookie_header = match session_cookie_header(&app, &root_url) {
        Some(h) => h,
        None => {
            return Ok(ScreenListResult {
                logged_in: false,
                orgs: vec![],
            })
        }
    };

    let base = root_url.trim_end_matches('/');
    let body = serde_json::json!({ "query": SCREENS_QUERY }).to_string();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{base}/graphql"))
        .header("content-type", "application/json")
        // Bypass CSRF for this server-to-server style call.
        .header("x-top-csrf-protection", "1")
        .header("cookie", cookie_header)
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let text = resp.text().await.map_err(|e| e.to_string())?;
    let parsed: GqlResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Unexpected GraphQL response: {e} — {text}"))?;

    let current_user = match parsed.data.and_then(|d| d.current_user) {
        Some(u) => u,
        // Cookie present but the server doesn't recognize the session
        // (expired / revoked) → treat as logged out.
        None => {
            return Ok(ScreenListResult {
                logged_in: false,
                orgs: vec![],
            })
        }
    };

    let orgs = current_user
        .organization_memberships
        .nodes
        .into_iter()
        .filter_map(|m| m.organization)
        .map(|o| OrgItem {
            id: o.id,
            name: o.name,
            slug: o.slug,
            screens: o
                .screens
                .nodes
                .into_iter()
                .map(|s| ScreenItem {
                    id: s.id,
                    name: s.name,
                    slug: s.slug,
                })
                .collect(),
        })
        .collect();

    Ok(ScreenListResult {
        logged_in: true,
        orgs,
    })
}

/// Logout: evict the session cookie, then reset the render window.
#[tauri::command]
#[cfg_attr(target_os = "macos", allow(unused_variables))]
pub async fn clear_session(
    app: AppHandle,
    initial: State<'_, InitialMainUrl>,
    root_url: String,
) -> Result<(), String> {
    // macOS: evict cookies via the auth helper, then close the helper + render
    // windows so nothing is left holding the session.
    #[cfg(target_os = "macos")]
    {
        if let Ok(w) = crate::window::ensure_auth_window(&app, &root_url) {
            if let Ok(url) = Url::parse(&root_url) {
                if let Ok(cookies) = w.cookies_for_url(url) {
                    for c in cookies {
                        let _ = w.delete_cookie(c);
                    }
                }
            }
            let _ = w.close();
        }
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.close();
        }
        let _ = app.emit("screen-visibility", false);
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = crate::window::set_screen_visible(&app, false);

        if let Some(w) = app.get_webview_window("main") {
            if let Ok(url) = Url::parse(&root_url) {
                if let Ok(cookies) = w.cookies_for_url(url) {
                    for c in cookies {
                        let _ = w.delete_cookie(c);
                    }
                }
            }

            let url = initial.0.lock().ok().and_then(|g| g.clone());
            if let Some(url) = url {
                let escaped = url.replace('\\', "\\\\").replace('\'', "\\'");
                w.eval(&format!("window.location.replace('{escaped}')"))
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
}
