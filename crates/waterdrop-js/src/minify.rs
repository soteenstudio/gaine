use crate::lexer::{tokenize, Token, TokenKind};

#[derive(Debug, Clone)]
pub struct MinifyOptions {
    pub safe: bool,
    pub strip_source_maps: bool,
    pub keep_license: bool,
}

impl Default for MinifyOptions {
    fn default() -> Self {
        Self {
            safe: true,
            strip_source_maps: true,
            keep_license: true,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct MinifyResult {
    pub code: String,
    pub bytes_before: usize,
    pub bytes_after: usize,
    pub removed_comments: usize,
}

pub fn minify(source: &str, options: &MinifyOptions) -> MinifyResult {
    let source = if options.strip_source_maps {
        strip_source_maps(source)
    } else {
        source.to_string()
    };
    let tokens = tokenize(&source);
    let mut out = String::with_capacity(source.len());
    let mut previous: Option<&Token> = None;
    let mut removed_comments = 0usize;
    let mut first = true;

    for token in &tokens {
        if token.is_comment() {
            let text = token.text(&source);
            let license = options.keep_license
                && (text.starts_with("/*!")
                    || text.starts_with("//!")
                    || text.contains("@license"));
            if !license {
                removed_comments += 1;
                continue;
            }
        }
        if token.kind == TokenKind::Shebang {
            if !first {
                out.push('\n');
            }
            out.push_str(token.text(&source));
            previous = Some(token);
            first = false;
            continue;
        }
        if let Some(prev) = previous {
            let prev_text = prev.text(&source);
            let curr_text = token.text(&source);
            if token.line_break_before && needs_newline(prev, token, &source) {
                out.push('\n');
            } else if needs_space(prev, token, &source) {
                out.push(' ');
            }
            let _ = (prev_text, curr_text);
        }
        out.push_str(token.text(&source));
        previous = Some(token);
        first = false;
    }
    MinifyResult {
        bytes_before: source.len(),
        bytes_after: out.len(),
        removed_comments,
        code: out,
    }
}

pub fn strip_source_maps(source: &str) -> String {
    let tokens = tokenize(source);
    let mut out = String::with_capacity(source.len());
    let mut last = 0usize;
    for token in &tokens {
        if !token.is_comment() {
            continue;
        }
        let text = token.text(source).trim_start();
        if text.starts_with("//# sourceMappingURL=")
            || text.starts_with("//@ sourceMappingURL=")
            || text.starts_with("/*# sourceMappingURL=")
            || text.starts_with("/*@ sourceMappingURL=")
        {
            out.push_str(&source[last..token.start]);
            last = token.end;
        }
    }
    out.push_str(&source[last..]);
    out
}

pub fn is_minified(source: &str) -> bool {
    let len = source.len();
    if len < 400 {
        return false;
    }
    let lines = source.lines().count().max(1);
    let average = len / lines;
    average > 180 || (lines * 120 < len && !source.contains("\n    "))
}

/// Decides whether the line break that sat before `curr` in the source must be
/// kept. Dropping it is only safe when `curr` cannot start a new statement
/// (it can only continue the previous expression) or when `prev` cannot end a
/// statement. Anything else relies on automatic semicolon insertion, so the
/// break is preserved: `foo()\nconst R = 1` must never become `foo()const R=1`.
fn needs_newline(prev: &Token, curr: &Token, source: &str) -> bool {
    let prev_text = prev.text(source);
    let curr_text = curr.text(source);
    // Tokens that can only continue the previous expression (no ASI happens
    // before them). `!`, `~` and `{` are deliberately NOT here: they can begin
    // a new statement, so `a\n!b` and `f()\n{...}` depend on the line break.
    if matches!(
        curr_text,
        ")" | "]"
            | "}"
            | ";"
            | ","
            | "."
            | "?."
            | ":"
            | "?"
            | "&&"
            | "||"
            | "??"
            | "+"
            | "-"
            | "*"
            | "/"
            | "%"
    ) {
        return false;
    }
    if matches!(prev_text, "(" | "[" | "{" | "," | ";" | ":" | "=>" | "=") {
        return false;
    }
    if matches!(curr_text, "++" | "--") {
        return !matches!(prev_text, ";" | "{" | "}" | "(" | "[" | ",");
    }
    // A punctuator can only end a statement if it closes something (`)`, `]`,
    // `}`) or is a postfix operator. After those, the next line may be a new
    // statement and needs its line break. After any other punctuator
    // (binary operators, `!`, `.`, ...) the expression is still open.
    if prev.kind == TokenKind::Punct && !matches!(prev_text, ")" | "]" | "}" | "++" | "--") {
        return false;
    }
    true
}

fn needs_space(prev: &Token, curr: &Token, source: &str) -> bool {
    let prev_text = prev.text(source);
    let curr_text = curr.text(source);
    let prev_word = matches!(prev.kind, TokenKind::Word | TokenKind::Number);
    let curr_word = matches!(curr.kind, TokenKind::Word | TokenKind::Number);
    if prev_word && curr_word {
        return true;
    }
    if prev.kind == TokenKind::Number && curr_text.starts_with('.') {
        return true;
    }
    if prev.kind == TokenKind::Number && curr.kind == TokenKind::Word {
        return true;
    }
    let last = prev_text.as_bytes().last().copied();
    let first = curr_text.as_bytes().first().copied();
    match (last, first) {
        (Some(a), Some(b)) if a == b && b"+-*/%&|^<>=!?.".contains(&a) => true,
        (Some(b'/'), Some(b'/' | b'*')) => true,
        (Some(b'<'), Some(b'!')) => true,
        (Some(b'-'), Some(b'>')) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn min(source: &str) -> String {
        minify(source, &MinifyOptions::default()).code
    }

    #[test]
    fn strips_comments_and_indentation() {
        let source = "// license\nconst a = 1; /* block */\n\nfunction f() {\n  return a;\n}\n";
        let out = min(source);
        assert!(!out.contains("license"));
        assert!(!out.contains("block"));
        assert!(out.contains("const a=1;"));
        assert!(out.contains("function f(){"));
    }

    #[test]
    fn keeps_license_comments() {
        let out = min("/*! MIT */\nvar a = 1;");
        assert!(out.starts_with("/*! MIT */"));
    }

    #[test]
    fn preserves_asi_hazards() {
        assert!(min("let a = 1\nlet b = 2").contains('\n'));
        let out = min("function f() { return\n  42 }");
        assert!(out.contains("return\n42"), "{out}");
        let out = min("a\n++b");
        assert!(out.contains("a\n++b"), "{out}");
        let out = min("const x = a\n  + b");
        assert_eq!(out, "const x=a+b");
    }

    #[test]
    fn keeps_line_break_after_closing_punctuation() {
        // The bug behind `SyntaxError: Unexpected identifier 'R'`.
        assert_eq!(min("foo()\nconst R = 1"), "foo()\nconst R=1");
        assert_eq!(min("const f = () => {}\nconst R = 1"), "const f=()=>{}\nconst R=1");
        assert_eq!(min("const a = [1]\nR.run()"), "const a=[1]\nR.run()");
        assert_eq!(min("x++\nR.run()"), "x++\nR.run()");
        assert_eq!(min("a()\nlet b = 2"), "a()\nlet b=2");
    }

    #[test]
    fn keeps_line_break_before_statement_starting_punctuation() {
        assert_eq!(min("a\n!b"), "a\n!b");
        assert_eq!(min("a\n~b"), "a\n~b");
        assert_eq!(min("f()\n{ g() }"), "f()\n{g()}");
    }

    #[test]
    fn still_joins_continuations() {
        assert_eq!(min("a\n  .b()\n  .c()"), "a.b().c()");
        assert_eq!(min("const x = a\n  && b"), "const x=a&&b");
        assert_eq!(min("foo(\n  a,\n  b\n)"), "foo(a,b)");
    }

    #[test]
    fn does_not_merge_tokens() {
        assert_eq!(min("let a = 1; let b = 2;"), "let a=1;let b=2;");
        assert_eq!(min("return typeof x"), "return typeof x");
        assert_eq!(min("a + +b"), "a+ +b");
        assert_eq!(min("a - -b"), "a- -b");
        assert_eq!(min("i++ + 1"), "i++ +1");
        assert_eq!(min("a / /re/.test(x)"), "a/ /re/.test(x)");
    }

    #[test]
    fn keeps_strings_templates_and_regex() {
        let source = r#"const a = "  x  "; const b = `a ${ x + 1 } b`; const r = /a b/g;"#;
        let out = min(source);
        assert!(out.contains(r#""  x  ""#));
        assert!(out.contains("`a ${ x + 1 } b`"));
        assert!(out.contains("/a b/g"));
    }

    #[test]
    fn removes_source_map_comments() {
        let source = "var a=1;\n//# sourceMappingURL=a.js.map\n";
        let out = minify(source, &MinifyOptions::default());
        assert!(!out.code.contains("sourceMappingURL"));
        assert_eq!(out.code, "var a=1;");
    }

    #[test]
    fn detects_minified_code() {
        assert!(!is_minified("function a() {\n  return 1;\n}\n"));
        let dense = format!("var a=1;{}", "b();".repeat(500));
        assert!(is_minified(&dense));
    }

    #[test]
    fn is_idempotent() {
        let source = "const a = 1;\n// c\nfunction f(x) { return x + a; }\n";
        let once = min(source);
        let twice = min(&once);
        assert_eq!(once, twice);
    }
}