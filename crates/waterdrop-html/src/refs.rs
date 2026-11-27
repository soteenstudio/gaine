use crate::tokenizer::{scan, Tag, Token};
use waterdrop_core::unescape_html;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RefKind {
    Script,
    ModuleScript,
    Stylesheet,
    Preload,
    ModulePreload,
    Prefetch,
    Image,
    Iframe,
    Font,
    Media,
    Manifest,
    CssUrl,
}

impl RefKind {
    pub fn as_str(self) -> &'static str {
        match self {
            RefKind::Script => "script",
            RefKind::ModuleScript => "module",
            RefKind::Stylesheet => "stylesheet",
            RefKind::Preload => "preload",
            RefKind::ModulePreload => "modulepreload",
            RefKind::Prefetch => "prefetch",
            RefKind::Image => "image",
            RefKind::Iframe => "iframe",
            RefKind::Font => "font",
            RefKind::Media => "media",
            RefKind::Manifest => "manifest",
            RefKind::CssUrl => "css-url",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssetReference {
    pub url: String,
    pub kind: RefKind,
    pub tag: String,
    pub attr: String,
}

impl AssetReference {
    fn new(url: &str, kind: RefKind, tag: &str, attr: &str) -> Option<Self> {
        let url = unescape_html(url.trim());
        if url.is_empty() {
            return None;
        }
        Some(Self {
            url,
            kind,
            tag: tag.to_ascii_lowercase(),
            attr: attr.to_string(),
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct InlineScript {
    pub script_type: Option<String>,
    pub module: bool,
    pub code: String,
}

#[derive(Debug, Clone, Default)]
pub struct HtmlAnalysis {
    pub references: Vec<AssetReference>,
    pub module_scripts: Vec<String>,
    pub nomodule_scripts: Vec<String>,
    pub inline_scripts: Vec<InlineScript>,
    pub inline_styles: Vec<String>,
    pub classes: Vec<String>,
    pub ids: Vec<String>,
    pub tags: Vec<String>,
    pub preloads: Vec<String>,
    pub speculation_rules: usize,
}

impl HtmlAnalysis {
    pub fn classes_set(&self) -> Vec<String> {
        self.classes.clone()
    }

    pub fn has_module(&self) -> bool {
        !self.module_scripts.is_empty() || self.inline_scripts.iter().any(|script| script.module)
    }
}

pub fn analyze(html: &str) -> HtmlAnalysis {
    let tokens = scan(html);
    let mut out = HtmlAnalysis::default();
    let mut pending_script: Option<InlineScript> = None;
    let mut pending_style: Option<String> = None;

    for token in &tokens {
        match token {
            Token::Start(tag) => {
                let name = tag.name.to_ascii_lowercase();
                out.tags.push(name.clone());
                if let Some(class) = tag.attr("class") {
                    for item in class.split_whitespace() {
                        if !out.classes.iter().any(|c| c == item) {
                            out.classes.push(item.to_string());
                        }
                    }
                }
                if let Some(id) = tag.attr("id") {
                    if !out.ids.iter().any(|item| item == id) {
                        out.ids.push(id.to_string());
                    }
                }
                collect_tag_refs(tag, &mut out);

                if name == "script" {
                    let script_type = tag.attr("type").map(ToOwned::to_owned);
                    let script_module = tag.has_value("type", "module");
                    let script_src = tag.has("src");
                    if tag.has("nomodule") {
                        if let Some(src) = tag.attr("src") {
                            out.nomodule_scripts.push(src.to_string());
                        }
                    } else if script_module {
                        if let Some(src) = tag.attr("src") {
                            out.module_scripts.push(src.to_string());
                        }
                    }
                    if script_type
                        .as_deref()
                        .map(|value| value.eq_ignore_ascii_case("speculationrules"))
                        .unwrap_or(false)
                    {
                        out.speculation_rules += 1;
                    }
                    if !script_src {
                        pending_script = Some(InlineScript {
                            script_type: script_type.clone(),
                            module: script_module,
                            code: String::new(),
                        });
                    }
                } else if name.eq_ignore_ascii_case("style") {
                    pending_style = Some(String::new());
                }
                for attr in &tag.attrs {
                    if attr.is("style") {
                        if let Some(css) = &attr.value {
                            for url in css_urls(css) {
                                if let Some(reference) =
                                    AssetReference::new(&url, RefKind::CssUrl, &name, "style")
                                {
                                    out.references.push(reference);
                                }
                            }
                        }
                    }
                }
            }
            Token::Raw(content) => {
                if let Some(script) = pending_script.as_mut() {
                    script.code.push_str(content);
                } else if let Some(style) = pending_style.as_mut() {
                    style.push_str(content);
                }
            }
            Token::End { name } => {
                if name.eq_ignore_ascii_case("script") {
                    if let Some(script) = pending_script.take() {
                        if !script.code.trim().is_empty() {
                            out.inline_scripts.push(script);
                        }
                    }
                } else if name == "style" {
                    if let Some(style) = pending_style.take() {
                        out.inline_styles.push(style);
                    }
                }
            }
            Token::Text(_) | Token::Comment(_) | Token::Doctype(_) => {}
        }
    }
    out
}

pub fn css_urls(css: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = css.as_bytes();
    let mut index = 0usize;
    while index + 4 <= bytes.len() {
        if bytes[index..index + 4].eq_ignore_ascii_case(b"url(") {
            let mut start = index + 4;
            while start < bytes.len() && bytes[start].is_ascii_whitespace() {
                start += 1;
            }
            let (value, end) = match bytes.get(start) {
                Some(quote @ (b'"' | b'\'')) => {
                    let quote = *quote;
                    let value_start = start + 1;
                    let mut cursor = value_start;
                    while cursor < bytes.len() && bytes[cursor] != quote {
                        cursor += 1;
                    }
                    (
                        css[value_start..cursor.min(bytes.len())].to_string(),
                        (cursor + 1).min(bytes.len()),
                    )
                }
                _ => {
                    let mut cursor = start;
                    while cursor < bytes.len() && bytes[cursor] != b')' {
                        cursor += 1;
                    }
                    (css[start..cursor].trim().to_string(), cursor + 1)
                }
            };
            if !value.is_empty() {
                out.push(value);
            }
            index = end;
        } else {
            index += 1;
        }
    }
    out
}

fn collect_tag_refs(tag: &Tag, out: &mut HtmlAnalysis) {
    let name = tag.name.to_ascii_lowercase();
    match name.as_str() {
        "script" => {
            if let Some(src) = tag.attr("src") {
                if !tag.has("nomodule") {
                    let kind = if tag.has_value("type", "module") {
                        RefKind::ModuleScript
                    } else {
                        RefKind::Script
                    };
                    push(out, src, kind, "script", "src");
                }
            }
        }
        "link" => {
            let rel = tag
                .attr("rel")
                .unwrap_or("")
                .to_ascii_lowercase()
                .split_whitespace()
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>();
            let Some(href) = tag.attr("href") else {
                return;
            };
            let kind = if rel.iter().any(|r| r == "stylesheet") {
                Some(RefKind::Stylesheet)
            } else if rel.iter().any(|r| r == "modulepreload") {
                Some(RefKind::ModulePreload)
            } else if rel.iter().any(|r| r == "preload") {
                Some(
                    match tag.attr("as").unwrap_or("").to_ascii_lowercase().as_str() {
                        "script" => RefKind::Script,
                        "style" => RefKind::Stylesheet,
                        "font" => RefKind::Font,
                        "image" => RefKind::Image,
                        "fetch" | "document" => RefKind::Preload,
                        _ => RefKind::Preload,
                    },
                )
            } else if rel.iter().any(|r| r == "prefetch") {
                Some(RefKind::Prefetch)
            } else if rel.iter().any(|r| r == "manifest") {
                Some(RefKind::Manifest)
            } else {
                None
            };
            if let Some(kind) = kind {
                push(out, href, kind, "link", "href");
                if kind == RefKind::Preload || kind == RefKind::ModulePreload {
                    out.preloads.push(href.to_string());
                }
            }
        }
        "img" | "source" | "video" | "audio" | "iframe" | "embed" | "track" => {
            let kind = if name == "iframe" {
                RefKind::Iframe
            } else if name == "video" || name == "audio" || name == "track" {
                RefKind::Media
            } else {
                RefKind::Image
            };
            for attr in ["src", "poster"] {
                if let Some(url) = tag.attr(attr) {
                    push(out, url, kind, &name, attr);
                }
            }
            if let Some(srcset) = tag.attr("srcset") {
                for candidate in parse_srcset(srcset) {
                    push(out, &candidate, RefKind::Image, &name, "srcset");
                }
            }
        }
        "object" => {
            if let Some(data) = tag.attr("data") {
                push(out, data, RefKind::CssUrl, "object", "data");
            }
        }
        _ => {}
    }
}

fn push(out: &mut HtmlAnalysis, url: &str, kind: RefKind, tag: &str, attr: &str) {
    if let Some(reference) = AssetReference::new(url, kind, tag, attr) {
        out.references.push(reference);
    }
}

pub fn parse_srcset(srcset: &str) -> Vec<String> {
    srcset
        .split(',')
        .filter_map(|part| part.split_whitespace().next())
        .filter(|url| !url.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_asset_references() {
        let analysis = analyze(
            r##"<html><head>
                <link rel="stylesheet" href="/assets/app.css">
                <link rel="modulepreload" href="/assets/vendor.js">
                <link rel="preload" as="font" href="/fonts/a.woff2" crossorigin>
                <script type="module" src="/assets/app.js"></script>
                <script nomodule src="/assets/legacy.js"></script>
                <script type="application/ld+json">{"a":1}</script>
                <style>.a{background:url(/assets/bg.png)}</style>
                </head><body class="hero main" id="top">
                <img src="/a.png" srcset="/a-1.png 1x, /a-2.png 2x">
                <iframe src="/embed"></iframe>
                </body></html>"##,
        );
        let urls: Vec<_> = analysis.references.iter().map(|r| r.url.as_str()).collect();
        assert!(urls.contains(&"/assets/app.css"));
        assert!(urls.contains(&"/assets/vendor.js"));
        assert!(urls.contains(&"/fonts/a.woff2"));
        assert!(urls.contains(&"/assets/app.js"));
        assert!(
            !urls.contains(&"/assets/legacy.js"),
            "nomodule is tracked separately"
        );
        assert!(urls.contains(&"/a-2.png"));
        assert!(urls.contains(&"/embed"));
        assert!(analysis.classes.contains(&"hero".to_string()));
        assert_eq!(analysis.ids, ["top"]);
        assert_eq!(analysis.module_scripts.len(), 1);
        assert_eq!(analysis.nomodule_scripts.len(), 1);
        assert_eq!(analysis.inline_scripts.len(), 1);
        assert!(analysis.inline_scripts[0].code.contains("\"a\":1"));
        assert_eq!(analysis.inline_styles.len(), 1);
    }

    #[test]
    fn parses_srcset_candidates() {
        assert_eq!(
            parse_srcset("a.png 1x, b.png 2x, c.png 100w"),
            ["a.png", "b.png", "c.png"]
        );
    }
}
