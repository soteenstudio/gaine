use waterdrop_core::unescape_html;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attribute {
    pub name: String,
    pub value: Option<String>,
}

impl Attribute {
    pub fn new(name: impl Into<String>, value: Option<String>) -> Self {
        Self {
            name: name.into(),
            value,
        }
    }

    pub fn is(&self, name: &str) -> bool {
        self.name.eq_ignore_ascii_case(name)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tag {
    pub name: String,
    pub attrs: Vec<Attribute>,
    pub self_closing: bool,
}

impl Tag {
    pub fn attr(&self, name: &str) -> Option<&str> {
        self.attrs
            .iter()
            .find(|attr| attr.is(name))
            .and_then(|attr| attr.value.as_deref())
    }

    pub fn has(&self, name: &str) -> bool {
        self.attrs.iter().any(|attr| attr.is(name))
    }

    pub fn has_value(&self, name: &str, expected: &str) -> bool {
        self.attr(name)
            .map(|value| value.eq_ignore_ascii_case(expected))
            .unwrap_or(false)
    }

    pub fn set(&mut self, name: &str, value: Option<&str>) {
        if let Some(attr) = self.attrs.iter_mut().find(|attr| attr.is(name)) {
            attr.value = value.map(ToOwned::to_owned);
        } else {
            self.attrs
                .push(Attribute::new(name, value.map(ToOwned::to_owned)));
        }
    }

    pub fn set_if_missing(&mut self, name: &str, value: Option<&str>) -> bool {
        if self.has(name) {
            return false;
        }
        self.attrs
            .push(Attribute::new(name, value.map(ToOwned::to_owned)));
        true
    }

    pub fn remove(&mut self, name: &str) -> bool {
        let before = self.attrs.len();
        self.attrs.retain(|attr| !attr.is(name));
        before != self.attrs.len()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Token {
    Text(String),
    Comment(String),
    Doctype(String),
    Start(Tag),
    End {
        name: String,
    },
    /// Raw content for script/style/textarea/title. The surrounding tags are
    /// emitted as `Start` and `End` tokens.
    Raw(String),
}

pub fn scan(html: &str) -> Vec<Token> {
    let bytes = html.as_bytes();
    let mut tokens = Vec::new();
    let mut index = 0usize;
    let mut text_start = 0usize;

    while index < bytes.len() {
        if bytes[index] != b'<' {
            index += 1;
            continue;
        }
        if index + 1 >= bytes.len() {
            index += 1;
            continue;
        }
        let next = bytes[index + 1];
        if next == b'!' {
            if html[index..].starts_with("<!--") {
                flush_text(html, text_start, index, &mut tokens);
                let close = html[index + 4..]
                    .find("-->")
                    .map(|offset| index + 4 + offset + 3)
                    .unwrap_or(bytes.len());
                tokens.push(Token::Comment(html[index..close].to_string()));
                index = close;
            } else {
                flush_text(html, text_start, index, &mut tokens);
                let close = html[index..]
                    .find('>')
                    .map(|offset| index + offset + 1)
                    .unwrap_or(bytes.len());
                tokens.push(Token::Doctype(html[index..close].to_string()));
                index = close;
            }
            text_start = index;
            continue;
        }
        if next == b'/' {
            if let Some(close) = html[index..].find('>') {
                let end = index + close;
                let name = html[index + 2..end]
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();
                flush_text(html, text_start, index, &mut tokens);
                tokens.push(Token::End { name });
                index = end + 1;
                text_start = index;
                continue;
            }
            index += 1;
            continue;
        }
        if next == b'?' {
            flush_text(html, text_start, index, &mut tokens);
            let close = html[index..]
                .find("?>")
                .map(|offset| index + offset + 2)
                .or_else(|| html[index..].find('>').map(|offset| index + offset + 1))
                .unwrap_or(bytes.len());
            tokens.push(Token::Comment(html[index..close].to_string()));
            index = close;
            text_start = index;
            continue;
        }
        if next == b'!' || !(next.is_ascii_alphabetic() || next == b'_' || next == b':') {
            index += 1;
            continue;
        }

        let Some((tag, end)) = parse_start_tag(html, index) else {
            index += 1;
            continue;
        };
        flush_text(html, text_start, index, &mut tokens);
        let name = tag.name.to_ascii_lowercase();
        let raw = is_raw_text(&name);
        let self_closing = tag.self_closing;
        tokens.push(Token::Start(tag));
        index = end;
        text_start = index;
        if raw && !self_closing {
            let closing = find_raw_close(html, index, &name);
            match closing {
                Some(close_start) => {
                    if close_start > index {
                        tokens.push(Token::Raw(html[index..close_start].to_string()));
                    }
                    let close_end = html[close_start..]
                        .find('>')
                        .map(|offset| close_start + offset + 1)
                        .unwrap_or(bytes.len());
                    tokens.push(Token::End {
                        name: name.to_ascii_lowercase(),
                    });
                    index = close_end;
                }
                None => {
                    tokens.push(Token::Raw(html[index..].to_string()));
                    index = bytes.len();
                }
            }
            text_start = index;
        }
    }
    flush_text(html, text_start, bytes.len(), &mut tokens);
    tokens
}

fn flush_text(html: &str, start: usize, end: usize, tokens: &mut Vec<Token>) {
    if end > start {
        tokens.push(Token::Text(html[start..end].to_string()));
    }
}

fn is_raw_text(name: &str) -> bool {
    matches!(name, "script" | "style" | "textarea" | "title" | "xmp")
}

fn find_raw_close(html: &str, from: usize, name: &str) -> Option<usize> {
    let lower = html.to_ascii_lowercase();
    let needle = format!("</{name}");
    let mut search = from;
    while let Some(offset) = lower[search..].find(&needle) {
        let at = search + offset;
        let after = at + needle.len();
        let boundary = lower[after..].chars().next();
        if matches!(
            boundary,
            Some('>') | Some(' ') | Some('\t') | Some('\r') | Some('\n') | Some('/')
        ) {
            return Some(at);
        }
        search = after;
    }
    None
}

fn parse_start_tag(html: &str, start: usize) -> Option<(Tag, usize)> {
    let bytes = html.as_bytes();
    let mut index = start + 1;
    let name_start = index;
    while index < bytes.len() && !matches!(bytes[index], b' ' | b'\t' | b'\r' | b'\n' | b'/' | b'>')
    {
        index += 1;
    }
    if index == name_start {
        return None;
    }
    let name = html[name_start..index].to_string();
    let mut attrs: Vec<Attribute> = Vec::new();
    let mut self_closing = false;

    loop {
        while index < bytes.len() && bytes[index].is_ascii_whitespace() {
            index += 1;
        }
        if index >= bytes.len() {
            return None;
        }
        match bytes[index] {
            b'>' => {
                index += 1;
                break;
            }
            b'/' if index + 1 < bytes.len() && bytes[index + 1] == b'>' => {
                self_closing = true;
                index += 2;
                break;
            }
            b'/' => {
                index += 1;
            }
            _ => {
                let attr_start = index;
                while index < bytes.len()
                    && !matches!(
                        bytes[index],
                        b' ' | b'\t' | b'\r' | b'\n' | b'/' | b'>' | b'='
                    )
                {
                    index += 1;
                }
                if index == attr_start {
                    index += 1;
                    continue;
                }
                let attr_name = html[attr_start..index].to_string();
                while index < bytes.len() && bytes[index].is_ascii_whitespace() {
                    index += 1;
                }
                let mut value = None;
                if index < bytes.len() && bytes[index] == b'=' {
                    index += 1;
                    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
                        index += 1;
                    }
                    if index >= bytes.len() {
                        return None;
                    }
                    match bytes[index] {
                        quote @ (b'"' | b'\'') => {
                            index += 1;
                            let value_start = index;
                            while index < bytes.len() && bytes[index] != quote {
                                index += 1;
                            }
                            if index >= bytes.len() {
                                return None;
                            }
                            value = Some(unescape_html(&html[value_start..index]));
                            index += 1;
                        }
                        _ => {
                            let value_start = index;
                            while index < bytes.len()
                                && !matches!(bytes[index], b' ' | b'\t' | b'\r' | b'\n' | b'>')
                            {
                                index += 1;
                            }
                            let raw = html[value_start..index].trim_end_matches('/');
                            value = Some(unescape_html(raw));
                        }
                    }
                }
                // The HTML parser keeps the first occurrence of a duplicate attribute.
                if !attrs
                    .iter()
                    .any(|attr| attr.name.eq_ignore_ascii_case(&attr_name))
                {
                    attrs.push(Attribute::new(attr_name, value));
                }
            }
        }
    }
    Some((
        Tag {
            name,
            attrs,
            self_closing,
        },
        index,
    ))
}

pub fn serialize_tag(tag: &Tag) -> String {
    let mut out = String::with_capacity(32 + tag.name.len());
    out.push('<');
    out.push_str(&tag.name);
    for attr in &tag.attrs {
        out.push(' ');
        out.push_str(&attr.name);
        if let Some(value) = &attr.value {
            out.push_str("=\"");
            escape_attr(value, &mut out);
            out.push('"');
        }
    }
    if tag.self_closing {
        out.push('/');
    }
    out.push('>');
    out
}

fn escape_attr(value: &str, out: &mut String) {
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            ch => out.push(ch),
        }
    }
}

pub fn is_void(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "param"
            | "source"
            | "track"
            | "wbr"
    )
}

pub fn is_block(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "address"
            | "article"
            | "aside"
            | "blockquote"
            | "body"
            | "caption"
            | "dd"
            | "div"
            | "dl"
            | "dt"
            | "fieldset"
            | "figcaption"
            | "figure"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "head"
            | "header"
            | "hr"
            | "html"
            | "li"
            | "main"
            | "nav"
            | "noscript"
            | "ol"
            | "p"
            | "pre"
            | "section"
            | "table"
            | "tbody"
            | "td"
            | "tfoot"
            | "th"
            | "thead"
            | "tr"
            | "ul"
            | "template"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_tags_attributes_and_text() {
        let tokens = scan(
            r#"<div id="a" disabled data-x='1&amp;2' class=hero><img src=/a.png alt="x>y"><p>hi</p></div>"#,
        );
        let start = match &tokens[0] {
            Token::Start(tag) => tag,
            other => panic!("unexpected {other:?}"),
        };
        assert_eq!(start.name, "div");
        assert_eq!(start.attr("id"), Some("a"));
        assert!(start.has("disabled"));
        assert_eq!(start.attr("data-x"), Some("1&2"));
        assert_eq!(start.attr("class"), Some("hero"));
        let img = tokens
            .iter()
            .find_map(|token| match token {
                Token::Start(tag) if tag.name == "img" => Some(tag),
                _ => None,
            })
            .unwrap();
        assert_eq!(img.attr("alt"), Some("x>y"));
        assert_eq!(img.attr("src"), Some("/a.png"));
    }

    #[test]
    fn keeps_script_content_verbatim() {
        let html = r#"<script>if (a < b) { console.log("</div>") }</script><div>x</div>"#;
        let tokens = scan(html);
        assert!(tokens
            .iter()
            .any(|token| matches!(token, Token::Raw(code) if code.contains("a < b"))));
        assert_eq!(
            tokens
                .iter()
                .filter(|token| matches!(token, Token::End { name } if name == "script"))
                .count(),
            1
        );
        assert_eq!(
            tokens
                .iter()
                .filter(|token| matches!(token, Token::Start(tag) if tag.name == "div"))
                .count(),
            1
        );
    }

    #[test]
    fn handles_comments_doctype_and_self_closing() {
        let tokens = scan("<!doctype html><!-- x --><br/><input value='a'/>");
        assert!(matches!(tokens[0], Token::Doctype(_)));
        assert!(matches!(tokens[1], Token::Comment(_)));
        assert!(matches!(&tokens[2], Token::Start(tag) if tag.self_closing));
        assert!(matches!(&tokens[3], Token::Start(tag) if tag.name == "input"));
    }

    #[test]
    fn serializes_attributes_safely() {
        let mut tag = Tag {
            name: "a".into(),
            attrs: vec![],
            self_closing: false,
        };
        tag.set("href", Some("/x?a=1&b=\"2\""));
        assert_eq!(
            serialize_tag(&tag),
            r#"<a href="/x?a=1&amp;b=&quot;2&quot;">"#
        );
    }
}
