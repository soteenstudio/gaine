use std::fs;
use std::path::PathBuf;
use std::process::ExitCode;

use waterdrop_core::{parse_json, VERSION};
use waterdrop_engine::{run, EngineConfig, MinifyMode};

const HELP: &str = "\
Waterdrop - HTML, JavaScript and CSS optimizer for Gaine

Usage:
  waterdrop [build|analyze] [options]

Modes:
  build              Optimize the build output (default)
  analyze            Report sizes and bloat without writing files

Options:
  --root <dir>       Project root (default: current directory)
  --out <dir>        Directory to optimize (default: root)
  --config <file>    JSON configuration file
  --base <path>      Public base path used to resolve URLs
  --report <file>    Write a report (.json for JSON, other for text)
  --json             Print the JSON report to stdout
  --pretty           Pretty-print the JSON report
  --dry-run          Compute changes without writing files
  --prune-orphans    Remove assets unreachable from any HTML page
  --prune-duplicates Remove unreferenced duplicate assets
  --no-js            Skip JavaScript optimization
  --no-css           Skip CSS optimization
  --no-html          Skip HTML optimization
  --minify-js <mode> auto | always | never
  --minify-css <mode> auto | always | never
  --budget-js <n>    Per-page JavaScript budget in bytes
  --budget-css <n>   Per-page CSS budget in bytes
  --budget-total <n> Per-page total budget in bytes
  -h, --help         Show this help
  -V, --version      Show the version

Exit codes:
  0  success
  1  execution error
  2  performance budget exceeded
";

#[derive(Debug, Default)]
struct Cli {
    mode: Option<String>,
    root: Option<PathBuf>,
    out: Option<PathBuf>,
    config: Option<PathBuf>,
    base: Option<String>,
    report: Option<String>,
    json: bool,
    pretty: bool,
    dry_run: bool,
    prune_orphans: bool,
    prune_duplicates: bool,
    no_js: bool,
    no_css: bool,
    no_html: bool,
    minify_js: Option<String>,
    minify_css: Option<String>,
    budget_js: Option<usize>,
    budget_css: Option<usize>,
    budget_total: Option<usize>,
}

fn main() -> ExitCode {
    match execute(std::env::args().skip(1).collect()) {
        Ok(code) => code,
        Err(message) => {
            eprintln!("waterdrop: {message}");
            ExitCode::from(1)
        }
    }
}

fn execute(args: Vec<String>) -> Result<ExitCode, String> {
    if args.iter().any(|arg| arg == "-h" || arg == "--help") {
        print!("{HELP}");
        return Ok(ExitCode::SUCCESS);
    }
    if args.iter().any(|arg| arg == "-V" || arg == "--version") {
        println!("waterdrop {VERSION}");
        return Ok(ExitCode::SUCCESS);
    }

    let cli = parse_args(args)?;
    let mut config = match &cli.config {
        Some(path) => {
            let body = fs::read_to_string(path)
                .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
            let json = parse_json(&body)
                .map_err(|error| format!("invalid config {}: {error}", path.display()))?;
            EngineConfig::from_json(&json)
                .map_err(|error| format!("invalid config {}: {error}", path.display()))?
        }
        None => EngineConfig::default(),
    };

    if let Some(mode) = &cli.mode {
        config.mode = match mode.as_str() {
            "build" => waterdrop_engine::Mode::Build,
            "analyze" => waterdrop_engine::Mode::Analyze,
            other => return Err(format!("unknown mode: {other}")),
        };
    }
    if let Some(root) = &cli.root {
        config.root = root.clone();
    }
    if let Some(out) = &cli.out {
        config.out_dir = Some(out.clone());
    }
    if let Some(base) = &cli.base {
        config.base = base.clone();
    }
    if let Some(report) = &cli.report {
        config.report.path = Some(report.clone());
    }
    if cli.pretty {
        config.report.pretty = true;
    }
    if cli.dry_run {
        config.dry_run = true;
    }
    if cli.prune_orphans {
        config.prune.orphans = true;
    }
    if cli.prune_duplicates {
        config.prune.duplicates = true;
    }
    if cli.no_js {
        config.js.minify = MinifyMode::Never;
        config.js.analyze = false;
        config.js.drop_source_maps = false;
    }
    if cli.no_css {
        config.css.minify = MinifyMode::Never;
        config.css.purge = false;
        config.css.analyze = false;
    }
    if cli.no_html {
        config.html.minify = false;
        config.html.lazy_images = false;
        config.html.lazy_iframes = false;
        config.html.module_preload = false;
        config.html.prune_missing_hints = false;
        config.html.decode_async = false;
        config.html.minify_inline_js = false;
        config.html.minify_inline_css = false;
    }
    if let Some(value) = &cli.minify_js {
        config.js.minify = parse_mode(value)?;
    }
    if let Some(value) = &cli.minify_css {
        config.css.minify = parse_mode(value)?;
    }
    if let Some(value) = cli.budget_js {
        config.budget.js = Some(value);
    }
    if let Some(value) = cli.budget_css {
        config.budget.css = Some(value);
    }
    if let Some(value) = cli.budget_total {
        config.budget.total = Some(value);
    }

    let outcome = run(&config).map_err(|error| error.message)?;
    if cli.json {
        if cli.pretty {
            println!("{}", outcome.report.to_pretty_json());
        } else {
            println!("{}", outcome.report.to_json_string());
        }
    } else {
        print!("{}", outcome.report.render_text());
        for change in &outcome.changes {
            println!(
                "  {} -{} {} -> {} bytes",
                change.path,
                change.before.saturating_sub(change.after),
                change.before,
                change.after
            );
        }
    }

    if outcome.budget_failed {
        Ok(ExitCode::from(2))
    } else {
        Ok(ExitCode::SUCCESS)
    }
}

fn parse_mode(value: &str) -> Result<MinifyMode, String> {
    match value {
        "auto" => Ok(MinifyMode::Auto),
        "always" | "true" => Ok(MinifyMode::Always),
        "never" | "false" => Ok(MinifyMode::Never),
        other => Err(format!("unknown minify mode: {other}")),
    }
}

fn parse_args(args: Vec<String>) -> Result<Cli, String> {
    let mut cli = Cli::default();
    let mut iter = args.into_iter().peekable();
    while let Some(arg) = iter.next() {
        let (flag, inline) = match arg.split_once('=') {
            Some((flag, value)) if flag.starts_with("--") => {
                (flag.to_string(), Some(value.to_string()))
            }
            _ => (arg.clone(), None),
        };
        let mut value = |name: &str| -> Result<String, String> {
            if let Some(value) = inline.clone() {
                return Ok(value);
            }
            iter.next()
                .ok_or_else(|| format!("missing value for {name}"))
        };
        match flag.as_str() {
            "build" | "analyze" => cli.mode = Some(flag.clone()),
            "--root" => cli.root = Some(PathBuf::from(value("--root")?)),
            "--out" | "--out-dir" => cli.out = Some(PathBuf::from(value("--out")?)),
            "--config" => cli.config = Some(PathBuf::from(value("--config")?)),
            "--base" => cli.base = Some(value("--base")?),
            "--report" => cli.report = Some(value("--report")?),
            "--json" => cli.json = true,
            "--pretty" => cli.pretty = true,
            "--dry-run" => cli.dry_run = true,
            "--prune-orphans" => cli.prune_orphans = true,
            "--prune-duplicates" => cli.prune_duplicates = true,
            "--no-js" => cli.no_js = true,
            "--no-css" => cli.no_css = true,
            "--no-html" => cli.no_html = true,
            "--minify-js" => cli.minify_js = Some(value("--minify-js")?),
            "--minify-css" => cli.minify_css = Some(value("--minify-css")?),
            "--budget-js" => {
                cli.budget_js = Some(parse_number("--budget-js", &value("--budget-js")?)?)
            }
            "--budget-css" => {
                cli.budget_css = Some(parse_number("--budget-css", &value("--budget-css")?)?)
            }
            "--budget-total" => {
                cli.budget_total = Some(parse_number("--budget-total", &value("--budget-total")?)?)
            }
            other if other.starts_with('-') => return Err(format!("unknown option: {other}")),
            other => return Err(format!("unknown argument: {other}")),
        }
    }
    Ok(cli)
}

fn parse_number(name: &str, value: &str) -> Result<usize, String> {
    value
        .parse::<usize>()
        .map_err(|_| format!("invalid number for {name}: {value}"))
}
