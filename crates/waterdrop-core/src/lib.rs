mod hash;
mod json;
mod path;
mod size;
mod text;

pub use hash::{content_hash, fnv1a64};
pub use json::{parse_json, Json, JsonError};
pub use path::{
    asset_kind, extension, join_path, normalize_url, output_path, relative_path, resolve_ref,
    AssetKind,
};
pub use size::compressed_estimate;
pub use text::{escape_html, is_js_identifier, is_whitespace, unescape_html};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Level {
    Info,
    Warning,
    Error,
}

impl Level {
    pub fn as_str(self) -> &'static str {
        match self {
            Level::Info => "info",
            Level::Warning => "warning",
            Level::Error => "error",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diagnostic {
    pub level: Level,
    pub code: &'static str,
    pub message: String,
    pub file: Option<String>,
}

impl Diagnostic {
    pub fn new(level: Level, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            level,
            code,
            message: message.into(),
            file: None,
        }
    }

    pub fn at(mut self, file: impl Into<String>) -> Self {
        self.file = Some(file.into());
        self
    }
}
