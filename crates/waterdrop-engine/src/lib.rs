use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use waterdrop_core::{
    compressed_estimate, content_hash, join_path, relative_path, Diagnostic, Json, Level,
};
use waterdrop_graph::{AssetGraph, GraphOptions};
use waterdrop_html::{analyze, optimize, OptimizeOptions, RefKind};
use waterdrop_js::{bloat_warnings, is_minified, minify, MinifyOptions};
use waterdrop_report::{
    Budget, DuplicateReport, FileReport, MissingReport, PageReport, Report, Summary,
    UnusedExportReport,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Build,
    Analyze,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MinifyMode {
    Auto,
    Always,
    Never,
}

#[derive(Debug, Clone)]
pub struct HtmlConfig {
    pub minify: bool,
    pub remove_comments: bool,
    pub lazy_images: bool,
    pub lazy_iframes: bool,
    pub eager_images: usize,
    pub priority_images: usize,
    pub decode_async: bool,
    pub drop_nomodule: bool,
    pub prune_missing_hints: bool,
    pub module_preload: bool,
    pub max_module_preloads: usize,
    pub minify_inline_js: bool,
    pub minify_inline_css: bool,
}

impl Default for HtmlConfig {
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
            prune_missing_hints: true,
            module_preload: true,
            max_module_preloads: 8,
            minify_inline_js: true,
            minify_inline_css: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct JsConfig {
    pub minify: MinifyMode,
    pub analyze: bool,
    pub drop_source_maps: bool,
}

impl Default for JsConfig {
    fn default() -> Self {
        Self {
            minify: MinifyMode::Auto,
            analyze: true,
            drop_source_maps: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CssConfig {
    pub minify: MinifyMode,
    pub purge: bool,
    pub analyze: bool,
}

impl Default for CssConfig {
    fn default() -> Self {
        Self {
            minify: MinifyMode::Auto,
            purge: false,
            analyze: true,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct PruneConfig {
    pub orphans: bool,
    pub duplicates: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ReportConfig {
    pub path: Option<String>,
    pub pretty: bool,
}

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub mode: Mode,
    pub root: PathBuf,
    pub out_dir: Option<PathBuf>,
    pub base: String,
    pub html: HtmlConfig,
    pub js: JsConfig,
    pub css: CssConfig,
    pub prune: PruneConfig,
    pub budget: Budget,
    pub report: ReportConfig,
    pub dry_run: bool,
    pub exclude: Vec<String>,
    pub protected: Vec<String>,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            mode: Mode::Build,
            root: PathBuf::from("."),
            out_dir: None,
            base: "/".to_string(),
            html: HtmlConfig::default(),
            js: JsConfig::default(),
            css: CssConfig::default(),
            prune: PruneConfig::default(),
            budget: Budget::default(),
            report: ReportConfig::default(),
            dry_run: false,
            exclude: vec![
                "node_modules".to_string(),
                ".git".to_string(),
                ".turbo".to_string(),
                ".cache".to_string(),
                "coverage".to_string(),
            ],
            protected: Vec::new(),
        }
    }
}

impl EngineConfig {
    pub fn from_json(value: &Json) -> Result<Self, String> {
        let mut config = EngineConfig::default();
        if let Some(mode) = value.get("mode").and_then(Json::as_str) {
            config.mode = match mode {
                "analyze" => Mode::Analyze,
                "build" => Mode::Build,
                other => return Err(format!("unknown mode: {other}")),
            };
        }
        if let Some(root) = value.get("root").and_then(Json::as_str) {
            config.root = PathBuf::from(root);
        }
        if let Some(out) = string_or(value.get("outDir"), value.get("out_dir")) {
            config.out_dir = Some(PathBuf::from(out));
        }
        if let Some(base) = value.get("base").and_then(Json::as_str) {
            config.base = base.to_string();
        }
        if let Some(dry) = value.get("dryRun").and_then(Json::as_bool) {
            config.dry_run = dry;
        }
        if let Some(exclude) = value.get("exclude") {
            config.exclude = exclude.string_list();
        }
        if let Some(protected) = value.get("protected") {
            config.protected = protected.string_list();
        }

        if let Some(html) = value.get("html") {
            if let Some(flag) = html.get("enabled").and_then(Json::as_bool) {
                if !flag {
                    config.html.minify = false;
                    config.html.lazy_images = false;
                    config.html.lazy_iframes = false;
                    config.html.module_preload = false;
                }
            }
            set_bool(&mut config.html.minify, html, "minify");
            set_bool(&mut config.html.remove_comments, html, "removeComments");
            set_bool(&mut config.html.lazy_images, html, "lazyImages");
            set_bool(&mut config.html.lazy_iframes, html, "lazyIframes");
            set_bool(&mut config.html.decode_async, html, "decodeAsync");
            set_bool(&mut config.html.drop_nomodule, html, "dropNomodule");
            set_bool(
                &mut config.html.prune_missing_hints,
                html,
                "pruneMissingHints",
            );
            set_bool(&mut config.html.module_preload, html, "modulePreload");
            set_bool(&mut config.html.minify_inline_js, html, "minifyInlineJs");
            set_bool(&mut config.html.minify_inline_css, html, "minifyInlineCss");
            set_usize(&mut config.html.eager_images, html, "eagerImages");
            set_usize(&mut config.html.priority_images, html, "priorityImages");
            set_usize(
                &mut config.html.max_module_preloads,
                html,
                "maxModulePreloads",
            );
        }

        if let Some(js) = value.get("js") {
            if let Some(mode) = js
                .get("minify")
                .and_then(parse_minify_mode)
                .or_else(|| value.get("minifyJs").and_then(parse_minify_mode))
            {
                config.js.minify = mode;
            }
            set_bool(&mut config.js.analyze, js, "analyze");
            set_bool(&mut config.js.drop_source_maps, js, "dropSourceMaps");
        }

        if let Some(css) = value.get("css") {
            if let Some(mode) = css.get("minify").and_then(parse_minify_mode) {
                config.css.minify = mode;
            }
            set_bool(&mut config.css.purge, css, "purge");
            set_bool(&mut config.css.analyze, css, "analyze");
        }

        if let Some(prune) = value.get("prune") {
            if let Some(flag) = prune.as_bool() {
                config.prune.orphans = flag;
            } else {
                set_bool(&mut config.prune.orphans, prune, "orphans");
                set_bool(&mut config.prune.duplicates, prune, "duplicates");
            }
        }
        if let Some(orphans) = value.get("pruneOrphans").and_then(Json::as_bool) {
            config.prune.orphans = orphans;
        }

        if let Some(budget) = value.get("budget") {
            config.budget = Budget {
                js: budget.get("js").and_then(Json::as_usize),
                css: budget.get("css").and_then(Json::as_usize),
                total: budget.get("total").and_then(Json::as_usize),
            };
        }

        if let Some(report) = value.get("report") {
            if let Some(path) = report.as_str() {
                config.report.path = Some(path.to_string());
            } else {
                config.report.path = report
                    .get("path")
                    .and_then(Json::as_str)
                    .map(ToOwned::to_owned);
                set_bool(&mut config.report.pretty, report, "pretty");
            }
        }
        Ok(config)
    }
}

fn string_or<'a>(a: Option<&'a Json>, b: Option<&'a Json>) -> Option<&'a str> {
    a.and_then(Json::as_str)
        .or_else(|| b.and_then(Json::as_str))
}

fn parse_minify_mode(value: &Json) -> Option<MinifyMode> {
    if let Some(flag) = value.as_bool() {
        return Some(if flag {
            MinifyMode::Always
        } else {
            MinifyMode::Never
        });
    }
    match value.as_str()? {
        "auto" => Some(MinifyMode::Auto),
        "always" | "true" => Some(MinifyMode::Always),
        "never" | "false" => Some(MinifyMode::Never),
        _ => None,
    }
}

fn set_bool(target: &mut bool, object: &Json, key: &str) {
    if let Some(value) = object.get(key).and_then(Json::as_bool) {
        *target = value;
    }
}

fn set_usize(target: &mut usize, object: &Json, key: &str) {
    if let Some(value) = object.get(key).and_then(Json::as_usize) {
        *target = value;
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub path: String,
    pub kind: &'static str,
    pub before: usize,
    pub after: usize,
}

#[derive(Debug, Clone)]
pub struct BuildOutcome {
    pub report: Report,
    pub changes: Vec<Change>,
    pub pruned: Vec<String>,
    pub written: bool,
    pub budget_failed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EngineError {
    pub message: String,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for EngineError {}

impl EngineError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

pub fn run(config: &EngineConfig) -> Result<BuildOutcome, EngineError> {
    let started = Instant::now();
    let root = config.root.clone();
    let out_dir = config.out_dir.clone().unwrap_or_else(|| root.clone());
    if !out_dir.is_dir() {
        return Err(EngineError::new(format!(
            "output directory does not exist: {}",
            out_dir.display()
        )));
    }

    let mut contents: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    for path in walk(&out_dir, &config.exclude)? {
        let relative = relative_path(&out_dir, &path);
        if relative.is_empty() {
            continue;
        }
        let bytes = fs::read(&path).map_err(|error| {
            EngineError::new(format!("cannot read {}: {error}", path.display()))
        })?;
        contents.insert(relative, bytes);
    }
    if contents.is_empty() {
        return Err(EngineError::new(format!(
            "no files found in {}",
            out_dir.display()
        )));
    }

    let pre_graph = build_graph(&contents, config);
    let mut changes: Vec<Change> = Vec::new();
    let mut pruned: Vec<String> = Vec::new();
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    if config.mode == Mode::Build {
        optimize_javascript(&mut contents, &pre_graph, config, &mut changes);
        optimize_css(&mut contents, &pre_graph, config, &mut changes);
        optimize_html(&mut contents, &pre_graph, config, &mut changes);
        if config.prune.orphans || config.prune.duplicates {
            prune_files(&mut contents, &pre_graph, config, &mut pruned);
        }
    }

    let final_graph = build_graph(&contents, config);
    let mut report = compose_report(config, &root, &out_dir, &contents, &final_graph, &pre_graph);
    report.duration_ms = started.elapsed().as_millis() as u64;
    report.pruned.orphans = pruned.clone();
    report.pruned.bytes = pruned
        .iter()
        .filter_map(|path| pre_graph.nodes.get(path))
        .map(|node| node.bytes)
        .sum();
    report.diagnostics.append(&mut diagnostics);

    for warning in report.files.iter().flat_map(|file| {
        file.bloat
            .iter()
            .map(move |code| (file.path.clone(), code.clone()))
    }) {
        report.diagnostics.push(Diagnostic::new(
            Level::Warning,
            "bloat",
            format!("{}: {}", warning.1, warning.0),
        ));
    }
    for orphan in &report.orphans {
        report.diagnostics.push(
            Diagnostic::new(
                Level::Warning,
                "orphan",
                "asset is not reachable from any HTML entry",
            )
            .at(orphan.clone()),
        );
    }
    for duplicate in &report.duplicates {
        report.diagnostics.push(Diagnostic::new(
            Level::Warning,
            "duplicate",
            format!(
                "{} identical files waste {} bytes",
                duplicate.paths.len(),
                duplicate.wasted
            ),
        ));
    }
    for missing in &report.missing {
        report.diagnostics.push(
            Diagnostic::new(
                Level::Warning,
                "missing-ref",
                format!("reference {} does not exist", missing.reference),
            )
            .at(missing.from.clone()),
        );
    }
    for unused in &report.unused_exports {
        report.diagnostics.push(
            Diagnostic::new(
                Level::Warning,
                "unused-export",
                format!("export '{}' is never imported", unused.name),
            )
            .at(unused.module.clone()),
        );
    }
    let failures = report.budget_failures();
    report.summary.budget_ok = failures.is_empty();
    if !failures.is_empty() {
        for failure in &failures {
            report
                .diagnostics
                .push(Diagnostic::new(Level::Error, "budget", failure));
        }
    }

    let changed_paths: BTreeSet<&str> = changes.iter().map(|change| change.path.as_str()).collect();
    if config.mode == Mode::Build && !config.dry_run {
        for path in &changed_paths {
            if let Some(bytes) = contents.get(*path) {
                let absolute = join_path(&out_dir, path);
                if let Some(parent) = absolute.parent() {
                    fs::create_dir_all(parent).map_err(|error| {
                        EngineError::new(format!("cannot create {}: {error}", parent.display()))
                    })?;
                }
                fs::write(&absolute, bytes).map_err(|error| {
                    EngineError::new(format!("cannot write {}: {error}", absolute.display()))
                })?;
            }
        }
        for path in &pruned {
            let absolute = join_path(&out_dir, path);
            let _ = fs::remove_file(absolute);
        }
    }
    if let Some(path) = &config.report.path {
        let absolute = if Path::new(path).is_absolute() {
            PathBuf::from(path)
        } else {
            join_path(&root, path)
        };
        if let Some(parent) = absolute.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                EngineError::new(format!("cannot create {}: {error}", parent.display()))
            })?;
        }
        let body = if path.ends_with(".json") {
            if config.report.pretty {
                report.to_pretty_json()
            } else {
                report.to_json_string()
            }
        } else {
            report.render_text()
        };
        fs::write(&absolute, body).map_err(|error| {
            EngineError::new(format!(
                "cannot write report {}: {error}",
                absolute.display()
            ))
        })?;
    }

    Ok(BuildOutcome {
        budget_failed: !report.summary.budget_ok,
        report,
        changes,
        pruned,
        written: config.mode == Mode::Build && !config.dry_run,
    })
}

fn build_graph(contents: &BTreeMap<String, Vec<u8>>, config: &EngineConfig) -> AssetGraph {
    let files: Vec<(String, Vec<u8>)> = contents
        .iter()
        .map(|(path, bytes)| (path.clone(), bytes.clone()))
        .collect();
    AssetGraph::build(
        &files,
        &GraphOptions {
            base: config.base.clone(),
            protected_prefixes: config.protected.clone(),
        },
    )
}

fn optimize_javascript(
    contents: &mut BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
    config: &EngineConfig,
    changes: &mut Vec<Change>,
) {
    let paths: Vec<String> = graph
        .nodes
        .values()
        .filter(|node| node.kind == waterdrop_core::AssetKind::JavaScript)
        .map(|node| node.path.clone())
        .collect();
    for path in paths {
        let Some(bytes) = contents.get(&path) else {
            continue;
        };
        let before = bytes.len();
        let Ok(source) = std::str::from_utf8(bytes) else {
            continue;
        };
        let should_minify = match config.js.minify {
            MinifyMode::Always => true,
            MinifyMode::Never => false,
            MinifyMode::Auto => !is_minified(source) && !path.ends_with(".min.js"),
        };
        let mut next = source.to_string();
        if config.js.drop_source_maps && next.contains("sourceMappingURL") {
            next = waterdrop_js::strip_source_maps(&next);
        }
        if should_minify {
            let result = minify(
                &next,
                &MinifyOptions {
                    safe: true,
                    strip_source_maps: config.js.drop_source_maps,
                    keep_license: true,
                },
            );
            if result.code.len() < next.len() {
                next = result.code;
            }
        }
        if next.len() < before {
            let after = next.len();
            contents.insert(path.clone(), next.into_bytes());
            changes.push(Change {
                path,
                kind: "js",
                before,
                after,
            });
        }
    }
}

fn optimize_css(
    contents: &mut BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
    config: &EngineConfig,
    changes: &mut Vec<Change>,
) {
    if config.css.minify == MinifyMode::Never && !config.css.purge {
        return;
    }
    let usage = html_usage(contents, graph);
    let paths: Vec<String> = graph
        .nodes
        .values()
        .filter(|node| node.kind == waterdrop_core::AssetKind::Css)
        .map(|node| node.path.clone())
        .collect();
    for path in paths {
        let Some(bytes) = contents.get(&path) else {
            continue;
        };
        let before = bytes.len();
        let Ok(source) = std::str::from_utf8(bytes) else {
            continue;
        };
        let mut next = source.to_string();
        if config.css.purge {
            if let Some(usage) = &usage {
                let (purged, removed) = waterdrop_css::purge(&next, usage);
                if removed > 0 {
                    next = purged;
                }
            }
        }
        let should_minify = match config.css.minify {
            MinifyMode::Always => true,
            MinifyMode::Never => false,
            MinifyMode::Auto => !css_looks_minified(&next),
        };
        if should_minify {
            let minified = waterdrop_css::minify(&next);
            if minified.len() < next.len() {
                next = minified;
            }
        }
        if next.len() < before {
            let after = next.len();
            contents.insert(path.clone(), next.into_bytes());
            changes.push(Change {
                path,
                kind: "css",
                before,
                after,
            });
        }
    }
}

fn html_usage(
    contents: &BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
) -> Option<waterdrop_css::SelectorUsage> {
    let mut classes = HashSet::new();
    let mut ids = HashSet::new();
    let mut tags = HashSet::new();
    let mut found = false;
    for node in graph
        .nodes
        .values()
        .filter(|node| node.kind == waterdrop_core::AssetKind::Html)
    {
        let Some(bytes) = contents.get(&node.path) else {
            continue;
        };
        let analysis = analyze(&String::from_utf8_lossy(bytes));
        found = true;
        classes.extend(analysis.classes);
        ids.extend(analysis.ids);
        tags.extend(analysis.tags);
    }
    found.then(|| waterdrop_css::SelectorUsage::new(classes, ids, tags))
}

fn css_looks_minified(css: &str) -> bool {
    if css.len() < 300 {
        return false;
    }
    let lines = css.lines().count().max(1);
    lines * 160 < css.len() || css.lines().all(|line| line.len() < 400) && css.len() / lines > 120
}

fn optimize_html(
    contents: &mut BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
    config: &EngineConfig,
    changes: &mut Vec<Change>,
) {
    if !config.html.minify
        && !config.html.lazy_images
        && !config.html.module_preload
        && !config.html.prune_missing_hints
    {
        return;
    }
    let assets: Vec<String> = graph.nodes.keys().cloned().collect();
    let paths: Vec<String> = graph
        .nodes
        .values()
        .filter(|node| node.kind == waterdrop_core::AssetKind::Html)
        .map(|node| node.path.clone())
        .collect();
    for page in paths {
        let Some(bytes) = contents.get(&page) else {
            continue;
        };
        let before = bytes.len();
        let source = String::from_utf8_lossy(bytes).to_string();
        let analysis = analyze(&source);
        let modulepreload = if config.html.module_preload {
            modulepreloads_for(&page, &analysis, graph, config)
        } else {
            Vec::new()
        };
        let result = optimize(
            &source,
            &OptimizeOptions {
                minify: config.html.minify,
                remove_comments: config.html.remove_comments,
                lazy_images: config.html.lazy_images,
                lazy_iframes: config.html.lazy_iframes,
                eager_images: config.html.eager_images,
                priority_images: config.html.priority_images,
                decode_async: config.html.decode_async,
                drop_nomodule: config.html.drop_nomodule,
                dedupe_hints: true,
                prune_missing: config.html.prune_missing_hints,
                assets: assets.clone(),
                page: page.clone(),
                base: config.base.clone(),
                inject_modulepreload: modulepreload,
                inject_head: String::new(),
                inject_body_end: String::new(),
                minify_inline_js: config.html.minify_inline_js,
                minify_inline_css: config.html.minify_inline_css,
            },
        );
        if result.html != source {
            let after = result.html.len();
            contents.insert(page.clone(), result.html.into_bytes());
            changes.push(Change {
                path: page,
                kind: "html",
                before,
                after,
            });
        }
    }
}

fn modulepreloads_for(
    page: &str,
    analysis: &waterdrop_html::HtmlAnalysis,
    graph: &AssetGraph,
    config: &EngineConfig,
) -> Vec<String> {
    let paths: HashSet<String> = graph.nodes.keys().cloned().collect();
    let mut urls: Vec<String> = Vec::new();
    for reference in &analysis.references {
        if reference.kind != RefKind::ModuleScript {
            continue;
        }
        let Some(target) =
            waterdrop_graph::resolve_target(page, &reference.url, &config.base, &paths)
        else {
            continue;
        };
        let script_dir = reference
            .url
            .split(['?', '#'])
            .next()
            .unwrap_or(&reference.url)
            .rsplit_once('/')
            .map(|(dir, _)| format!("{dir}/"))
            .unwrap_or_else(|| "/".to_string());
        let target_dir = target.rsplit_once('/').map(|(dir, _)| dir).unwrap_or("");
        let mut queue = vec![target.clone()];
        let mut seen = HashSet::from([target.clone()]);
        let mut depth = 0usize;
        while !queue.is_empty() && urls.len() < config.html.max_module_preloads && depth < 3 {
            let mut next = Vec::new();
            for current in queue.drain(..) {
                let Some(node) = graph.nodes.get(&current) else {
                    continue;
                };
                for edge in &node.edges {
                    if edge.kind != "import" || !seen.insert(edge.to.clone()) {
                        continue;
                    }
                    if urls.len() >= config.html.max_module_preloads {
                        break;
                    }
                    let url = if let Some(relative) = edge.to.strip_prefix(target_dir) {
                        let relative = relative.trim_start_matches('/');
                        format!("{script_dir}{relative}")
                    } else {
                        format!("/{}", edge.to)
                    };
                    if !urls.contains(&url) {
                        urls.push(url);
                    }
                    next.push(edge.to.clone());
                }
            }
            queue = next;
            depth += 1;
        }
    }
    urls
}

fn prune_files(
    contents: &mut BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
    config: &EngineConfig,
    pruned: &mut Vec<String>,
) {
    let mut candidates: Vec<String> = if config.prune.orphans {
        graph.orphans(&config.protected)
    } else {
        Vec::new()
    };
    if config.prune.duplicates {
        for group in graph.duplicate_groups() {
            let keep = group
                .paths
                .iter()
                .find(|path| {
                    graph
                        .nodes
                        .get(*path)
                        .map(|node| node.is_entry || node.incoming > 0)
                        .unwrap_or(false)
                })
                .cloned()
                .or_else(|| group.paths.first().cloned());
            for path in &group.paths {
                if Some(path) != keep.as_ref()
                    && !config
                        .protected
                        .iter()
                        .any(|prefix| path.starts_with(prefix))
                {
                    if let Some(node) = graph.nodes.get(path) {
                        if node.incoming == 0 {
                            candidates.push(path.clone());
                        }
                    }
                }
            }
        }
    }
    candidates.sort();
    candidates.dedup();
    for path in candidates {
        if contents.remove(&path).is_some() {
            pruned.push(path);
        }
    }
}

fn compose_report(
    config: &EngineConfig,
    root: &Path,
    out_dir: &Path,
    contents: &BTreeMap<String, Vec<u8>>,
    graph: &AssetGraph,
    pre_graph: &AssetGraph,
) -> Report {
    let mut report = Report::new(
        if config.mode == Mode::Analyze {
            "analyze"
        } else {
            "build"
        },
        root.display().to_string(),
        out_dir.display().to_string(),
    );
    report.base = config.base.clone();
    report.budget = config.budget.clone();

    let mut summary = Summary::default();
    let mut files = Vec::new();
    let unused: Vec<UnusedExportReport> = graph
        .unused_exports()
        .into_iter()
        .map(|item| UnusedExportReport {
            module: item.module,
            name: item.name,
        })
        .collect();
    let mut unused_by_module: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for item in &unused {
        unused_by_module
            .entry(item.module.clone())
            .or_default()
            .push(item.name.clone());
    }

    for node in graph.nodes.values() {
        let bytes = contents.get(&node.path).map(Vec::len).unwrap_or(node.bytes);
        summary.assets += 1;
        summary.bytes += bytes;
        summary.compressed += compressed_estimate(
            contents
                .get(&node.path)
                .map(Vec::as_slice)
                .unwrap_or_default(),
        );
        match node.kind {
            waterdrop_core::AssetKind::JavaScript => summary.js += bytes,
            waterdrop_core::AssetKind::Css => summary.css += bytes,
            waterdrop_core::AssetKind::Html => summary.html += bytes,
            waterdrop_core::AssetKind::Image => summary.images += 1,
            waterdrop_core::AssetKind::Font => summary.fonts += 1,
            _ => {}
        }
        let code = contents
            .get(&node.path)
            .and_then(|bytes| std::str::from_utf8(bytes).ok());
        let bloat = if config.js.analyze && node.kind == waterdrop_core::AssetKind::JavaScript {
            code.map(|code| {
                bloat_warnings(code, &node.path)
                    .into_iter()
                    .map(|warning| warning.code.to_string())
                    .collect()
            })
            .unwrap_or_default()
        } else {
            Vec::new()
        };
        files.push(FileReport {
            path: node.path.clone(),
            kind: node.kind.as_str().to_string(),
            bytes,
            compressed: compressed_estimate(
                contents
                    .get(&node.path)
                    .map(Vec::as_slice)
                    .unwrap_or_default(),
            ),
            hash: content_hash(
                contents
                    .get(&node.path)
                    .map(Vec::as_slice)
                    .unwrap_or_default(),
            ),
            entry: node.is_entry,
            unused_exports: unused_by_module
                .get(&node.path)
                .cloned()
                .unwrap_or_default(),
            bloat,
        });
    }

    for node in graph
        .nodes
        .values()
        .filter(|node| node.kind == waterdrop_core::AssetKind::Html)
    {
        let html = contents.get(&node.path).map(Vec::len).unwrap_or(node.bytes);
        let assets = graph.page_assets(&node.path);
        let mut js = 0usize;
        let mut css = 0usize;
        for asset in &assets {
            if let Some(asset_node) = graph.nodes.get(asset) {
                match asset_node.kind {
                    waterdrop_core::AssetKind::JavaScript => js += asset_node.bytes,
                    waterdrop_core::AssetKind::Css => css += asset_node.bytes,
                    _ => {}
                }
            }
        }
        let inline = contents
            .get(&node.path)
            .map(|bytes| {
                let analysis = analyze(&String::from_utf8_lossy(bytes));
                let mut inline = String::new();
                for script in analysis.inline_scripts {
                    inline.push_str(&script.code);
                }
                for style in analysis.inline_styles {
                    inline.push_str(&style);
                }
                compressed_estimate(inline.as_bytes())
            })
            .unwrap_or(0);
        report.pages.push(PageReport {
            page: format!("/{}", node.path),
            html,
            js,
            css,
            inline,
            total: html + js + css,
            files: assets.iter().map(|path| format!("/{path}")).collect(),
        });
    }

    report.summary = summary;
    report.files = files;
    report.unused_exports = unused;
    report.orphans = graph.orphans(&config.protected);
    report.duplicates = graph
        .duplicate_groups()
        .into_iter()
        .map(|group| DuplicateReport {
            hash: group.hash,
            bytes: group.bytes,
            wasted: group.wasted,
            paths: group.paths,
        })
        .collect();
    report.missing = graph
        .missing
        .iter()
        .map(|item| MissingReport {
            from: item.from.clone(),
            reference: item.reference.clone(),
        })
        .collect();
    report.summary.orphans = report.orphans.len();
    report.summary.orphan_bytes = report
        .orphans
        .iter()
        .filter_map(|path| pre_graph.nodes.get(path))
        .map(|node| node.bytes)
        .sum();
    report.summary.duplicate_groups = report.duplicates.len();
    report.summary.duplicate_bytes = report.duplicates.iter().map(|group| group.wasted).sum();
    report.summary.unused_exports = report.unused_exports.len();
    report.summary.missing = report.missing.len();
    report
}

fn walk(dir: &Path, exclude: &[String]) -> Result<Vec<PathBuf>, EngineError> {
    let mut out = Vec::new();
    walk_inner(dir, dir, exclude, &mut out)?;
    out.sort();
    Ok(out)
}

fn walk_inner(
    root: &Path,
    dir: &Path,
    exclude: &[String],
    out: &mut Vec<PathBuf>,
) -> Result<(), EngineError> {
    let entries = fs::read_dir(dir)
        .map_err(|error| EngineError::new(format!("cannot read {}: {error}", dir.display())))?;
    for entry in entries {
        let entry = entry.map_err(|error| EngineError::new(error.to_string()))?;
        let path = entry.path();
        let relative = relative_path(root, &path);
        if exclude.iter().any(|prefix| {
            relative == *prefix
                || relative.starts_with(&format!("{prefix}/"))
                || entry.file_name().to_string_lossy() == prefix.as_str()
        }) {
            continue;
        }
        let file_type = entry
            .file_type()
            .map_err(|error| EngineError::new(error.to_string()))?;
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk_inner(root, &path, exclude, out)?;
        } else if file_type.is_file() {
            out.push(path);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn temp_dir(name: &str) -> PathBuf {
        let id = COUNTER.fetch_add(1, Ordering::SeqCst);
        let dir = std::env::temp_dir().join(format!(
            "waterdrop-test-{}-{}-{}",
            name,
            std::process::id(),
            id
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn site() -> PathBuf {
        let dir = temp_dir("site");
        fs::create_dir_all(dir.join("assets")).unwrap();
        fs::write(
            dir.join("index.html"),
            r#"<!doctype html><html><head><!-- remove --><link rel="preload" as="script" href="/assets/gone.js"><script type="module" src="/assets/app.js"></script></head><body><div class="hero"></div><img src="/assets/a.png"><img src="/assets/b.png"><img src="/assets/c.png"><p>hello    world</p></body></html>"#,
        )
        .unwrap();
        fs::write(
            dir.join("assets/app.js"),
            "// comment\nimport { helper } from \"./helper.js\";\n\nexport function main() {\n  return helper() + 1;\n}\n",
        )
        .unwrap();
        fs::write(
            dir.join("assets/helper.js"),
            "export function helper() {\n  return 41;\n}\nexport function unusedHelper() {\n  return 0;\n}\n",
        )
        .unwrap();
        fs::write(
            dir.join("assets/app.css"),
            "/* c */\n.hero { color: red; }\n.unused { color: blue; }\n",
        )
        .unwrap();
        fs::write(dir.join("assets/a.png"), [1, 2, 3]).unwrap();
        fs::write(dir.join("assets/b.png"), [1, 2, 3]).unwrap();
        fs::write(dir.join("assets/c.png"), [4, 5, 6]).unwrap();
        fs::write(dir.join("assets/orphan.png"), [9, 9, 9]).unwrap();
        dir
    }

    fn config(dir: &Path) -> EngineConfig {
        EngineConfig {
            root: dir.to_path_buf(),
            out_dir: Some(dir.to_path_buf()),
            report: ReportConfig {
                path: Some("waterdrop-report.json".into()),
                pretty: false,
            },
            ..EngineConfig::default()
        }
    }

    #[test]
    fn builds_and_optimizes_a_small_site() {
        let dir = site();
        let outcome = run(&config(&dir)).unwrap();
        let html = fs::read_to_string(dir.join("index.html")).unwrap();
        assert!(!html.contains("remove"));
        assert!(!html.contains("gone.js"), "stale preload removed");
        assert!(html.contains(r#"<link rel="modulepreload" href="/assets/helper.js">"#));
        assert!(html.contains(r#"<img src="/assets/a.png" decoding="async" fetchpriority="high">"#));
        assert!(html.contains(r#"<img src="/assets/c.png" loading="lazy" decoding="async">"#));
        assert!(html.contains("<p>hello world</p>"));
        let js = fs::read_to_string(dir.join("assets/app.js")).unwrap();
        assert!(!js.contains("// comment"));
        assert!(js.len() < 90);
        assert!(outcome.report.pages.len() == 1);
        assert_eq!(outcome.report.pages[0].page, "/index.html");
        assert!(!outcome.report.orphans.is_empty());
        assert!(outcome.report.summary.bytes > 0);
        assert!(dir.join("waterdrop-report.json").exists());
        assert!(outcome
            .report
            .unused_exports
            .iter()
            .any(|item| item.name == "unusedHelper"));
    }

    #[test]
    fn analyze_never_writes() {
        let dir = site();
        let before = fs::read(dir.join("index.html")).unwrap();
        let mut cfg = config(&dir);
        cfg.mode = Mode::Analyze;
        cfg.report.path = None;
        let outcome = run(&cfg).unwrap();
        assert!(!outcome.written);
        assert_eq!(fs::read(dir.join("index.html")).unwrap(), before);
        assert!(outcome
            .report
            .diagnostics
            .iter()
            .any(|d| d.code == "orphan"));
    }

    #[test]
    fn prunes_orphans_and_duplicates() {
        let dir = site();
        let mut cfg = config(&dir);
        cfg.prune = PruneConfig {
            orphans: true,
            duplicates: true,
        };
        let outcome = run(&cfg).unwrap();
        assert!(!dir.join("assets/orphan.png").exists());
        assert!(dir.join("assets/a.png").exists());
        assert!(
            dir.join("assets/b.png").exists(),
            "referenced duplicates must be kept"
        );
        assert!(outcome.pruned.contains(&"assets/orphan.png".to_string()));
        assert!(!outcome.report.duplicates.is_empty());
    }

    #[test]
    fn dry_run_keeps_files() {
        let dir = site();
        let before = fs::read(dir.join("index.html")).unwrap();
        let mut cfg = config(&dir);
        cfg.dry_run = true;
        cfg.report.path = None;
        let outcome = run(&cfg).unwrap();
        assert!(!outcome.written);
        assert_eq!(fs::read(dir.join("index.html")).unwrap(), before);
        assert!(outcome.changes.iter().any(|change| change.kind == "html"));
    }

    #[test]
    fn budget_failures_are_fatal() {
        let dir = site();
        let mut cfg = config(&dir);
        cfg.budget = Budget {
            js: Some(1),
            css: Some(1),
            total: Some(1),
        };
        let outcome = run(&cfg).unwrap();
        assert!(outcome.budget_failed);
        assert!(!outcome.report.summary.budget_ok);
    }

    #[test]
    fn parses_camel_case_config() {
        let json = waterdrop_core::parse_json(
            r#"{"mode":"analyze","outDir":"out","base":"/docs","html":{"minify":false,"eagerImages":4},"js":{"minify":"never"},"css":{"purge":true},"prune":{"orphans":true},"budget":{"js":1000},"report":{"path":"r.json","pretty":true}}"#,
        )
        .unwrap();
        let config = EngineConfig::from_json(&json).unwrap();
        assert_eq!(config.mode, Mode::Analyze);
        assert_eq!(config.out_dir, Some(PathBuf::from("out")));
        assert_eq!(config.base, "/docs");
        assert!(!config.html.minify);
        assert_eq!(config.html.eager_images, 4);
        assert_eq!(config.js.minify, MinifyMode::Never);
        assert!(config.css.purge);
        assert!(config.prune.orphans);
        assert_eq!(config.budget.js, Some(1000));
        assert!(config.report.pretty);
    }

    #[test]
    fn css_purge_is_opt_in() {
        let dir = site();
        let mut cfg = config(&dir);
        cfg.css.purge = true;
        cfg.report.path = None;
        run(&cfg).unwrap();
        let css = fs::read_to_string(dir.join("assets/app.css")).unwrap();
        assert!(!css.contains(".unused"));
        assert!(css.contains(".hero"));
    }

    #[test]
    fn next_style_urls_resolve() {
        let dir = temp_dir("next");
        fs::create_dir_all(dir.join("static/chunks")).unwrap();
        fs::create_dir_all(dir.join("server/app")).unwrap();
        fs::write(
            dir.join("server/app/index.html"),
            r#"<script type="module" src="/_next/static/chunks/main.js"></script>"#,
        )
        .unwrap();
        fs::write(
            dir.join("static/chunks/main.js"),
            "import \"./vendor.js\";\nexport const x = 1;\n",
        )
        .unwrap();
        fs::write(dir.join("static/chunks/vendor.js"), "export const v = 2;\n").unwrap();
        let mut cfg = config(&dir);
        cfg.report.path = None;
        let outcome = run(&cfg).unwrap();
        assert!(outcome.report.missing.is_empty());
        assert!(outcome.report.orphans.is_empty());
        let html = fs::read_to_string(dir.join("server/app/index.html")).unwrap();
        assert!(html.contains("modulepreload"));
        assert!(html.contains("/_next/static/chunks/vendor.js"));
    }

    #[test]
    fn profiles_and_bloat_are_reported() {
        let dir = temp_dir("bloat");
        fs::write(dir.join("index.html"), "<script src=\"/app.js\"></script>").unwrap();
        fs::write(
            dir.join("app.js"),
            "console.log('x'); debugger; if (process.env.NODE_ENV !== 'production') {}",
        )
        .unwrap();
        let mut cfg = config(&dir);
        cfg.report.path = None;
        cfg.js.minify = MinifyMode::Never;
        let outcome = run(&cfg).unwrap();
        let file = outcome
            .report
            .files
            .iter()
            .find(|file| file.path == "app.js")
            .unwrap();
        assert!(file.bloat.contains(&"console".to_string()));
        assert!(file.bloat.contains(&"debugger".to_string()));
        assert_eq!(
            waterdrop_js::profile("console.log(1)", "a.js").console_calls,
            1
        );
    }
}
