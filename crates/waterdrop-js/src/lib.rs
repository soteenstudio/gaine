mod lexer;
mod minify;
mod modules;
mod runtime;

pub use lexer::{significant, tokenize, Token, TokenKind};
pub use minify::{is_minified, minify, strip_source_maps, MinifyOptions, MinifyResult};
pub use modules::{scan_modules, Export, ExportKind, Import, ImportedName, ModuleInfo};
pub use runtime::{
    bloat_warnings, find_unused_exports, is_legacy_bundle, is_vendor_bundle, profile, BloatWarning,
    RuntimeProfile, UnusedExport,
};
