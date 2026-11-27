pub use waterdrop_core::{
    compressed_estimate, content_hash, fnv1a64, parse_json, AssetKind, Diagnostic, Json, Level,
    VERSION,
};
pub use waterdrop_engine::{
    run, BuildOutcome, Change, CssConfig, EngineConfig, EngineError, HtmlConfig, JsConfig,
    MinifyMode, Mode, PruneConfig, ReportConfig,
};
pub use waterdrop_report::{
    human, Budget, DuplicateReport, FileReport, MissingReport, PageReport, PruneReport, Report,
    Summary, UnusedExportReport,
};

pub mod css {
    pub use waterdrop_css::*;
}

pub mod graph {
    pub use waterdrop_graph::*;
}

pub mod html {
    pub use waterdrop_html::*;
}

pub mod js {
    pub use waterdrop_js::*;
}

pub mod engine {
    pub use waterdrop_engine::*;
}

pub mod report {
    pub use waterdrop_report::*;
}

pub fn build(config: &EngineConfig) -> Result<BuildOutcome, EngineError> {
    let mut config = config.clone();
    config.mode = Mode::Build;
    run(&config)
}

pub fn analyze(config: &EngineConfig) -> Result<BuildOutcome, EngineError> {
    let mut config = config.clone();
    config.mode = Mode::Analyze;
    run(&config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_engine_and_pipeline_helpers() {
        let config = EngineConfig {
            mode: Mode::Analyze,
            root: std::env::temp_dir(),
            ..EngineConfig::default()
        };
        assert_eq!(config.mode, Mode::Analyze);
        assert!(!VERSION.is_empty());
        assert!(human(2048).ends_with("KB"));
    }
}
