use crate::lexer::{tokenize, TokenKind};
use crate::modules::ModuleInfo;
use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct RuntimeProfile {
    pub bytes: usize,
    pub lines: usize,
    pub minified: bool,
    pub source_maps: usize,
    pub dev_checks: usize,
    pub console_calls: usize,
    pub debuggers: usize,
    pub evals: usize,
    pub document_writes: usize,
    pub legacy_markers: Vec<String>,
    pub dynamic_imports: usize,
    pub data_urls: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BloatWarning {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnusedExport {
    pub module: String,
    pub name: String,
}

pub fn profile(source: &str, path: &str) -> RuntimeProfile {
    let tokens = tokenize(source);
    let mut out = RuntimeProfile {
        bytes: source.len(),
        lines: source.lines().count(),
        minified: crate::minify::is_minified(source),
        ..RuntimeProfile::default()
    };
    out.source_maps = tokens
        .iter()
        .filter(|token| token.is_comment() && token.text(source).contains("sourceMappingURL"))
        .count();
    let sig: Vec<_> = tokens.iter().filter(|token| !token.is_comment()).collect();
    for (index, token) in sig.iter().enumerate() {
        let text = token.text(source);
        if token.kind == TokenKind::String && text.contains("data:") && text.len() > 2048 {
            out.data_urls += 1;
        }
        if token.kind != TokenKind::Word {
            continue;
        }
        match text {
            "console" => {
                if sig
                    .get(index + 2)
                    .map(|token| {
                        matches!(
                            token.text(source),
                            "log" | "info" | "warn" | "error" | "debug" | "trace"
                        )
                    })
                    .unwrap_or(false)
                {
                    out.console_calls += 1;
                }
            }
            "debugger" => out.debuggers += 1,
            "eval" => out.evals += 1,
            "document" => {
                if sig
                    .get(index + 2)
                    .map(|token| token.is_word(source, "write") || token.is_word(source, "writeln"))
                    .unwrap_or(false)
                {
                    out.document_writes += 1;
                }
            }
            "process" => {
                if sig
                    .get(index + 1)
                    .map(|token| token.is_punct(source, "."))
                    .unwrap_or(false)
                    && sig
                        .get(index + 2)
                        .map(|token| token.is_word(source, "env"))
                        .unwrap_or(false)
                {
                    out.dev_checks += 1;
                }
            }
            "import"
                if sig
                    .get(index + 1)
                    .map(|token| token.is_punct(source, "("))
                    .unwrap_or(false) =>
            {
                out.dynamic_imports += 1;
            }
            _ => {}
        }
    }
    for marker in [
        "regeneratorRuntime",
        "core-js",
        "@babel/runtime",
        "es6.promise",
        "polyfill",
        "nomodule",
    ] {
        if source.contains(marker) {
            out.legacy_markers.push(marker.to_string());
        }
    }
    let _ = path;
    out
}

pub fn bloat_warnings(source: &str, path: &str) -> Vec<BloatWarning> {
    let profile = profile(source, path);
    let mut warnings = Vec::new();
    if profile.source_maps > 0 {
        warnings.push(BloatWarning {
            code: "source-map",
            message: format!(
                "{} source map reference(s) found in a production asset",
                profile.source_maps
            ),
        });
    }
    if !profile.minified && source.len() > 20_000 && !path.ends_with(".min.js") {
        warnings.push(BloatWarning {
            code: "unminified",
            message: "large JavaScript file does not look minified".to_string(),
        });
    }
    if profile.console_calls > 0 {
        warnings.push(BloatWarning {
            code: "console",
            message: format!(
                "{} console call(s) shipped to production",
                profile.console_calls
            ),
        });
    }
    if profile.debuggers > 0 {
        warnings.push(BloatWarning {
            code: "debugger",
            message: format!("{} debugger statement(s)", profile.debuggers),
        });
    }
    if profile.dev_checks > 0 {
        warnings.push(BloatWarning {
            code: "dev-branch",
            message: format!(
                "{} process.env access(es); check that dev-only branches were replaced",
                profile.dev_checks
            ),
        });
    }
    if profile.document_writes > 0 {
        warnings.push(BloatWarning {
            code: "document-write",
            message: "document.write blocks parser performance".to_string(),
        });
    }
    if profile.evals > 0 {
        warnings.push(BloatWarning {
            code: "eval",
            message: "eval() prevents JavaScript engine optimizations".to_string(),
        });
    }
    if profile.data_urls > 0 {
        warnings.push(BloatWarning {
            code: "data-url",
            message: format!("{} large inline data URL(s)", profile.data_urls),
        });
    }
    if is_legacy_bundle(path) {
        warnings.push(BloatWarning {
            code: "legacy-bundle",
            message: "legacy/polyfill bundle should not be loaded by modern browsers".to_string(),
        });
    }
    warnings
}

pub fn is_legacy_bundle(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    [
        "polyfill",
        "legacy",
        "nomodule",
        "regenerator",
        "core-js",
        "-es5",
        "es2015-polyfills",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}

pub fn is_vendor_bundle(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    ["vendor", "framework", "runtime", "chunk-", "node_modules"]
        .iter()
        .any(|marker| lower.contains(marker))
}

/// Finds exports that no other module imports. Entry modules are skipped by the
/// caller, because their exports are the public runtime surface.
pub fn find_unused_exports(
    modules: &[(String, ModuleInfo)],
    used_pairs: &HashSet<(String, String)>,
    entries: &HashSet<String>,
) -> Vec<UnusedExport> {
    let mut out = Vec::new();
    for (path, info) in modules {
        if entries.contains(path) {
            continue;
        }
        for export in &info.exports {
            if export.kind == crate::modules::ExportKind::ReExport {
                continue;
            }
            if used_pairs.contains(&(path.clone(), export.name.clone())) {
                continue;
            }
            out.push(UnusedExport {
                module: path.clone(),
                name: export.name.clone(),
            });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profiles_runtime_hotspots() {
        let source = r#"
        //# sourceMappingURL=app.js.map
        if (process.env.NODE_ENV !== "production") { console.log("dev"); }
        debugger;
        const data = "data:image/png;base64,AAAA";
        const late = import("./late.js");
        "#;
        let profile = profile(source, "app.js");
        assert_eq!(profile.source_maps, 1);
        assert_eq!(profile.console_calls, 1);
        assert_eq!(profile.debuggers, 1);
        assert_eq!(profile.dev_checks, 1);
        assert_eq!(profile.dynamic_imports, 1);
    }

    #[test]
    fn flags_bloat() {
        let warnings = bloat_warnings(
            "console.log(1); debugger; eval('x'); document.write('y');",
            "assets/app.js",
        );
        let codes: Vec<_> = warnings.iter().map(|warning| warning.code).collect();
        assert!(codes.contains(&"console"));
        assert!(codes.contains(&"debugger"));
        assert!(codes.contains(&"eval"));
        assert!(codes.contains(&"document-write"));
    }

    #[test]
    fn identifies_legacy_bundles() {
        assert!(is_legacy_bundle("assets/polyfills-abc.js"));
        assert!(is_legacy_bundle("legacy/chunk.js"));
        assert!(!is_legacy_bundle("assets/app.js"));
        assert!(is_vendor_bundle("assets/vendor-abc.js"));
    }

    #[test]
    fn finds_unused_exports() {
        let mut info = ModuleInfo::default();
        info.exports.push(crate::modules::Export {
            name: "used".into(),
            kind: crate::modules::ExportKind::Named,
            from: None,
        });
        info.exports.push(crate::modules::Export {
            name: "dead".into(),
            kind: crate::modules::ExportKind::Named,
            from: None,
        });
        let modules = vec![("a.js".to_string(), info)];
        let used_pairs = HashSet::from([("a.js".to_string(), "used".to_string())]);
        let entries = HashSet::new();
        let unused = find_unused_exports(&modules, &used_pairs, &entries);
        assert_eq!(unused.len(), 1);
        assert_eq!(unused[0].name, "dead");
    }
}
