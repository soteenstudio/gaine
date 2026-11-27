mod optimize;
mod refs;
mod tokenizer;

pub use optimize::{optimize, OptimizeOptions, OptimizeResult};
pub use refs::{
    analyze, css_urls, parse_srcset, AssetReference, HtmlAnalysis, InlineScript, RefKind,
};
pub use tokenizer::{is_block, is_void, scan, serialize_tag, Attribute, Tag, Token};

/// Rewrites the contents of inline `<script>`/`<style>` blocks.
pub fn rewrite_inline(
    html: &str,
    mut script: impl FnMut(&str, Option<&str>) -> String,
    mut style: impl FnMut(&str) -> String,
) -> String {
    let tokens = scan(html);
    let mut out = String::with_capacity(html.len());
    let mut raw_tag: Option<String> = None;
    let mut script_type: Option<String> = None;
    for token in &tokens {
        match token {
            Token::Start(tag) => {
                let name = tag.name.to_ascii_lowercase();
                if name == "script" {
                    script_type = tag.attr("type").map(ToOwned::to_owned);
                }
                if matches!(name.as_str(), "script" | "style") {
                    raw_tag = Some(name);
                }
                out.push_str(&serialize_tag(tag));
            }
            Token::End { name } => {
                out.push_str("</");
                out.push_str(name);
                out.push('>');
                raw_tag = None;
            }
            Token::Raw(content) => match raw_tag.as_deref() {
                Some("script") => out.push_str(&script(content, script_type.as_deref())),
                Some("style") => out.push_str(&style(content)),
                _ => out.push_str(content),
            },
            Token::Text(text) => out.push_str(text),
            Token::Comment(comment) => out.push_str(comment),
            Token::Doctype(doctype) => out.push_str(doctype),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrites_inline_blocks_only() {
        let html = "<style>a { color: red }</style><script>var  a = 1;</script><p>var b</p>";
        let out = rewrite_inline(
            html,
            |code, _| code.replace("  ", " "),
            |code| code.replace(' ', ""),
        );
        assert_eq!(
            out,
            "<style>a{color:red}</style><script>var a = 1;</script><p>var b</p>"
        );
    }

    #[test]
    fn exposes_analysis() {
        let analysis =
            analyze(r#"<script type="module" src="/a.js"></script><div class="x"></div>"#);
        assert_eq!(analysis.references.len(), 1);
        assert!(analysis.has_module());
        assert_eq!(analysis.classes, ["x"]);
    }
}
