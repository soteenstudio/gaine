use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum AssetKind {
    Html,
    JavaScript,
    Css,
    Image,
    Font,
    Media,
    Json,
    Map,
    Other,
}

impl AssetKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AssetKind::Html => "html",
            AssetKind::JavaScript => "js",
            AssetKind::Css => "css",
            AssetKind::Image => "image",
            AssetKind::Font => "font",
            AssetKind::Media => "media",
            AssetKind::Json => "json",
            AssetKind::Map => "map",
            AssetKind::Other => "other",
        }
    }

    pub fn from_path(path: &str) -> Self {
        match extension(path).as_deref() {
            Some("html") | Some("htm") => AssetKind::Html,
            Some("js") | Some("mjs") | Some("cjs") => AssetKind::JavaScript,
            Some("css") => AssetKind::Css,
            Some("png") | Some("jpg") | Some("jpeg") | Some("gif") | Some("webp")
            | Some("avif") | Some("svg") | Some("ico") => AssetKind::Image,
            Some("woff") | Some("woff2") | Some("ttf") | Some("otf") | Some("eot") => {
                AssetKind::Font
            }
            Some("mp4") | Some("webm") | Some("ogg") | Some("mp3") | Some("wav") => {
                AssetKind::Media
            }
            Some("json") | Some("webmanifest") => AssetKind::Json,
            Some("map") => AssetKind::Map,
            _ => AssetKind::Other,
        }
    }
}

pub fn extension(path: &str) -> Option<String> {
    let clean = path.split(['?', '#']).next().unwrap_or(path);
    let name = clean.rsplit('/').next().unwrap_or(clean);
    let (stem, ext) = name.rsplit_once('.')?;
    if stem.is_empty() {
        return None;
    }
    Some(ext.to_ascii_lowercase())
}

pub fn asset_kind(path: &str) -> AssetKind {
    AssetKind::from_path(path)
}

/// Removes query/hash, decodes `.`/`..` segments and always returns a leading slash.
pub fn normalize_url(url: &str) -> String {
    let clean = url.split(['?', '#']).next().unwrap_or(url).trim();
    if clean.is_empty() {
        return "/".to_string();
    }
    let absolute = clean.starts_with('/');
    let mut parts: Vec<&str> = Vec::new();
    for part in clean.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            part => parts.push(part),
        }
    }
    let joined = parts.join("/");
    if absolute || clean.starts_with("../") {
        format!("/{joined}")
    } else {
        joined
    }
}

/// Resolves an asset URL relative to the HTML/JS/CSS file that references it.
///
/// The returned value is a normalized, root relative output path without a
/// leading slash (for example `assets/app.js`).
pub fn resolve_ref(from_file: &str, reference: &str, base: &str) -> Option<String> {
    let clean = reference.split(['?', '#']).next()?.trim();
    if clean.is_empty()
        || clean.starts_with("data:")
        || clean.starts_with("mailto:")
        || clean.starts_with("tel:")
        || clean.starts_with("javascript:")
        || clean.starts_with("blob:")
        || clean.starts_with("//")
        || clean.starts_with("http://")
        || clean.starts_with("https://")
    {
        return None;
    }
    let base = base.trim_end_matches('/');
    let clean = if !base.is_empty() && clean.starts_with(base) {
        &clean[base.len()..]
    } else {
        clean
    };
    let joined = if clean.starts_with('/') {
        clean.trim_start_matches('/').to_string()
    } else {
        let parent = from_file.rsplit_once('/').map(|(p, _)| p).unwrap_or("");
        if parent.is_empty() {
            clean.to_string()
        } else {
            format!("{parent}/{clean}")
        }
    };
    Some(normalize_url(&joined).trim_start_matches('/').to_string())
}

/// Output paths are normalized to forward slashes so reports are stable on Windows.
pub fn output_path(path: &Path) -> String {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::ParentDir => parts.push("..".to_string()),
            _ => {}
        }
    }
    parts.join("/")
}

pub fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(output_path)
        .unwrap_or_else(|_| output_path(path))
}

pub fn join_path(root: &Path, relative: &str) -> PathBuf {
    let mut out = root.to_path_buf();
    for part in relative.split('/') {
        if !part.is_empty() && part != "." {
            out.push(part);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_urls() {
        assert_eq!(normalize_url("/a/b/../c.js?x=1#y"), "/a/c.js");
        assert_eq!(normalize_url("assets//app.js"), "assets/app.js");
        assert_eq!(normalize_url(""), "/");
        assert_eq!(normalize_url("../../x"), "/x");
    }

    #[test]
    fn resolves_relative_assets() {
        assert_eq!(
            resolve_ref("guide/index.html", "../assets/app.js", "/"),
            Some("assets/app.js".to_string())
        );
        assert_eq!(
            resolve_ref("index.html", "/docs/assets/app.css", "/docs"),
            Some("assets/app.css".to_string())
        );
        assert_eq!(
            resolve_ref("assets/a.js", "./b.js", "/"),
            Some("assets/b.js".to_string())
        );
        assert_eq!(resolve_ref("index.html", "https://x.test/a.js", "/"), None);
        assert_eq!(resolve_ref("index.html", "data:text/plain,x", "/"), None);
        assert_eq!(resolve_ref("index.html", "#hash", "/"), None);
    }

    #[test]
    fn classifies_assets() {
        assert_eq!(asset_kind("a.HTML"), AssetKind::Html);
        assert_eq!(asset_kind("a.mjs"), AssetKind::JavaScript);
        assert_eq!(asset_kind("f.woff2"), AssetKind::Font);
        assert_eq!(asset_kind("x.unknown"), AssetKind::Other);
        assert_eq!(extension("a/b.tar.gz"), Some("gz".to_string()));
    }

    #[test]
    fn output_paths_use_forward_slashes() {
        assert_eq!(
            relative_path(Path::new("out"), Path::new("out/a/b.js")),
            "a/b.js"
        );
    }
}
