use waterdrop_core::{Diagnostic, Json, Level, VERSION};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Budget {
    pub js: Option<usize>,
    pub css: Option<usize>,
    pub total: Option<usize>,
}

impl Budget {
    pub fn is_empty(&self) -> bool {
        self.js.is_none() && self.css.is_none() && self.total.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileReport {
    pub path: String,
    pub kind: String,
    pub bytes: usize,
    pub compressed: usize,
    pub hash: String,
    pub entry: bool,
    pub unused_exports: Vec<String>,
    pub bloat: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageReport {
    pub page: String,
    pub html: usize,
    pub js: usize,
    pub css: usize,
    pub inline: usize,
    pub total: usize,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Summary {
    pub assets: usize,
    pub bytes: usize,
    pub compressed: usize,
    pub js: usize,
    pub css: usize,
    pub html: usize,
    pub images: usize,
    pub fonts: usize,
    pub orphans: usize,
    pub orphan_bytes: usize,
    pub duplicate_groups: usize,
    pub duplicate_bytes: usize,
    pub unused_exports: usize,
    pub missing: usize,
    pub budget_ok: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DuplicateReport {
    pub hash: String,
    pub bytes: usize,
    pub wasted: usize,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnusedExportReport {
    pub module: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingReport {
    pub from: String,
    pub reference: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PruneReport {
    pub orphans: Vec<String>,
    pub bytes: usize,
}

#[derive(Debug, Clone)]
pub struct Report {
    pub mode: String,
    pub root: String,
    pub out_dir: String,
    pub base: String,
    pub summary: Summary,
    pub pages: Vec<PageReport>,
    pub files: Vec<FileReport>,
    pub orphans: Vec<String>,
    pub duplicates: Vec<DuplicateReport>,
    pub unused_exports: Vec<UnusedExportReport>,
    pub missing: Vec<MissingReport>,
    pub diagnostics: Vec<Diagnostic>,
    pub pruned: PruneReport,
    pub budget: Budget,
    pub duration_ms: u64,
}

impl Report {
    pub fn new(
        mode: impl Into<String>,
        root: impl Into<String>,
        out_dir: impl Into<String>,
    ) -> Self {
        Self {
            mode: mode.into(),
            root: root.into(),
            out_dir: out_dir.into(),
            base: "/".to_string(),
            summary: Summary {
                budget_ok: true,
                ..Summary::default()
            },
            pages: Vec::new(),
            files: Vec::new(),
            orphans: Vec::new(),
            duplicates: Vec::new(),
            unused_exports: Vec::new(),
            missing: Vec::new(),
            diagnostics: Vec::new(),
            pruned: PruneReport::default(),
            budget: Budget::default(),
            duration_ms: 0,
        }
    }

    pub fn budget_failures(&self) -> Vec<String> {
        let mut failures = Vec::new();
        for page in &self.pages {
            if let Some(limit) = self.budget.js {
                if page.js > limit {
                    failures.push(format!("{}: JS {} > {} bytes", page.page, page.js, limit));
                }
            }
            if let Some(limit) = self.budget.css {
                if page.css > limit {
                    failures.push(format!("{}: CSS {} > {} bytes", page.page, page.css, limit));
                }
            }
            if let Some(limit) = self.budget.total {
                if page.total > limit {
                    failures.push(format!(
                        "{}: total {} > {} bytes",
                        page.page, page.total, limit
                    ));
                }
            }
        }
        failures
    }

    pub fn worst_page(&self) -> Option<&PageReport> {
        self.pages.iter().max_by_key(|page| page.total)
    }

    pub fn to_json(&self) -> Json {
        Json::object([
            ("version", Json::from(VERSION)),
            ("mode", Json::from(self.mode.as_str())),
            ("root", Json::from(self.root.as_str())),
            ("outDir", Json::from(self.out_dir.as_str())),
            ("base", Json::from(self.base.as_str())),
            ("summary", self.summary_json()),
            (
                "pages",
                Json::Array(self.pages.iter().map(page_json).collect()),
            ),
            (
                "files",
                Json::Array(self.files.iter().map(file_json).collect()),
            ),
            ("orphans", Json::from(self.orphans.clone())),
            (
                "duplicates",
                Json::Array(self.duplicates.iter().map(duplicate_json).collect()),
            ),
            (
                "unusedExports",
                Json::Array(
                    self.unused_exports
                        .iter()
                        .map(|item| {
                            Json::object([
                                ("module", Json::from(item.module.as_str())),
                                ("name", Json::from(item.name.as_str())),
                            ])
                        })
                        .collect(),
                ),
            ),
            (
                "missing",
                Json::Array(
                    self.missing
                        .iter()
                        .map(|item| {
                            Json::object([
                                ("from", Json::from(item.from.as_str())),
                                ("reference", Json::from(item.reference.as_str())),
                            ])
                        })
                        .collect(),
                ),
            ),
            (
                "diagnostics",
                Json::Array(self.diagnostics.iter().map(diagnostic_json).collect()),
            ),
            (
                "pruned",
                Json::object([
                    ("orphans", Json::from(self.pruned.orphans.clone())),
                    ("bytes", Json::from(self.pruned.bytes)),
                ]),
            ),
            ("budgetOk", Json::from(self.summary.budget_ok)),
            ("budgetFailures", Json::from(self.budget_failures())),
            (
                "timings",
                Json::object([("totalMs", Json::from(self.duration_ms))]),
            ),
        ])
    }

    pub fn to_json_string(&self) -> String {
        self.to_json().to_string()
    }

    pub fn to_pretty_json(&self) -> String {
        self.to_json().to_pretty()
    }

    fn summary_json(&self) -> Json {
        Json::object([
            ("assets", Json::from(self.summary.assets)),
            ("bytes", Json::from(self.summary.bytes)),
            ("compressed", Json::from(self.summary.compressed)),
            ("js", Json::from(self.summary.js)),
            ("css", Json::from(self.summary.css)),
            ("html", Json::from(self.summary.html)),
            ("images", Json::from(self.summary.images)),
            ("fonts", Json::from(self.summary.fonts)),
            ("orphans", Json::from(self.summary.orphans)),
            ("orphanBytes", Json::from(self.summary.orphan_bytes)),
            ("duplicateGroups", Json::from(self.summary.duplicate_groups)),
            ("duplicateBytes", Json::from(self.summary.duplicate_bytes)),
            ("unusedExports", Json::from(self.summary.unused_exports)),
            ("missing", Json::from(self.summary.missing)),
            ("budgetOk", Json::from(self.summary.budget_ok)),
        ])
    }

    pub fn render_text(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!(
            "Waterdrop {} - {}\n",
            VERSION,
            if self.mode == "analyze" {
                "analyze (no files written)"
            } else {
                "build"
            }
        ));
        out.push_str(&format!("root: {}\n", self.root));
        if !self.out_dir.is_empty() {
            out.push_str(&format!("out:  {}\n", self.out_dir));
        }
        out.push_str(&format!(
            "assets: {} ({}, ~{} compressed)\n",
            self.summary.assets,
            human(self.summary.bytes),
            human(self.summary.compressed)
        ));
        out.push_str(&format!(
            "js: {}   css: {}   html: {}   images: {}   fonts: {}\n",
            human(self.summary.js),
            human(self.summary.css),
            human(self.summary.html),
            human(self.summary.images),
            human(self.summary.fonts)
        ));
        if self.summary.orphans > 0 {
            out.push_str(&format!(
                "orphans: {} ({} reclaimable)\n",
                self.summary.orphans,
                human(self.summary.orphan_bytes)
            ));
        }
        if !self.pruned.orphans.is_empty() {
            out.push_str(&format!(
                "pruned:  {} orphan file(s), {} removed\n",
                self.pruned.orphans.len(),
                human(self.pruned.bytes)
            ));
        }
        if self.summary.duplicate_groups > 0 {
            out.push_str(&format!(
                "duplicates: {} group(s), {} wasted\n",
                self.summary.duplicate_groups,
                human(self.summary.duplicate_bytes)
            ));
        }
        if self.summary.unused_exports > 0 {
            out.push_str(&format!(
                "unused exports: {}\n",
                self.summary.unused_exports
            ));
        }
        if self.summary.missing > 0 {
            out.push_str(&format!("missing references: {}\n", self.summary.missing));
        }
        if !self.pages.is_empty() {
            out.push_str("\npages (worst first):\n");
            let mut pages = self.pages.clone();
            pages.sort_by_key(|page| std::cmp::Reverse(page.total));
            for page in pages.iter().take(8) {
                out.push_str(&format!(
                    "  {:<32} html {:>8}  js {:>8}  css {:>8}  inline {:>7}  total {:>8}\n",
                    page.page,
                    human(page.html),
                    human(page.js),
                    human(page.css),
                    human(page.inline),
                    human(page.total)
                ));
            }
        }
        let failures = self.budget_failures();
        if failures.is_empty() {
            if !self.budget.is_empty() {
                out.push_str("\nbudget: OK\n");
            }
        } else {
            out.push_str("\nbudget: FAILED\n");
            for failure in failures {
                out.push_str(&format!("  - {failure}\n"));
            }
        }
        let errors = self
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.level == Level::Error)
            .count();
        if errors > 0 {
            out.push_str(&format!("\nerrors: {errors}\n"));
        }
        out
    }
}

fn page_json(page: &PageReport) -> Json {
    Json::object([
        ("page", Json::from(page.page.as_str())),
        ("html", Json::from(page.html)),
        ("js", Json::from(page.js)),
        ("css", Json::from(page.css)),
        ("inline", Json::from(page.inline)),
        ("total", Json::from(page.total)),
        ("files", Json::from(page.files.clone())),
    ])
}

fn file_json(file: &FileReport) -> Json {
    Json::object([
        ("path", Json::from(file.path.as_str())),
        ("kind", Json::from(file.kind.as_str())),
        ("bytes", Json::from(file.bytes)),
        ("compressed", Json::from(file.compressed)),
        ("hash", Json::from(file.hash.as_str())),
        ("entry", Json::from(file.entry)),
        ("unusedExports", Json::from(file.unused_exports.clone())),
        ("bloat", Json::from(file.bloat.clone())),
    ])
}

fn duplicate_json(group: &DuplicateReport) -> Json {
    Json::object([
        ("hash", Json::from(group.hash.as_str())),
        ("bytes", Json::from(group.bytes)),
        ("wasted", Json::from(group.wasted)),
        ("paths", Json::from(group.paths.clone())),
    ])
}

fn diagnostic_json(diagnostic: &Diagnostic) -> Json {
    Json::object([
        ("level", Json::from(diagnostic.level.as_str())),
        ("code", Json::from(diagnostic.code)),
        ("message", Json::from(diagnostic.message.as_str())),
        ("file", Json::from(diagnostic.file.clone())),
    ])
}

pub fn human(bytes: usize) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut value = bytes as f64;
    let mut unit = 0usize;
    while value >= 1024.0 && unit + 1 < UNITS.len() {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{} B", bytes)
    } else if value >= 100.0 {
        format!("{value:.0} {}", UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report() -> Report {
        let mut report = Report::new("build", ".", "out");
        report.summary = Summary {
            assets: 3,
            bytes: 10_000,
            compressed: 3_000,
            js: 6_000,
            css: 2_000,
            html: 2_000,
            images: 0,
            fonts: 0,
            orphans: 1,
            orphan_bytes: 500,
            duplicate_groups: 1,
            duplicate_bytes: 300,
            unused_exports: 1,
            missing: 0,
            budget_ok: true,
        };
        report.pages.push(PageReport {
            page: "/index.html".into(),
            html: 2_000,
            js: 6_000,
            css: 2_000,
            inline: 100,
            total: 10_000,
            files: vec!["/assets/app.js".into()],
        });
        report
    }

    #[test]
    fn serializes_stable_json() {
        let json = report().to_json_string();
        let parsed = waterdrop_core::parse_json(&json).unwrap();
        assert_eq!(parsed.get("version").and_then(Json::as_str), Some(VERSION));
        assert_eq!(
            parsed
                .get("summary")
                .and_then(|summary| summary.get("js"))
                .and_then(Json::as_u64),
            Some(6_000)
        );
        assert_eq!(
            parsed
                .get("pages")
                .and_then(Json::as_array)
                .map(|pages| pages.len()),
            Some(1)
        );
        assert!(json.contains("\"budgetOk\":true"));
    }

    #[test]
    fn checks_budgets_per_page() {
        let mut report = report();
        report.budget = Budget {
            js: Some(5_000),
            css: None,
            total: Some(9_000),
        };
        let failures = report.budget_failures();
        assert_eq!(failures.len(), 2);
        assert!(failures[0].contains("JS"));
        assert!(!report.to_pretty_json().is_empty());
    }

    #[test]
    fn renders_human_report() {
        let text = report().render_text();
        assert!(text.contains("Waterdrop"));
        assert!(text.contains("orphans: 1"));
        assert!(text.contains("/index.html"));
        assert!(text.contains("duplicates: 1"));
    }

    #[test]
    fn formats_bytes() {
        assert_eq!(human(0), "0 B");
        assert_eq!(human(512), "512 B");
        assert_eq!(human(1024), "1.0 KB");
        assert_eq!(human(1024 * 1024), "1.0 MB");
    }
}
