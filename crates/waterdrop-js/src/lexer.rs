#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    Word,
    Number,
    String,
    Template,
    Regex,
    Punct,
    CommentLine,
    CommentBlock,
    Shebang,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub start: usize,
    pub end: usize,
    pub line_break_before: bool,
}

impl Token {
    pub fn text<'a>(&self, source: &'a str) -> &'a str {
        &source[self.start..self.end]
    }

    pub fn is_word(&self, source: &str, value: &str) -> bool {
        self.kind == TokenKind::Word && &source[self.start..self.end] == value
    }

    pub fn is_punct(&self, source: &str, value: &str) -> bool {
        self.kind == TokenKind::Punct && &source[self.start..self.end] == value
    }

    pub fn is_comment(&self) -> bool {
        matches!(self.kind, TokenKind::CommentLine | TokenKind::CommentBlock)
    }
}

pub fn tokenize(source: &str) -> Vec<Token> {
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut index = 0usize;
    let mut newline = false;
    let mut regex_allowed = true;

    if source.starts_with("#!") {
        let end = source.find('\n').unwrap_or(bytes.len());
        tokens.push(Token {
            kind: TokenKind::Shebang,
            start: 0,
            end,
            line_break_before: false,
        });
        index = end;
    }

    while index < bytes.len() {
        let byte = bytes[index];
        if byte.is_ascii_whitespace() {
            if byte == b'\n' || byte == b'\r' {
                newline = true;
            }
            index += 1;
            continue;
        }
        if byte == b'/' && index + 1 < bytes.len() && bytes[index + 1] == b'/' {
            let end = source[index..]
                .find('\n')
                .map(|offset| index + offset)
                .unwrap_or(bytes.len());
            tokens.push(Token {
                kind: TokenKind::CommentLine,
                start: index,
                end,
                line_break_before: newline,
            });
            index = end;
            newline = true;
            continue;
        }
        if byte == b'/' && index + 1 < bytes.len() && bytes[index + 1] == b'*' {
            let end = source[index + 2..]
                .find("*/")
                .map(|offset| index + 2 + offset + 2)
                .unwrap_or(bytes.len());
            if source[index..end].contains('\n') {
                newline = true;
            }
            tokens.push(Token {
                kind: TokenKind::CommentBlock,
                start: index,
                end,
                line_break_before: newline,
            });
            index = end;
            continue;
        }
        if source[index..].starts_with("<!--") {
            let end = source[index..]
                .find('\n')
                .map(|offset| index + offset)
                .unwrap_or(bytes.len());
            tokens.push(Token {
                kind: TokenKind::CommentLine,
                start: index,
                end,
                line_break_before: newline,
            });
            index = end;
            newline = true;
            continue;
        }

        let start = index;
        let kind;
        if byte == b'"' || byte == b'\'' {
            index = skip_string(bytes, index, byte);
            kind = TokenKind::String;
        } else if byte == b'`' {
            index = skip_template(bytes, index);
            kind = TokenKind::Template;
        } else if byte == b'/' && regex_allowed && !source[index..].starts_with("/=") {
            if let Some(end) = skip_regex(bytes, index) {
                index = end;
                kind = TokenKind::Regex;
            } else {
                index += 1;
                kind = TokenKind::Punct;
            }
        } else if byte.is_ascii_digit()
            || (byte == b'.' && index + 1 < bytes.len() && bytes[index + 1].is_ascii_digit())
        {
            index = skip_number(bytes, index);
            kind = TokenKind::Number;
        } else if is_word_byte(byte) {
            index += 1;
            while index < bytes.len() && is_word_byte(bytes[index]) {
                index += 1;
            }
            kind = TokenKind::Word;
        } else {
            let len = punct_len(&source[index..]);
            index += len;
            kind = if len == 0 {
                TokenKind::Unknown
            } else {
                TokenKind::Punct
            };
            if len == 0 {
                index += 1;
            }
        }

        let text = &source[start..index];
        regex_allowed = match kind {
            TokenKind::Word => regex_after_word(text),
            TokenKind::Punct => regex_after_punct(text),
            TokenKind::Number | TokenKind::String | TokenKind::Template | TokenKind::Regex => false,
            _ => regex_allowed,
        };
        tokens.push(Token {
            kind,
            start,
            end: index,
            line_break_before: newline,
        });
        newline = false;
    }
    tokens
}

fn is_word_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$') || byte >= 0x80
}

fn regex_after_word(word: &str) -> bool {
    matches!(
        word,
        "return"
            | "typeof"
            | "instanceof"
            | "in"
            | "of"
            | "new"
            | "delete"
            | "void"
            | "throw"
            | "case"
            | "do"
            | "else"
            | "yield"
            | "await"
            | "extends"
    )
}

fn regex_after_punct(punct: &str) -> bool {
    !matches!(punct, ")" | "]" | "++" | "--")
}

fn skip_string(bytes: &[u8], start: usize, quote: u8) -> usize {
    let mut index = start + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            byte if byte == quote => return index + 1,
            _ => index += 1,
        }
    }
    bytes.len()
}

fn skip_template(bytes: &[u8], start: usize) -> usize {
    let mut index = start + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'`' => return index + 1,
            b'$' if index + 1 < bytes.len() && bytes[index + 1] == b'{' => {
                index = skip_braced(bytes, index + 2);
            }
            _ => index += 1,
        }
    }
    bytes.len()
}

fn skip_braced(bytes: &[u8], start: usize) -> usize {
    let mut index = start;
    let mut depth = 1usize;
    while index < bytes.len() {
        match bytes[index] {
            b'"' | b'\'' => index = skip_string(bytes, index, bytes[index]),
            b'`' => index = skip_template(bytes, index),
            b'/' if index + 1 < bytes.len() && bytes[index + 1] == b'/' => {
                index = bytes[index..]
                    .iter()
                    .position(|byte| *byte == b'\n')
                    .map(|offset| index + offset)
                    .unwrap_or(bytes.len());
            }
            b'/' if index + 1 < bytes.len() && bytes[index + 1] == b'*' => {
                index = bytes[index + 2..]
                    .windows(2)
                    .position(|window| window == b"*/")
                    .map(|offset| index + 2 + offset + 2)
                    .unwrap_or(bytes.len());
            }
            b'{' => {
                depth += 1;
                index += 1;
            }
            b'}' => {
                depth -= 1;
                index += 1;
                if depth == 0 {
                    return index;
                }
            }
            _ => index += 1,
        }
    }
    bytes.len()
}

fn skip_regex(bytes: &[u8], start: usize) -> Option<usize> {
    let mut index = start + 1;
    let mut in_class = false;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'\n' | b'\r' => return None,
            b'[' => {
                in_class = true;
                index += 1;
            }
            b']' => {
                in_class = false;
                index += 1;
            }
            b'/' if !in_class => {
                index += 1;
                while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
                    index += 1;
                }
                return Some(index);
            }
            _ => index += 1,
        }
    }
    None
}

fn skip_number(bytes: &[u8], start: usize) -> usize {
    let mut index = start;
    if bytes[index] == b'0' && index + 1 < bytes.len() {
        match bytes[index + 1] {
            b'x' | b'X' => {
                index += 2;
                while index < bytes.len()
                    && (bytes[index].is_ascii_hexdigit() || bytes[index] == b'_')
                {
                    index += 1;
                }
                return index;
            }
            b'b' | b'B' | b'o' | b'O' => {
                index += 2;
                while index < bytes.len() && (bytes[index].is_ascii_digit() || bytes[index] == b'_')
                {
                    index += 1;
                }
                return index;
            }
            _ => {}
        }
    }
    while index < bytes.len() && (bytes[index].is_ascii_digit() || bytes[index] == b'_') {
        index += 1;
    }
    if index < bytes.len() && bytes[index] == b'.' && bytes.get(index + 1) != Some(&b'.') {
        index += 1;
        while index < bytes.len() && (bytes[index].is_ascii_digit() || bytes[index] == b'_') {
            index += 1;
        }
    }
    if index < bytes.len() && matches!(bytes[index], b'e' | b'E') {
        let mut cursor = index + 1;
        if cursor < bytes.len() && matches!(bytes[cursor], b'+' | b'-') {
            cursor += 1;
        }
        if cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
            index = cursor;
            while index < bytes.len() && bytes[index].is_ascii_digit() {
                index += 1;
            }
        }
    }
    if index < bytes.len() && bytes[index] == b'n' {
        index += 1;
    }
    index
}

fn punct_len(input: &str) -> usize {
    const PUNCTS: &[&str] = &[
        ">>>=", "===", "!==", "**=", "&&=", "||=", "??=", "<<=", ">>=", ">>>", "...", "=>", "==",
        "!=", "<=", ">=", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "&&", "||",
        "??", "?.", "**", "<<", ">>", "::", "?.",
    ];
    for punct in PUNCTS {
        if input.starts_with(punct) {
            return punct.len();
        }
    }
    if input
        .as_bytes()
        .first()
        .map(|byte| b"{}()[];,<>+-*/%&|^!~?:=.@#".contains(byte))
        .unwrap_or(false)
    {
        1
    } else {
        0
    }
}

pub fn significant(tokens: &[Token]) -> impl Iterator<Item = &Token> {
    tokens
        .iter()
        .filter(|token| !token.is_comment() && token.kind != TokenKind::Shebang)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(source: &str) -> Vec<TokenKind> {
        tokenize(source)
            .into_iter()
            .map(|token| token.kind)
            .collect()
    }

    #[test]
    fn tokenizes_words_numbers_and_punctuation() {
        let source = "const x = 0xff + 1_000n; y => y?.z;";
        let tokens = tokenize(source);
        let words: Vec<_> = tokens
            .iter()
            .filter(|token| token.kind == TokenKind::Word)
            .map(|token| token.text(source))
            .collect();
        assert_eq!(words, ["const", "x", "y", "y", "z"]);
        assert!(tokens.iter().any(|token| token.text(source) == "0xff"));
        assert!(tokens.iter().any(|token| token.text(source) == "1_000n"));
        assert!(tokens.iter().any(|token| token.text(source) == "=>"));
        assert!(tokens.iter().any(|token| token.text(source) == "?."));
    }

    #[test]
    fn understands_strings_comments_and_regex() {
        let source = r#"const s = "a\"b"; // line
        const r = /a[/]b/g; /* block */ const t = `x${a + `y${b}`}z`;"#;
        let tokens = tokenize(source);
        assert!(tokens.iter().any(|token| token.kind == TokenKind::String));
        assert_eq!(
            tokens
                .iter()
                .filter(|token| token.kind == TokenKind::CommentLine)
                .count(),
            1
        );
        assert!(tokens
            .iter()
            .any(|token| token.kind == TokenKind::CommentBlock));
        assert!(tokens
            .iter()
            .any(|token| token.kind == TokenKind::Regex && token.text(source).ends_with("/g")));
        assert!(
            tokens
                .iter()
                .any(|token| token.kind == TokenKind::Template
                    && token.text(source).contains("y${b}"))
        );
    }

    #[test]
    fn distinguishes_division_from_regex() {
        let source = "const a = b / c; const r = /x/; if (a) { } /y/.test(a);";
        let tokens = tokenize(source);
        assert_eq!(
            tokens
                .iter()
                .filter(|token| token.kind == TokenKind::Regex)
                .count(),
            2
        );
    }

    #[test]
    fn tracks_line_breaks() {
        let source = "a\nb c";
        let tokens = tokenize(source);
        assert!(!tokens[0].line_break_before);
        assert!(tokens[1].line_break_before);
        assert!(!tokens[2].line_break_before);
    }

    #[test]
    fn handles_shebang() {
        let tokens = tokenize("#!/usr/bin/env node\nconsole.log(1)");
        assert_eq!(tokens[0].kind, TokenKind::Shebang);
        assert!(tokens
            .iter()
            .any(|token| token.text("#!/usr/bin/env node\nconsole.log(1)") == "console"));
    }

    #[test]
    fn keeps_kinds_consistent() {
        assert_eq!(
            kinds("a = `x`;"),
            [
                TokenKind::Word,
                TokenKind::Punct,
                TokenKind::Template,
                TokenKind::Punct
            ]
        );
    }
}
