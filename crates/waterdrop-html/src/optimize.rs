use crate::tokenizer::{is_block, is_void, scan, serialize_tag, Tag, Token};
use std::collections::HashSet;
use waterdrop_core::{escape_html, resolve_ref};
use waterdrop_css::minify as minify_css;
use waterdrop_js::{minify as minify_js, MinifyOptions};

#[derive(Debug, Clone)]
pub struct OptimizeOptions {
    pub minify: bool,
    pub remove_comments: bool,
    pub lazy_images: bool,
    pub lazy_iframes: bool,
    pub eager_images: usize,
    pub priority_images: usize,
    pub decode_async: bool,
    pub drop_nomodule: bool,
    pub dedupe_hints: bool,
    /// Remove preload/modulepreload/prefetch hints that point at missing files.
    pub prune_missing: bool,
    /// Known output files (root relative, no leading slash).
    pub assets: Vec<String>,
    pub page: String,
    pub base: String,
    pub inject_modulepreload: Vec<String>,
    pub inject_head: String,
    pub inject_body_end: String,
    pub minify_inline_js: bool,
    pub minify_inline_css: bool,
}

impl Default for OptimizeOptions {
    fn default() -> Self {
        Self {
            minify: true,
            remove_comments: true,
            lazy_images: true,
            lazy_iframes: true,
            eager_images: 2,
            priority_images: 1,
            decode_async: true,
            drop_nomodule: false,
            dedupe_hints: true,
            prune_missing: true,
            assets: Vec::new(),
            page: "index.html".to_string(),
            base: "/".to_string(),
            inject_modulepreload: Vec::new(),
            inject_head: String::new(),
            inject_body_end: String::new(),
            minify_inline_js: true,
            minify_inline_css: true,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct OptimizeResult {
    pub html: String,
    pub removed_comments: usize,
    pub removed_tags: usize,
    pub pruned_hints: usize,
    pub lazy_images: usize,
    pub lazy_iframes: usize,
    pub added_attributes: usize,
    pub injected_preloads: usize,
    pub duplicate_hints: usize,
    pub inline_scripts_minified: usize,
    pub inline_styles_minified: usize,
    pub bytes_before: usize,
    pub bytes_after: usize,
}

pub fn optimize(html: &str, options: &OptimizeOptions) -> OptimizeResult {
    let tokens = scan(html);
    let mut result = OptimizeResult {
        bytes_before: html.len(),
        ..Default::default()
    };
    let assets: HashSet<&str> = options.assets.iter().map(String::as_str).collect();
    let mut out = String::with_capacity(html.len());
    let mut seen_links: HashSet<String> = HashSet::new();
    let mut last_tag: Option<String> = None;
    let mut preserve_ws = 0usize;
    let mut in_noscript = 0usize;
    let mut images_seen = 0usize;
    let mut injected_head = false;
    let mut injected_body = false;
    let mut modulepreloads: HashSet<String> = HashSet::new();
    let mut skip_nomodule = false;
    let mut raw_tag: Option<String> = None;
    let mut raw_script_type: Option<String> = None;

    for (index, token) in tokens.iter().enumerate() {
        match token {
            Token::Text(text) => {
                if skip_nomodule {
                    continue;
                }
                if preserve_ws > 0 {
                    out.push_str(text);
                } else if options.minify {
                    let next = next_tag_name(&tokens, index);
                    match whitespace_only_text(text, last_tag.as_deref(), next.as_deref()) {
                        Some(value) => out.push_str(value),
                        None => out.push_str(&collapse_ws(text)),
                    }
                } else {
                    out.push_str(text);
                }
            }
            Token::Comment(comment) => {
                if !options.remove_comments || keep_comment(comment) {
                    out.push_str(comment);
                } else {
                    result.removed_comments += 1;
                }
            }
            Token::Doctype(doctype) => {
                if options.minify && doctype.eq_ignore_ascii_case("<!doctype html>") {
                    out.push_str("<!doctype html>");
                } else {
                    out.push_str(doctype);
                }
            }
            Token::Start(tag) => {
                let name = tag.name.to_ascii_lowercase();
                if skip_nomodule {
                    if name == "script" {
                        raw_tag = Some(name);
                    }
                    continue;
                }
                if name == "script" && options.drop_nomodule && tag.has("nomodule") {
                    skip_nomodule = true;
                    result.removed_tags += 1;
                    raw_tag = Some(name);
                    continue;
                }
                if name == "script" {
                    raw_script_type = tag.attr("type").map(|value| value.to_ascii_lowercase());
                }
                if is_raw_text_tag(&name) {
                    raw_tag = Some(name.clone());
                }
                if name == "pre" || name == "textarea" {
                    preserve_ws += 1;
                }
                if name == "noscript" {
                    in_noscript += 1;
                }

                if options.dedupe_hints && name == "link" {
                    if let Some(key) = hint_key(tag) {
                        if !seen_links.insert(key.clone()) {
                            result.duplicate_hints += 1;
                            result.removed_tags += 1;
                            last_tag = Some(name);
                            continue;
                        }
                    }
                }
                if options.prune_missing && name == "link" && is_hint(tag) {
                    if let Some(href) = tag.attr("href") {
                        if !hint_target_exists(href, &options.page, &options.base, &assets) {
                            result.pruned_hints += 1;
                            result.removed_tags += 1;
                            last_tag = Some(name);
                            continue;
                        }
                    }
                }

                let mut tag = tag.clone();
                if options.minify && is_void(&name) {
                    tag.self_closing = false;
                }
                if options.minify {
                    strip_noise_attributes(&mut tag, &name, &mut result);
                }
                if name == "img" && in_noscript == 0 {
                    images_seen += 1;
                    let lazy = images_seen > options.eager_images.max(1);
                    if lazy && options.lazy_images && !tag.has("loading") {
                        tag.set("loading", Some("lazy"));
                        result.lazy_images += 1;
                    }
                    if options.decode_async
                        && !tag.has("decoding")
                        && tag.set_if_missing("decoding", Some("async"))
                    {
                        result.added_attributes += 1;
                    }
                    if !lazy
                        && images_seen <= options.priority_images
                        && !tag.has("fetchpriority")
                        && tag.set_if_missing("fetchpriority", Some("high"))
                    {
                        result.added_attributes += 1;
                    }
                }
                if name == "iframe"
                    && in_noscript == 0
                    && options.lazy_iframes
                    && !tag.has("loading")
                    && tag.set_if_missing("loading", Some("lazy"))
                {
                    result.lazy_iframes += 1;
                }
                if name == "link" {
                    if let Some(rel) = tag.attr("rel") {
                        if rel.eq_ignore_ascii_case("modulepreload") {
                            if let Some(href) = tag.attr("href") {
                                modulepreloads.insert(href.to_string());
                            }
                        }
                    }
                }
                out.push_str(&serialize_tag(&tag));
                last_tag = Some(name);
            }
            Token::End { name } => {
                let lower = name.to_ascii_lowercase();
                if skip_nomodule {
                    if lower == "script" {
                        skip_nomodule = false;
                        raw_tag = None;
                    }
                    continue;
                }
                if lower == "head" && !injected_head && !options.inject_head.is_empty() {
                    out.push_str(&options.inject_head);
                    injected_head = true;
                }
                if lower == "body" && !injected_body && !options.inject_body_end.is_empty() {
                    out.push_str(&options.inject_body_end);
                    injected_body = true;
                }
                if lower == "head" {
                    inject_modulepreloads(
                        &mut out,
                        &options.inject_modulepreload,
                        &mut modulepreloads,
                        &mut result,
                    );
                    injected_head = true;
                }
                if is_raw_text_tag(&lower) {
                    raw_tag = None;
                }
                if (lower == "pre" || lower == "textarea") && preserve_ws > 0 {
                    preserve_ws -= 1;
                }
                if lower == "noscript" && in_noscript > 0 {
                    in_noscript -= 1;
                }
                out.push_str("</");
                out.push_str(name);
                out.push('>');
                last_tag = Some(lower);
            }
            Token::Raw(content) => {
                if skip_nomodule {
                    continue;
                }
                let tag = raw_tag.clone().unwrap_or_default();
                if tag == "script" {
                    if options.minify
                        && options.minify_inline_js
                        && is_javascript_script(raw_script_type.as_deref())
                    {
                        let minified = minify_js(
                            content,
                            &MinifyOptions {
                                safe: true,
                                strip_source_maps: true,
                                ..MinifyOptions::default()
                            },
                        )
                        .code;
                        if minified.len() < content.len() {
                            result.inline_scripts_minified += 1;
                            out.push_str(&minified);
                        } else {
                            out.push_str(content);
                        }
                    } else {
                        out.push_str(content);
                    }
                } else if tag == "style" {
                    if options.minify && options.minify_inline_css {
                        let minified = minify_css(content);
                        if minified.len() < content.len() {
                            result.inline_styles_minified += 1;
                            out.push_str(&minified);
                        } else {
                            out.push_str(content);
                        }
                    } else {
                        out.push_str(content);
                    }
                } else {
                    out.push_str(content);
                }
            }
        }
    }

    if !injected_head {
        if !options.inject_head.is_empty() {
            out.insert_str(0, &options.inject_head);
        }
        inject_modulepreloads(
            &mut out,
            &options.inject_modulepreload,
            &mut modulepreloads,
            &mut result,
        );
    }
    if !injected_body && !options.inject_body_end.is_empty() {
        out.push_str(&options.inject_body_end);
    }
    result.bytes_after = out.len();
    result.html = out;
    result
}

fn inject_modulepreloads(
    out: &mut String,
    urls: &[String],
    seen: &mut HashSet<String>,
    result: &mut OptimizeResult,
) {
    if urls.is_empty() {
        return;
    }
    let mut injected = String::new();
    for url in urls {
        if url.is_empty() || !seen.insert(url.clone()) {
            continue;
        }
        injected.push_str("<link rel=\"modulepreload\" href=\"");
        injected.push_str(&escape_html(url));
        injected.push_str("\">");
        result.injected_preloads += 1;
    }
    if !injected.is_empty() {
        out.push_str(&injected);
    }
}

fn is_raw_text_tag(name: &str) -> bool {
    matches!(name, "script" | "style" | "textarea" | "title" | "xmp")
}

fn is_javascript_script(script_type: Option<&str>) -> bool {
    match script_type {
        None => true,
        Some(value) => matches!(
            value,
            "" | "module"
                | "text/javascript"
                | "application/javascript"
                | "application/ecmascript"
                | "text/ecmascript"
        ),
    }
}

fn keep_comment(comment: &str) -> bool {
    let lower = comment.to_ascii_lowercase();
    comment.starts_with("<!--!")
        || comment.starts_with("<!--#")
        || lower.starts_with("<!--[if")
        || lower.contains("<!--[endif")
}

fn strip_noise_attributes(tag: &mut Tag, name: &str, result: &mut OptimizeResult) {
    if name == "script" {
        if let Some(kind) = tag.attr("type") {
            if kind.eq_ignore_ascii_case("text/javascript")
                || kind.eq_ignore_ascii_case("application/javascript")
            {
                tag.remove("type");
                result.removed_tags += 1;
            }
        }
    }
    if name == "style" {
        if let Some(kind) = tag.attr("type") {
            if kind.eq_ignore_ascii_case("text/css") {
                tag.remove("type");
                result.removed_tags += 1;
            }
        }
    }
}

fn hint_key(tag: &Tag) -> Option<String> {
    let rel = tag.attr("rel")?;
    if !is_hint(tag) {
        return None;
    }
    let href = tag.attr("href")?;
    Some(format!("{}|{}", rel.to_ascii_lowercase(), href))
}

fn is_hint(tag: &Tag) -> bool {
    tag.attr("rel")
        .map(|rel| {
            rel.split_whitespace().any(|part| {
                matches!(
                    part.to_ascii_lowercase().as_str(),
                    "preload" | "modulepreload" | "prefetch" | "preconnect" | "dns-prefetch"
                )
            })
        })
        .unwrap_or(false)
}

fn hint_target_exists(url: &str, page: &str, base: &str, assets: &HashSet<&str>) -> bool {
    if assets.is_empty() {
        return true;
    }
    let Some(resolved) = resolve_ref(page, url, base) else {
        return true;
    };
    if assets.contains(resolved.as_str()) {
        return true;
    }
    // Next.js serves `/_next/*` from `.next/*`; accept the stripped variant.
    for prefix in ["_next/", "next/"] {
        if let Some(stripped) = resolved.strip_prefix(prefix) {
            if assets.contains(stripped) {
                return true;
            }
        }
    }
    false
}

fn next_tag_name(tokens: &[Token], index: usize) -> Option<String> {
    for token in tokens.iter().skip(index + 1) {
        match token {
            Token::Start(tag) => return Some(tag.name.to_ascii_lowercase()),
            Token::End { name } => return Some(name.to_ascii_lowercase()),
            Token::Comment(_) => continue,
            Token::Text(text) if text.trim().is_empty() => continue,
            _ => return None,
        }
    }
    None
}

fn whitespace_only_text(
    text: &str,
    previous: Option<&str>,
    next: Option<&str>,
) -> Option<&'static str> {
    if !text.chars().all(char::is_whitespace) {
        return None;
    }
    let prev_block = previous.map(is_block).unwrap_or(true);
    let next_block = next.map(is_block).unwrap_or(true);
    if prev_block || next_block {
        Some("")
    } else {
        Some(" ")
    }
}

fn collapse_ws(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_space = false;
    for ch in text.chars() {
        if ch.is_whitespace() {
            if !in_space {
                out.push(' ');
                in_space = true;
            }
        } else {
            out.push(ch);
            in_space = false;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_options() -> OptimizeOptions {
        OptimizeOptions {
            assets: vec![
                "assets/app.js".to_string(),
                "assets/app.css".to_string(),
                "assets/vendor.js".to_string(),
                "a.png".to_string(),
                "v".to_string(),
            ],
            ..OptimizeOptions::default()
        }
    }

    #[test]
    fn minifies_whitespace_without_joining_inline_text() {
        let html = "<html>\n  <body>\n    <div>\n      <span>Hello</span> <span>world</span>\n    </div>\n  </body>\n</html>";
        let out = optimize(html, &base_options()).html;
        assert_eq!(
            out,
            "<html><body><div><span>Hello</span> <span>world</span></div></body></html>"
        );
    }

    #[test]
    fn lazy_loads_only_images_below_the_fold() {
        let html = r#"<body><img src="a.png"><img src="b.png"><img src="c.png" loading="eager"><noscript><img src="d.png"></noscript></body>"#;
        let out = optimize(html, &base_options()).html;
        assert!(out.contains(r#"<img src="a.png" decoding="async" fetchpriority="high">"#));
        assert!(out.contains(r#"<img src="b.png" decoding="async">"#));
        assert!(out.contains(r#"<img src="c.png" loading="eager" decoding="async">"#));
        assert!(out.contains(r#"<noscript><img src="d.png"></noscript>"#));
    }

    #[test]
    fn prunes_stale_hints_and_dedupes() {
        let html = r#"<head><link rel="preload" as="script" href="/assets/app.js"><link rel="preload" as="script" href="/assets/app.js"><link rel="preload" as="script" href="/assets/gone.js"><link rel="stylesheet" href="/assets/app.css"></head>"#;
        let out = optimize(html, &base_options());
        assert_eq!(out.pruned_hints, 1);
        assert_eq!(out.duplicate_hints, 1);
        assert_eq!(out.html.matches("app.js").count(), 1);
        assert!(out.html.contains("app.css"));
        assert!(!out.html.contains("gone.js"));
    }

    #[test]
    fn injects_modulepreloads_once() {
        let mut options = base_options();
        options.inject_modulepreload = vec!["/assets/vendor.js".into(), "/assets/app.js".into()];
        let first = optimize("<head></head><body></body>", &options);
        assert_eq!(first.injected_preloads, 2);
        assert!(first.html.contains(r#"href="/assets/vendor.js""#));
        let second = optimize(&first.html, &options);
        assert_eq!(second.injected_preloads, 0);
        assert_eq!(second.html.matches("vendor.js").count(), 1);
    }

    #[test]
    fn drops_legacy_nomodule_scripts() {
        let mut options = base_options();
        options.drop_nomodule = true;
        let out = optimize(
            r#"<head><script nomodule src="/assets/legacy.js"></script><script type="module" src="/assets/app.js"></script></head>"#,
            &options,
        );
        assert!(!out.html.contains("legacy.js"));
        assert!(out.html.contains("app.js"));
    }

    #[test]
    fn preserves_raw_text_and_pre() {
        let html = "<script>const x = 1;\n// hi\nconsole.log(x);</script><pre>  a\n  b</pre><textarea> x </textarea>";
        let out = optimize(html, &base_options()).html;
        assert!(out.contains("const x"));
        assert!(!out.contains("const x = 1;"));
        assert!(out.contains("<pre>  a\n  b</pre>"));
        assert!(out.contains("<textarea> x </textarea>"));
        assert!(!out.contains("// hi"));
    }

    #[test]
    fn removes_comments_but_keeps_conditional() {
        let html = "<!-- normal --><!--[if IE]><p>x</p><![endif]--><!--! keep -->";
        let out = optimize(html, &base_options()).html;
        assert!(!out.contains("normal"));
        assert!(out.contains("[if IE]"));
        assert!(out.contains("<!--! keep -->"));
    }

    #[test]
    fn is_idempotent() {
        let html = r#"<!DOCTYPE html><html><head><link rel="preload" href="/assets/app.js"><script type="module" src="/assets/app.js"></script></head><body><img src="a.png"><p>hello   world</p></body></html>"#;
        let once = optimize(html, &base_options()).html;
        let twice = optimize(&once, &base_options()).html;
        assert_eq!(once, twice);
    }
}
