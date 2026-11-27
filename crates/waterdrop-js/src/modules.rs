use crate::lexer::{tokenize, Token, TokenKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedName {
    pub imported: String,
    pub local: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Import {
    pub specifier: String,
    pub names: Vec<ImportedName>,
    pub namespace: Option<String>,
    pub side_effect: bool,
    pub type_only: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportKind {
    Named,
    Default,
    ReExport,
    Namespace,
}

impl ExportKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ExportKind::Named => "named",
            ExportKind::Default => "default",
            ExportKind::ReExport => "re-export",
            ExportKind::Namespace => "namespace",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Export {
    pub name: String,
    pub kind: ExportKind,
    pub from: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ModuleInfo {
    pub imports: Vec<Import>,
    pub exports: Vec<Export>,
    pub dynamic_imports: Vec<String>,
    pub requires: Vec<String>,
    pub urls: Vec<String>,
    pub type_only: bool,
}

impl ModuleInfo {
    pub fn static_specifiers(&self) -> Vec<&str> {
        self.imports
            .iter()
            .filter(|import| !import.type_only)
            .map(|import| import.specifier.as_str())
            .chain(self.dynamic_imports.iter().map(String::as_str))
            .chain(self.requires.iter().map(String::as_str))
            .collect()
    }

    pub fn imported_names(&self) -> Vec<&ImportedName> {
        self.imports
            .iter()
            .filter(|import| !import.type_only)
            .flat_map(|import| import.names.iter())
            .collect()
    }

    pub fn export_names(&self) -> Vec<&str> {
        self.exports
            .iter()
            .filter(|export| export.kind != ExportKind::ReExport)
            .map(|export| export.name.as_str())
            .collect()
    }

    pub fn has_default_export(&self) -> bool {
        self.exports
            .iter()
            .any(|export| export.kind == ExportKind::Default)
    }
}

pub fn scan_modules(source: &str) -> ModuleInfo {
    let all = tokenize(source);
    let sig: Vec<&Token> = all
        .iter()
        .filter(|token| !token.is_comment() && token.kind != TokenKind::Shebang)
        .collect();
    let mut info = ModuleInfo::default();
    let mut i = 0usize;

    while i < sig.len() {
        let token = sig[i];
        let text = token.text(source);

        if token.kind == TokenKind::Word && text == "import" && !is_member_access(&sig, source, i) {
            if let Some(next) = sig.get(i + 1) {
                if next.is_punct(source, "(") {
                    if let Some(specifier) = string_at(&sig, source, i + 2) {
                        info.dynamic_imports.push(specifier);
                    }
                    i += 1;
                    continue;
                }
                if next.is_punct(source, ".") {
                    i += 1;
                    continue;
                }
                if next.kind == TokenKind::String {
                    info.imports.push(Import {
                        specifier: next.text(source).trim_matches(['"', '\'']).to_string(),
                        names: Vec::new(),
                        namespace: None,
                        side_effect: true,
                        type_only: false,
                    });
                    i += 2;
                    continue;
                }
                let type_only = next.is_word(source, "type");
                let clause_start = i + 1;
                let mut from_index = None;
                let mut j = clause_start;
                while j < sig.len() {
                    if sig[j].is_word(source, "from") {
                        from_index = Some(j);
                        break;
                    }
                    if sig[j].is_punct(source, ";") || sig[j].is_punct(source, "(") {
                        break;
                    }
                    j += 1;
                }
                if let Some(from) = from_index {
                    if let Some(specifier) = string_at(&sig, source, from + 1) {
                        let (names, namespace) =
                            parse_import_clause(&sig, source, clause_start, from, type_only);
                        info.imports.push(Import {
                            specifier,
                            names,
                            namespace,
                            side_effect: false,
                            type_only,
                        });
                        i = from + 2;
                        continue;
                    }
                }
            }
        }

        if token.kind == TokenKind::Word && text == "export" && !is_member_access(&sig, source, i) {
            if let Some(next) = sig.get(i + 1) {
                if next.is_word(source, "default") {
                    info.exports.push(Export {
                        name: "default".to_string(),
                        kind: ExportKind::Default,
                        from: None,
                    });
                    i += 2;
                    continue;
                }
                if next.is_punct(source, "{") {
                    let mut j = i + 2;
                    let mut names = Vec::new();
                    while j < sig.len() && !sig[j].is_punct(source, "}") {
                        if sig[j].kind == TokenKind::Word {
                            let local = sig[j].text(source).to_string();
                            let mut exported = local.clone();
                            if sig
                                .get(j + 1)
                                .map(|token| token.is_word(source, "as"))
                                .unwrap_or(false)
                            {
                                if let Some(alias) = sig.get(j + 2) {
                                    if alias.kind == TokenKind::Word {
                                        exported = alias.text(source).to_string();
                                        j += 2;
                                    }
                                }
                            }
                            names.push(exported);
                        }
                        j += 1;
                    }
                    let mut from = None;
                    if sig
                        .get(j + 1)
                        .map(|token| token.is_word(source, "from"))
                        .unwrap_or(false)
                    {
                        from = string_at(&sig, source, j + 2);
                    }
                    let kind = if from.is_some() {
                        ExportKind::ReExport
                    } else {
                        ExportKind::Named
                    };
                    for name in names {
                        info.exports.push(Export {
                            name,
                            kind,
                            from: from.clone(),
                        });
                    }
                    i = j + 1;
                    continue;
                }
                if next.is_punct(source, "*") {
                    let mut j = i + 2;
                    let mut name = "*".to_string();
                    if sig
                        .get(j)
                        .map(|token| token.is_word(source, "as"))
                        .unwrap_or(false)
                    {
                        if let Some(alias) = sig.get(j + 1) {
                            name = alias.text(source).to_string();
                        }
                        j += 2;
                    }
                    let mut from = None;
                    if sig
                        .get(j)
                        .map(|token| token.is_word(source, "from"))
                        .unwrap_or(false)
                    {
                        from = string_at(&sig, source, j + 1);
                    }
                    info.exports.push(Export {
                        name,
                        kind: if from.is_some() {
                            ExportKind::ReExport
                        } else {
                            ExportKind::Namespace
                        },
                        from,
                    });
                    i = j + 1;
                    continue;
                }
                if let Some(name) = declaration_name(&sig, source, i + 1) {
                    info.exports.push(Export {
                        name,
                        kind: ExportKind::Named,
                        from: None,
                    });
                }
            }
        }

        if token.kind == TokenKind::Word
            && text == "require"
            && !is_member_access(&sig, source, i)
            && sig
                .get(i + 1)
                .map(|token| token.is_punct(source, "("))
                .unwrap_or(false)
        {
            if let Some(specifier) = string_at(&sig, source, i + 2) {
                info.requires.push(specifier);
            }
        }

        if token.kind == TokenKind::Word && text == "URL" {
            let is_new = i > 0 && sig[i - 1].is_word(source, "new");
            if is_new
                && sig
                    .get(i + 1)
                    .map(|token| token.is_punct(source, "("))
                    .unwrap_or(false)
            {
                if let Some(url) = string_at(&sig, source, i + 2) {
                    info.urls.push(url);
                }
            }
        }

        i += 1;
    }
    info
}

fn is_member_access(sig: &[&Token], source: &str, index: usize) -> bool {
    if index == 0 {
        return false;
    }
    sig[index - 1].is_punct(source, ".") || sig[index - 1].is_punct(source, "?.")
}

fn string_at(sig: &[&Token], source: &str, index: usize) -> Option<String> {
    let token = sig.get(index)?;
    if token.kind != TokenKind::String {
        return None;
    }
    Some(token.text(source).trim_matches(['"', '\'']).to_string())
}

fn parse_import_clause(
    sig: &[&Token],
    source: &str,
    start: usize,
    end: usize,
    type_only: bool,
) -> (Vec<ImportedName>, Option<String>) {
    let mut names = Vec::new();
    let mut namespace = None;
    let mut index = start;
    if type_only
        && sig
            .get(index)
            .map(|token| token.is_word(source, "type"))
            .unwrap_or(false)
    {
        index += 1;
    }
    if index >= end {
        return (names, namespace);
    }
    if sig[index].is_punct(source, "{") {
        index += 1;
        while index < end && !sig[index].is_punct(source, "}") {
            if sig[index].kind == TokenKind::Word {
                let imported = sig[index].text(source).to_string();
                let mut local = imported.clone();
                if sig
                    .get(index + 1)
                    .map(|token| token.is_word(source, "as"))
                    .unwrap_or(false)
                {
                    if let Some(alias) = sig.get(index + 2) {
                        local = alias.text(source).to_string();
                        index += 2;
                    }
                }
                names.push(ImportedName { imported, local });
            }
            index += 1;
        }
        return (names, namespace);
    }
    if sig[index].is_punct(source, "*") {
        if sig
            .get(index + 1)
            .map(|token| token.is_word(source, "as"))
            .unwrap_or(false)
        {
            if let Some(alias) = sig.get(index + 2) {
                namespace = Some(alias.text(source).to_string());
            }
        }
        return (names, namespace);
    }
    if sig[index].kind == TokenKind::Word {
        let local = sig[index].text(source).to_string();
        names.push(ImportedName {
            imported: "default".to_string(),
            local,
        });
        index += 1;
    }
    if sig
        .get(index)
        .map(|token| token.is_punct(source, ","))
        .unwrap_or(false)
    {
        index += 1;
    }
    if sig
        .get(index)
        .map(|token| token.is_punct(source, "{"))
        .unwrap_or(false)
    {
        let (rest, namespace) = parse_import_clause(sig, source, index, end, false);
        names.extend(rest);
        return (names, namespace);
    }
    if sig
        .get(index)
        .map(|token| token.is_punct(source, "*"))
        .unwrap_or(false)
    {
        let (_, namespace) = parse_import_clause(sig, source, index, end, false);
        return (names, namespace);
    }
    (names, namespace)
}

fn declaration_name(sig: &[&Token], source: &str, start: usize) -> Option<String> {
    let mut index = start;
    if sig
        .get(index)
        .map(|token| token.is_word(source, "async"))
        .unwrap_or(false)
    {
        index += 1;
    }
    if sig
        .get(index)
        .map(|token| token.is_word(source, "function"))
        .unwrap_or(false)
    {
        index += 1;
        if sig
            .get(index)
            .map(|token| token.is_punct(source, "*"))
            .unwrap_or(false)
        {
            index += 1;
        }
        return sig
            .get(index)
            .filter(|token| token.kind == TokenKind::Word)
            .map(|token| token.text(source).to_string());
    }
    if sig
        .get(index)
        .map(|token| token.is_word(source, "class"))
        .unwrap_or(false)
    {
        return sig
            .get(index + 1)
            .filter(|token| token.kind == TokenKind::Word)
            .map(|token| token.text(source).to_string());
    }
    if sig
        .get(index)
        .map(|token| {
            token.is_word(source, "const")
                || token.is_word(source, "let")
                || token.is_word(source, "var")
        })
        .unwrap_or(false)
    {
        return sig
            .get(index + 1)
            .filter(|token| token.kind == TokenKind::Word)
            .map(|token| token.text(source).to_string());
    }
    if sig
        .get(index)
        .map(|token| {
            token.is_word(source, "type")
                || token.is_word(source, "interface")
                || token.is_word(source, "enum")
        })
        .unwrap_or(false)
    {
        return sig
            .get(index + 1)
            .filter(|token| token.kind == TokenKind::Word)
            .map(|token| token.text(source).to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scans_static_and_dynamic_imports() {
        let info = scan_modules(
            r#"
            import defaultName from "./a.js";
            import { x, y as z } from './b.js';
            import * as ns from "/c.js";
            import "./side-effect.js";
            import type { T } from "./types.js";
            const late = import("./late.js");
            const legacy = require("legacy");
            const asset = new URL("./img.png", import.meta.url);
            "#,
        );
        assert_eq!(info.imports.len(), 5);
        assert_eq!(info.imports[0].specifier, "./a.js");
        assert_eq!(info.imports[0].names[0].imported, "default");
        assert_eq!(info.imports[1].names[1].local, "z");
        assert_eq!(info.imports[2].namespace.as_deref(), Some("ns"));
        assert!(info.imports[3].side_effect);
        assert!(info.imports[4].type_only);
        assert_eq!(info.dynamic_imports, ["./late.js"]);
        assert_eq!(info.requires, ["legacy"]);
        assert_eq!(info.urls, ["./img.png"]);
        assert!(!info.static_specifiers().contains(&"./types.js"));
    }

    #[test]
    fn scans_exports() {
        let info = scan_modules(
            r#"
            export const a = 1, b = 2;
            export function hello() {}
            export async function later() {}
            export class Thing {}
            export default function main() {}
            export { a as renamed, hello };
            export { remote } from "./remote.js";
            export * as everything from "./all.js";
            export type { T } from "./types.js";
            "#,
        );
        let names: Vec<_> = info
            .exports
            .iter()
            .map(|export| export.name.as_str())
            .collect();
        assert!(names.contains(&"a"));
        assert!(names.contains(&"hello"));
        assert!(names.contains(&"later"));
        assert!(names.contains(&"Thing"));
        assert!(names.contains(&"default"));
        assert!(names.contains(&"renamed"));
        assert!(names.contains(&"everything"));
        assert!(names.contains(&"remote"));
        assert!(info.has_default_export());
    }

    #[test]
    fn ignores_member_access_and_strings() {
        let info = scan_modules(
            r#"const s = "import x from 'y'"; obj.import("./no.js"); obj.export = 1;"#,
        );
        assert!(info.imports.is_empty());
        assert!(info.exports.is_empty());
        assert!(info.dynamic_imports.is_empty());
    }

    #[test]
    fn handles_multiline_import_clauses() {
        let info = scan_modules("import {\n  a,\n  b as c,\n} from \"./x.js\";");
        assert_eq!(info.imports[0].names.len(), 2);
        assert_eq!(info.imports[0].names[1].local, "c");
    }
}
