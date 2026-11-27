use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct SelectorUsage {
    pub classes: HashSet<String>,
    pub ids: HashSet<String>,
    pub tags: HashSet<String>,
}

impl SelectorUsage {
    pub fn new(
        classes: impl IntoIterator<Item = impl Into<String>>,
        ids: impl IntoIterator<Item = impl Into<String>>,
        tags: impl IntoIterator<Item = impl Into<String>>,
    ) -> Self {
        Self {
            classes: classes.into_iter().map(Into::into).collect(),
            ids: ids.into_iter().map(Into::into).collect(),
            tags: tags
                .into_iter()
                .map(Into::into)
                .map(|tag: String| tag.to_ascii_lowercase())
                .collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CssRule {
    pub selector: String,
    pub start: usize,
    pub end: usize,
    pub body_start: usize,
    pub body_end: usize,
    pub context: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SelectorInfo {
    pub selector: String,
    pub bytes: usize,
    pub used: bool,
    pub context: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CssAnalysis {
    pub selectors: Vec<SelectorInfo>,
    pub used_bytes: usize,
    pub unused_bytes: usize,
    pub keyframes: Vec<String>,
}

pub fn minify(css: &str) -> String {
    let stripped = strip_comments(css);
    let mut out: Vec<u8> = Vec::with_capacity(stripped.len());
    let bytes = stripped.as_slice();
    let mut index = 0usize;
    let mut in_string: Option<u8> = None;
    let mut pending_space = false;

    while index < bytes.len() {
        let byte = bytes[index];
        if let Some(quote) = in_string {
            out.push(byte);
            if byte == b'\\' && index + 1 < bytes.len() {
                index += 1;
                out.push(bytes[index]);
            } else if byte == quote {
                in_string = None;
            }
            index += 1;
            continue;
        }
        if byte == b'/'
            && bytes.get(index + 1) == Some(&b'*')
            && bytes.get(index + 2) == Some(&b'!')
        {
            if pending_space && needs_space_before(&out, b'/') {
                out.push(b' ');
            }
            let end = bytes[index + 2..]
                .windows(2)
                .position(|window| window == b"*/")
                .map(|offset| index + 2 + offset + 2)
                .unwrap_or(bytes.len());
            out.extend_from_slice(&bytes[index..end]);
            pending_space = false;
            index = end;
            continue;
        }
        match byte {
            b'"' | b'\'' => {
                if pending_space && needs_space_before(&out, byte) {
                    out.push(b' ');
                }
                pending_space = false;
                in_string = Some(byte);
                out.push(byte);
                index += 1;
            }
            b' ' | b'\t' | b'\r' | b'\n' | 0x0c => {
                pending_space = true;
                index += 1;
            }
            b'{' | b'}' | b';' | b',' | b':' | b'>' | b'(' | b')' | b'!' => {
                let keep_paren_space =
                    byte == b'(' && pending_space && keeps_space_before_paren(&out);
                while out.last() == Some(&b' ') {
                    out.pop();
                }
                if keep_paren_space {
                    out.push(b' ');
                }
                out.push(byte);
                pending_space = false;
                index += 1;
            }
            _ => {
                if pending_space && needs_space_before(&out, byte) {
                    out.push(b' ');
                }
                pending_space = false;
                out.push(byte);
                index += 1;
            }
        }
    }
    while out.last() == Some(&b' ') {
        out.pop();
    }
    let out = remove_last_semicolons(&out);
    String::from_utf8(out)
        .unwrap_or_else(|error| String::from_utf8_lossy(error.as_bytes()).into_owned())
}

fn needs_space_before(out: &[u8], next: u8) -> bool {
    let Some(prev) = out.last().copied() else {
        return false;
    };
    if matches!(
        prev,
        b'{' | b'}' | b';' | b',' | b':' | b'(' | b')' | b'>' | b'!'
    ) {
        return false;
    }
    if next == b'!' {
        return false;
    }
    // Keep spaces around operators such as `+` and `-` (calc, selectors with `~`).
    !matches!(prev, b'/' | b'*')
}

fn keeps_space_before_paren(out: &[u8]) -> bool {
    let mut start = out.len();
    while start > 0 && is_ident(out[start - 1]) {
        start -= 1;
    }
    if start == out.len() {
        return false;
    }
    let word = String::from_utf8_lossy(&out[start..]).to_ascii_lowercase();
    matches!(
        word.as_str(),
        "and"
            | "or"
            | "not"
            | "only"
            | "media"
            | "supports"
            | "container"
            | "layer"
            | "scope"
            | "document"
            | "starting-style"
    )
}

fn remove_last_semicolons(css: &[u8]) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::with_capacity(css.len());
    let mut index = 0usize;
    let mut in_string: Option<u8> = None;
    while index < css.len() {
        let byte = css[index];
        if let Some(quote) = in_string {
            out.push(byte);
            if byte == b'\\' && index + 1 < css.len() {
                index += 1;
                out.push(css[index]);
            } else if byte == quote {
                in_string = None;
            }
            index += 1;
            continue;
        }
        if byte == b'"' || byte == b'\'' {
            in_string = Some(byte);
            out.push(byte);
        } else if byte == b'}' {
            while out.last() == Some(&b';') {
                out.pop();
            }
            out.push(b'}');
        } else {
            out.push(byte);
        }
        index += 1;
    }
    out
}

fn strip_comments(css: &str) -> Vec<u8> {
    let bytes = css.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(css.len());
    let mut index = 0usize;
    let mut in_string: Option<u8> = None;
    while index < bytes.len() {
        let byte = bytes[index];
        if let Some(quote) = in_string {
            out.push(byte);
            if byte == b'\\' && index + 1 < bytes.len() {
                index += 1;
                out.push(bytes[index]);
            } else if byte == quote {
                in_string = None;
            }
            index += 1;
            continue;
        }
        if byte == b'"' || byte == b'\'' {
            in_string = Some(byte);
            out.push(byte);
            index += 1;
        } else if byte == b'/' && index + 1 < bytes.len() && bytes[index + 1] == b'*' {
            let end = css[index + 2..]
                .find("*/")
                .map(|offset| index + 2 + offset + 2)
                .unwrap_or(bytes.len());
            let comment = &css.as_bytes()[index..end];
            if comment.starts_with(b"/*!") {
                out.extend_from_slice(comment);
            } else {
                out.push(b' ');
            }
            index = end;
        } else {
            out.push(byte);
            index += 1;
        }
    }
    out
}

pub fn rules(css: &str) -> Vec<CssRule> {
    let mut out = Vec::new();
    let mut context = Vec::new();
    parse_block(css, 0, css.len(), &mut context, &mut out);
    out
}

fn parse_block(
    css: &str,
    start: usize,
    end: usize,
    context: &mut Vec<String>,
    out: &mut Vec<CssRule>,
) {
    let bytes = css.as_bytes();
    let mut index = start;
    let mut statement_start = start;
    let mut in_string: Option<u8> = None;
    while index < end {
        let byte = bytes[index];
        if let Some(quote) = in_string {
            if byte == b'\\' {
                index += 2;
            } else {
                if byte == quote {
                    in_string = None;
                }
                index += 1;
            }
            continue;
        }
        match byte {
            b'"' | b'\'' => {
                in_string = Some(byte);
                index += 1;
            }
            b'/' if index + 1 < end && bytes[index + 1] == b'*' => {
                index = css[index + 2..end]
                    .find("*/")
                    .map(|offset| index + 2 + offset + 2)
                    .unwrap_or(end);
            }
            b'{' => {
                let prelude = css[statement_start..index].trim();
                let body_start = index + 1;
                let close = find_matching_brace(css, index, end);
                let body_end = close;
                if prelude.starts_with('@') {
                    let name = prelude
                        .split_whitespace()
                        .next()
                        .unwrap_or("@")
                        .to_ascii_lowercase();
                    let recursive = matches!(
                        name.as_str(),
                        "@media" | "@supports" | "@layer" | "@container" | "@scope" | "@document"
                    );
                    if recursive {
                        context.push(prelude.to_string());
                        parse_block(css, body_start, body_end, context, out);
                        context.pop();
                    }
                } else if !prelude.is_empty() {
                    out.push(CssRule {
                        selector: prelude.to_string(),
                        start: statement_start,
                        end: (close + 1).min(end),
                        body_start,
                        body_end,
                        context: context.clone(),
                    });
                }
                index = (close + 1).min(end);
                statement_start = index;
            }
            b'}' => {
                index += 1;
                statement_start = index;
            }
            b';' => {
                index += 1;
                statement_start = index;
            }
            _ => index += 1,
        }
    }
}

fn find_matching_brace(css: &str, open: usize, end: usize) -> usize {
    let bytes = css.as_bytes();
    let mut depth = 0usize;
    let mut index = open;
    let mut in_string: Option<u8> = None;
    while index < end {
        let byte = bytes[index];
        if let Some(quote) = in_string {
            if byte == b'\\' {
                index += 2;
            } else {
                if byte == quote {
                    in_string = None;
                }
                index += 1;
            }
            continue;
        }
        match byte {
            b'"' | b'\'' => {
                in_string = Some(byte);
                index += 1;
            }
            b'/' if index + 1 < end && bytes[index + 1] == b'*' => {
                index = css[index + 2..end]
                    .find("*/")
                    .map(|offset| index + 2 + offset + 2)
                    .unwrap_or(end);
            }
            b'{' => {
                depth += 1;
                index += 1;
            }
            b'}' => {
                depth -= 1;
                index += 1;
                if depth == 0 {
                    return index - 1;
                }
            }
            _ => index += 1,
        }
    }
    end.saturating_sub(1)
}

/// Extracts `url(...)` and `@import` targets from a stylesheet.
pub fn asset_urls(css: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = css.as_bytes();
    let mut index = 0usize;
    while index < bytes.len() {
        if bytes[index..].len() >= 4 && bytes[index..index + 4].eq_ignore_ascii_case(b"url(") {
            let mut cursor = index + 4;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if let Some(quote @ (b'"' | b'\'')) = bytes.get(cursor).copied() {
                let start = cursor + 1;
                let mut end = start;
                while end < bytes.len() && bytes[end] != quote {
                    end += 1;
                }
                if end > start {
                    out.push(css[start..end].to_string());
                }
                index = end + 1;
            } else {
                let start = cursor;
                while cursor < bytes.len() && bytes[cursor] != b')' {
                    cursor += 1;
                }
                let value = css[start..cursor].trim();
                if !value.is_empty() {
                    out.push(value.to_string());
                }
                index = cursor + 1;
            }
            continue;
        }
        if bytes[index..].len() >= 7 && bytes[index..index + 7].eq_ignore_ascii_case(b"@import") {
            let mut cursor = index + 7;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if let Some(quote @ (b'"' | b'\'')) = bytes.get(cursor).copied() {
                let start = cursor + 1;
                let mut end = start;
                while end < bytes.len() && bytes[end] != quote {
                    end += 1;
                }
                if end > start {
                    out.push(css[start..end].to_string());
                }
                index = end + 1;
                continue;
            }
        }
        index += 1;
    }
    out
}

pub fn keyframes(css: &str) -> Vec<String> {
    let mut names = Vec::new();
    let lower = css.to_ascii_lowercase();
    let mut search = 0usize;
    while let Some(offset) = lower[search..].find("@keyframes") {
        let start = search + offset + "@keyframes".len();
        let rest = &css[start..];
        let name = rest
            .trim_start()
            .split(|ch: char| ch.is_whitespace() || ch == '{')
            .next()
            .unwrap_or("")
            .trim();
        if !name.is_empty() {
            names.push(name.to_string());
        }
        search = start;
    }
    names
}

pub fn analyze(css: &str, usage: &SelectorUsage) -> CssAnalysis {
    let keyframes = keyframes(css);
    let mut analysis = CssAnalysis::default();
    for rule in rules(css) {
        let used = selector_used(&rule.selector, usage);
        let bytes = rule.end.saturating_sub(rule.start);
        if used {
            analysis.used_bytes += bytes;
        } else {
            analysis.unused_bytes += bytes;
        }
        analysis.selectors.push(SelectorInfo {
            selector: rule.selector,
            bytes,
            used,
            context: rule.context,
        });
    }
    analysis.keyframes = keyframes;
    analysis
}

pub fn selector_used(selector: &str, usage: &SelectorUsage) -> bool {
    selector.split(',').any(|part| {
        let part = part.trim();
        if part.is_empty() {
            return true;
        }
        if part.contains(":root") || part == "*" || part == "html" || part == "body" {
            return true;
        }
        let (classes, ids, tags) = selector_parts(part);
        let classes_ok = classes.iter().all(|class| usage.classes.contains(class));
        let ids_ok = ids.iter().all(|id| usage.ids.contains(id));
        if !classes.is_empty() || !ids.is_empty() {
            return classes_ok && ids_ok;
        }
        if part.contains('[') {
            // Attribute selectors can be toggled from JavaScript; keep them.
            return true;
        }
        tags.iter().any(|tag| usage.tags.contains(tag))
    })
}

fn selector_parts(selector: &str) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut classes = Vec::new();
    let mut ids = Vec::new();
    let mut tags = Vec::new();
    let bytes = selector.as_bytes();
    let mut index = 0usize;
    let mut start_of_compound = true;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == b'\\' {
            index += 2;
            continue;
        }
        if byte == b'.' || byte == b'#' {
            let kind = byte;
            index += 1;
            let start = index;
            while index < bytes.len() && is_ident(bytes[index]) {
                index += 1;
            }
            if index > start {
                let name = selector[start..index].to_string();
                if kind == b'.' {
                    classes.push(name);
                } else {
                    ids.push(name);
                }
            }
            start_of_compound = false;
            continue;
        }
        if is_ident(byte) && start_of_compound {
            let start = index;
            while index < bytes.len() && is_ident(bytes[index]) {
                index += 1;
            }
            tags.push(selector[start..index].to_ascii_lowercase());
            start_of_compound = false;
            continue;
        }
        if matches!(
            byte,
            b' ' | b'>' | b'+' | b'~' | b',' | b'(' | b')' | b'[' | b']'
        ) {
            start_of_compound = true;
        }
        index += 1;
    }
    (classes, ids, tags)
}

fn is_ident(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_')
}

/// Removes rules whose selectors are provably unused. Dynamic classes added by
/// JavaScript cannot be proven unused, so this is opt-in and conservative.
pub fn purge(css: &str, usage: &SelectorUsage) -> (String, usize) {
    let mut removals: Vec<(usize, usize)> = rules(css)
        .into_iter()
        .filter(|rule| !selector_used(&rule.selector, usage))
        .filter(|rule| {
            !rule
                .context
                .iter()
                .any(|context| context.contains("@keyframes"))
        })
        .map(|rule| (rule.start, rule.end))
        .collect();
    removals.sort_by_key(|removal| std::cmp::Reverse(removal.0));
    let mut out = css.to_string();
    let mut removed = 0usize;
    for (start, end) in removals {
        if end <= out.len() && start < end {
            out.replace_range(start..end, "");
            removed += 1;
        }
    }
    (out, removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minifies_css_safely() {
        let css = r#"
        /* comment */
        .a, .b > .c {
            color: red;
            margin: calc(1px + 2px);
            background: url("x y.png");
        }
        @media (min-width: 600px) {
            .a { display: none; }
        }
        "#;
        let out = minify(css);
        assert_eq!(
            out,
            r#".a,.b>.c{color:red;margin:calc(1px + 2px);background:url("x y.png")}@media (min-width:600px){.a{display:none}}"#
        );
        assert!(!out.contains("comment"));
    }

    #[test]
    fn keeps_license_comments() {
        let out = minify("/*! MIT */\n.a { color: red }");
        assert!(out.starts_with("/*! MIT */"));
    }

    #[test]
    fn parses_rules_and_context() {
        let css = "@media (min-width: 1px) { .a { color: red } } .b { color: blue }";
        let rules = rules(css);
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].selector, ".a");
        assert_eq!(rules[0].context, ["@media (min-width: 1px)"]);
        assert_eq!(rules[1].selector, ".b");
    }

    #[test]
    fn analyzes_selector_usage() {
        let usage = SelectorUsage::new(["hero", "nav"], ["top"], ["div", "main", "p"]);
        let css = ".hero { color: red } .missing { color: blue } #top { x: y } main p { z: 1 } @keyframes spin { from { a: b } to { a: c } }";
        let analysis = analyze(css, &usage);
        assert!(analysis
            .selectors
            .iter()
            .any(|s| s.selector == ".hero" && s.used));
        assert!(analysis
            .selectors
            .iter()
            .any(|s| s.selector == ".missing" && !s.used));
        assert!(analysis
            .selectors
            .iter()
            .any(|s| s.selector == "#top" && s.used));
        assert!(analysis.unused_bytes > 0);
        assert_eq!(analysis.keyframes, ["spin"]);
    }

    #[test]
    fn purges_only_unused_rules() {
        let usage = SelectorUsage::new(
            ["used".to_string()],
            Vec::<String>::new(),
            ["div".to_string()],
        );
        let css = ".used{a:b}.dead{c:d}div{e:f}@media (min-width:1px){.dead{g:h}.used{i:j}}";
        let (out, removed) = purge(css, &usage);
        assert_eq!(removed, 2);
        assert!(out.contains(".used"));
        assert!(!out.contains(".dead"));
        assert!(out.contains("div"));
        assert!(out.contains("@media"));
    }

    #[test]
    fn minify_is_idempotent() {
        let css = ".a { color: red; } /* x */ @media (min-width: 1px) { .b { margin: 0 } }";
        let once = minify(css);
        assert_eq!(minify(&once), once);
    }

    #[test]
    fn preserves_strings_with_braces() {
        let out = minify(r#".a{content:"} ; {"}.b{content:'{ x }'}"#);
        assert!(out.contains(r#"content:"} ; {""#));
        assert!(out.contains("content:'{ x }'"));
    }
}
