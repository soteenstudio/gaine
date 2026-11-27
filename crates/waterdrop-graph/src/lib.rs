use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use waterdrop_core::{asset_kind, content_hash, resolve_ref, AssetKind};
use waterdrop_html::analyze;
use waterdrop_js::{find_unused_exports, scan_modules, ExportKind, ModuleInfo, UnusedExport};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Edge {
    pub to: String,
    pub kind: &'static str,
    pub names: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct AssetNode {
    pub path: String,
    pub kind: AssetKind,
    pub bytes: usize,
    pub hash: String,
    pub edges: Vec<Edge>,
    pub module: Option<ModuleInfo>,
    pub is_entry: bool,
    pub incoming: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct MissingRef {
    pub from: String,
    pub reference: String,
    pub resolved: String,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct DuplicateGroup {
    pub hash: String,
    pub bytes: usize,
    pub paths: Vec<String>,
    pub wasted: usize,
}

#[derive(Debug, Clone, Default)]
pub struct GraphOptions {
    pub base: String,
    pub protected_prefixes: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct AssetGraph {
    pub nodes: BTreeMap<String, AssetNode>,
    pub missing: Vec<MissingRef>,
    pub entries: HashSet<String>,
}

#[derive(Debug, Clone, Default)]
pub struct GraphStats {
    pub assets: usize,
    pub bytes: usize,
    pub js_bytes: usize,
    pub css_bytes: usize,
    pub html_bytes: usize,
    pub orphans: usize,
    pub orphan_bytes: usize,
    pub duplicate_groups: usize,
    pub duplicate_bytes: usize,
    pub unused_exports: usize,
    pub missing: usize,
}

impl AssetGraph {
    pub fn build(files: &[(String, Vec<u8>)], options: &GraphOptions) -> Self {
        let paths: HashSet<String> = files.iter().map(|(path, _)| path.clone()).collect();
        let mut graph = AssetGraph::default();
        let mut missing: HashSet<MissingRef> = HashSet::new();

        for (path, bytes) in files {
            let kind = asset_kind(path);
            let text = String::from_utf8_lossy(bytes);
            let mut node = AssetNode {
                path: path.clone(),
                kind,
                bytes: bytes.len(),
                hash: content_hash(bytes),
                edges: Vec::new(),
                module: None,
                is_entry: kind == AssetKind::Html,
                incoming: 0,
            };
            let mut edges: Vec<Edge> = Vec::new();
            let mut record = |reference: &str, kind: &'static str, names: Vec<String>| {
                let target = resolve_target(path, reference, &options.base, &paths);
                if let Some(target) = target {
                    if !edges
                        .iter()
                        .any(|edge| edge.to == target && edge.kind == kind)
                    {
                        edges.push(Edge {
                            to: target,
                            kind,
                            names,
                        });
                    }
                } else if is_local_reference(reference) {
                    if let Some(resolved) = resolve_ref(path, reference, &options.base) {
                        missing.insert(MissingRef {
                            from: path.clone(),
                            reference: reference.to_string(),
                            resolved,
                        });
                    }
                }
            };

            match kind {
                AssetKind::Html => {
                    let analysis = analyze(&text);
                    for reference in &analysis.references {
                        record(&reference.url, reference.kind.as_str(), Vec::new());
                    }
                    for style in &analysis.inline_styles {
                        for url in waterdrop_css::asset_urls(style) {
                            record(&url, "css-url", Vec::new());
                        }
                    }
                }
                AssetKind::Css => {
                    for url in waterdrop_css::asset_urls(&text) {
                        record(&url, "css-url", Vec::new());
                    }
                }
                AssetKind::JavaScript => {
                    let info = scan_modules(&text);
                    for import in &info.imports {
                        if import.type_only || is_bare_specifier(&import.specifier) {
                            continue;
                        }
                        let mut names: Vec<String> = import
                            .names
                            .iter()
                            .map(|name| name.imported.clone())
                            .collect();
                        if import.namespace.is_some() {
                            names.push("*".to_string());
                        }
                        record(&import.specifier, "import", names);
                    }
                    for specifier in info.dynamic_imports.iter().chain(info.requires.iter()) {
                        if is_bare_specifier(specifier) {
                            continue;
                        }
                        record(specifier, "dynamic", vec!["*".to_string()]);
                    }
                    for url in &info.urls {
                        record(url, "url", Vec::new());
                    }
                    node.module = Some(info);
                }
                _ => {}
            }

            node.edges = edges;
            graph.nodes.insert(path.clone(), node);
        }

        let incoming: HashMap<String, usize> = {
            let mut counts = HashMap::new();
            for node in graph.nodes.values() {
                for edge in &node.edges {
                    *counts.entry(edge.to.clone()).or_insert(0) += 1;
                }
            }
            counts
        };
        for (path, count) in incoming {
            if let Some(node) = graph.nodes.get_mut(&path) {
                node.incoming = count;
            }
        }
        // Scripts referenced by HTML are entry chunks; their exports are public
        // to the runtime even when nothing else imports them.
        let script_targets: Vec<String> = graph
            .nodes
            .values()
            .filter(|node| node.kind == AssetKind::Html)
            .flat_map(|node| {
                node.edges
                    .iter()
                    .filter(|edge| matches!(edge.kind, "script" | "module"))
                    .map(|edge| edge.to.clone())
            })
            .collect();
        for path in script_targets {
            if let Some(node) = graph.nodes.get_mut(&path) {
                node.is_entry = true;
            }
        }
        // Chunks with no incoming edge (manifest-only entries) must not be
        // reported as dead just because HTML does not mention them.
        let no_incoming: Vec<String> = graph
            .nodes
            .values()
            .filter(|node| node.kind == AssetKind::JavaScript && node.incoming == 0)
            .map(|node| node.path.clone())
            .collect();
        for path in no_incoming {
            if let Some(node) = graph.nodes.get_mut(&path) {
                node.is_entry = true;
            }
        }
        graph.entries = graph
            .nodes
            .values()
            .filter(|node| node.is_entry)
            .map(|node| node.path.clone())
            .collect();
        graph.missing = missing.into_iter().collect();
        graph.missing.sort();
        graph
    }

    pub fn reachable_from(&self, entry: &str) -> HashSet<String> {
        let mut seen = HashSet::new();
        let mut queue = VecDeque::new();
        if self.nodes.contains_key(entry) {
            queue.push_back(entry.to_string());
            seen.insert(entry.to_string());
        }
        while let Some(path) = queue.pop_front() {
            if let Some(node) = self.nodes.get(&path) {
                for edge in &node.edges {
                    if seen.insert(edge.to.clone()) {
                        queue.push_back(edge.to.clone());
                    }
                }
            }
        }
        seen
    }

    pub fn reachable(&self) -> HashSet<String> {
        let mut seen = HashSet::new();
        for entry in &self.entries {
            seen.extend(self.reachable_from(entry));
        }
        seen
    }

    pub fn page_assets(&self, page: &str) -> Vec<String> {
        let mut assets: Vec<String> = self
            .reachable_from(page)
            .into_iter()
            .filter(|path| path != page)
            .collect();
        assets.sort();
        assets
    }

    pub fn orphans(&self, protected_prefixes: &[String]) -> Vec<String> {
        if self.entries.is_empty() {
            return Vec::new();
        }
        let reachable = self.reachable();
        let mut orphans: Vec<String> = self
            .nodes
            .values()
            .filter(|node| {
                node.kind != AssetKind::Html
                    && !reachable.contains(&node.path)
                    && !protected_prefixes
                        .iter()
                        .any(|prefix| node.path.starts_with(prefix))
            })
            .map(|node| node.path.clone())
            .collect();
        orphans.sort();
        orphans
    }

    pub fn duplicate_groups(&self) -> Vec<DuplicateGroup> {
        let mut groups: BTreeMap<String, Vec<&AssetNode>> = BTreeMap::new();
        for node in self.nodes.values() {
            if matches!(node.kind, AssetKind::Html | AssetKind::Map) || node.bytes == 0 {
                continue;
            }
            groups.entry(node.hash.clone()).or_default().push(node);
        }
        groups
            .into_iter()
            .filter(|(_, nodes)| nodes.len() > 1)
            .map(|(hash, nodes)| {
                let mut paths: Vec<String> = nodes.iter().map(|node| node.path.clone()).collect();
                paths.sort();
                let bytes = nodes[0].bytes;
                DuplicateGroup {
                    hash,
                    bytes,
                    wasted: bytes.saturating_mul(paths.len().saturating_sub(1)),
                    paths,
                }
            })
            .collect()
    }

    pub fn unused_exports(&self) -> Vec<UnusedExport> {
        let mut modules: Vec<(String, ModuleInfo)> = Vec::new();
        let mut used_pairs: HashSet<(String, String)> = HashSet::new();
        for node in self.nodes.values() {
            let Some(module) = &node.module else {
                continue;
            };
            modules.push((node.path.clone(), module.clone()));
            for edge in &node.edges {
                for name in &edge.names {
                    if name == "*" {
                        if let Some(target) = self.nodes.get(&edge.to) {
                            if let Some(target_module) = &target.module {
                                for export in &target_module.exports {
                                    if export.kind != ExportKind::ReExport {
                                        used_pairs.insert((edge.to.clone(), export.name.clone()));
                                    }
                                }
                            }
                        }
                    } else {
                        used_pairs.insert((edge.to.clone(), name.clone()));
                    }
                }
            }
        }
        find_unused_exports(&modules, &used_pairs, &self.entries)
    }

    pub fn stats(&self, protected_prefixes: &[String]) -> GraphStats {
        let mut stats = GraphStats {
            assets: self.nodes.len(),
            ..GraphStats::default()
        };
        for node in self.nodes.values() {
            stats.bytes += node.bytes;
            match node.kind {
                AssetKind::JavaScript => stats.js_bytes += node.bytes,
                AssetKind::Css => stats.css_bytes += node.bytes,
                AssetKind::Html => stats.html_bytes += node.bytes,
                _ => {}
            }
        }
        let orphans = self.orphans(protected_prefixes);
        stats.orphans = orphans.len();
        stats.orphan_bytes = orphans
            .iter()
            .filter_map(|path| self.nodes.get(path))
            .map(|node| node.bytes)
            .sum();
        let duplicates = self.duplicate_groups();
        stats.duplicate_groups = duplicates.len();
        stats.duplicate_bytes = duplicates.iter().map(|group| group.wasted).sum();
        stats.unused_exports = self.unused_exports().len();
        stats.missing = self.missing.len();
        stats
    }
}

fn is_bare_specifier(reference: &str) -> bool {
    !reference.starts_with('.')
        && !reference.starts_with('/')
        && !reference.starts_with("_next/")
        && reference
            .chars()
            .next()
            .map(|ch| ch.is_ascii_alphabetic() || ch == '@')
            .unwrap_or(false)
}

fn is_local_reference(reference: &str) -> bool {
    if reference.starts_with('#')
        || reference.starts_with("data:")
        || reference.starts_with("mailto:")
        || reference.starts_with("javascript:")
        || reference.starts_with("blob:")
        || reference.starts_with("//")
        || reference.starts_with("http://")
        || reference.starts_with("https://")
    {
        return false;
    }
    reference.starts_with('/')
        || reference.starts_with("./")
        || reference.starts_with("../")
        || !is_bare_specifier(reference)
}

pub fn resolve_target(
    from: &str,
    reference: &str,
    base: &str,
    paths: &HashSet<String>,
) -> Option<String> {
    if reference.is_empty()
        || reference.starts_with('#')
        || reference.starts_with("data:")
        || reference.starts_with("mailto:")
        || reference.starts_with("javascript:")
        || reference.starts_with("blob:")
        || reference.starts_with("//")
        || reference.starts_with("http://")
        || reference.starts_with("https://")
    {
        return None;
    }
    let resolved = resolve_ref(from, reference, base)?;
    let mut candidates = vec![resolved.clone()];
    if let Some(stripped) = resolved.strip_prefix("_next/") {
        candidates.push(stripped.to_string());
    }
    if let Some(stripped) = resolved.strip_prefix("next/") {
        candidates.push(stripped.to_string());
    }
    let last = resolved.rsplit('/').next().unwrap_or("");
    if !last.contains('.') || resolved.ends_with('/') {
        for candidate in candidates.clone() {
            for extension in ["js", "mjs", "cjs", "css", "json"] {
                candidates.push(format!("{candidate}.{extension}"));
            }
            candidates.push(format!("{candidate}/index.js"));
            candidates.push(format!("{candidate}/index.mjs"));
            candidates.push(format!("{candidate}/index.css"));
        }
    }
    candidates
        .into_iter()
        .find(|candidate| paths.contains(candidate))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files() -> Vec<(String, Vec<u8>)> {
        vec![
            (
                "index.html".into(),
                br#"<link rel="stylesheet" href="/assets/app.css"><script type="module" src="/assets/app.js"></script><img src="/assets/hero.png">"#.to_vec(),
            ),
            (
                "assets/app.js".into(),
                br#"import { helper } from "./helper.js"; import "./chunk.js"; const x = import("./late.js"); new URL("./bg.png", import.meta.url); export function main() { return helper(); } export function dead() {}"#.to_vec(),
            ),
            (
                "assets/helper.js".into(),
                br#"export function helper() { return 1 } export function unusedHelper() {}"#.to_vec(),
            ),
            ("assets/chunk.js".into(), b"console.log('chunk')".to_vec()),
            ("assets/late.js".into(), b"export const late = 1".to_vec()),
            ("assets/app.css".into(), br#".hero { background: url("./bg.png") }"#.to_vec()),
            ("assets/hero.png".into(), vec![1, 2, 3]),
            ("assets/bg.png".into(), vec![1, 2, 3]),
            ("assets/orphan.png".into(), vec![9, 9, 9]),
        ]
    }

    #[test]
    fn builds_graph_and_finds_orphans() {
        let graph = AssetGraph::build(&files(), &GraphOptions::default());
        assert_eq!(graph.nodes.len(), 9);
        assert_eq!(
            graph.entries,
            HashSet::from(["index.html".to_string(), "assets/app.js".to_string()]),
            "HTML pages and their script entry chunks are entries"
        );
        let reachable = graph.reachable();
        assert!(reachable.contains("assets/app.js"));
        assert!(reachable.contains("assets/helper.js"));
        assert!(reachable.contains("assets/late.js"));
        assert!(reachable.contains("assets/bg.png"));
        assert!(!reachable.contains("assets/orphan.png"));
        assert_eq!(graph.orphans(&[]), ["assets/orphan.png"]);
        let page = graph.page_assets("index.html");
        assert!(page.contains(&"assets/hero.png".to_string()));
        assert!(!page.contains(&"assets/orphan.png".to_string()));
    }

    #[test]
    fn resolves_relative_and_index_references() {
        let paths = HashSet::from([
            "a/b.js".to_string(),
            "a/c.js".to_string(),
            "a/d/index.js".to_string(),
            "_next/static/chunks/x.js".to_string(),
            "static/chunks/y.js".to_string(),
        ]);
        assert_eq!(
            resolve_target("a/b.js", "./c", "/", &paths),
            Some("a/c.js".to_string())
        );
        assert_eq!(
            resolve_target("a/b.js", "./d", "/", &paths),
            Some("a/d/index.js".to_string())
        );
        assert_eq!(
            resolve_target("index.html", "/_next/static/chunks/y.js", "/", &paths),
            Some("static/chunks/y.js".to_string())
        );
        assert_eq!(resolve_target("a/b.js", "react", "/", &paths), None);
    }

    #[test]
    fn reports_duplicates_and_missing_refs() {
        let graph = AssetGraph::build(
            &[
                (
                    "index.html".into(),
                    b"<img src=\"/a.png\"><img src=\"/b.png\"><img src=\"/gone.png\">".to_vec(),
                ),
                ("a.png".into(), vec![1, 2, 3]),
                ("b.png".into(), vec![1, 2, 3]),
            ],
            &GraphOptions::default(),
        );
        let duplicates = graph.duplicate_groups();
        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0].wasted, 3);
        assert!(graph
            .missing
            .iter()
            .any(|item| item.reference == "/gone.png"));
    }

    #[test]
    fn finds_unused_exports_and_respects_bulk_imports() {
        let graph = AssetGraph::build(&files(), &GraphOptions::default());
        let unused = graph.unused_exports();
        assert!(unused
            .iter()
            .any(|item| item.name == "unusedHelper" && item.module == "assets/helper.js"));
        assert!(
            !unused.iter().any(|item| item.module == "assets/app.js"),
            "entry modules expose the public runtime surface"
        );
        assert!(graph
            .nodes
            .get("assets/app.js")
            .map(|node| node.is_entry)
            .unwrap_or(false));
    }

    #[test]
    fn stats_add_up() {
        let graph = AssetGraph::build(&files(), &GraphOptions::default());
        let stats = graph.stats(&[]);
        assert_eq!(stats.assets, 9);
        assert_eq!(stats.orphans, 1);
        assert_eq!(stats.missing, 0);
        assert!(stats.js_bytes > 0 && stats.css_bytes > 0);
    }
}
