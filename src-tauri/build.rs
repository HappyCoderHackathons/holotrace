use std::{env, fs, path::Path};

/// Model API settings the packaged app needs. A packaged build has no `.env`
/// beside it, and an Android APK has no filesystem to read one from at all, so
/// whatever is available at build time is baked in as a fallback for the
/// runtime lookup. CI supplies these from repository secrets; a local build
/// picks them up from the repository `.env`.
const BAKED: [&str; 2] = ["HOLOTRACE_MODEL_API_URL", "HOLOTRACE_ML_API_KEY"];

fn main() {
    bake_model_api_settings();
    tauri_build::build()
}

fn bake_model_api_settings() {
    let dotenv = Path::new("..").join(".env");
    println!("cargo:rerun-if-changed={}", dotenv.display());

    let from_file = fs::read_to_string(&dotenv).unwrap_or_default();

    for name in BAKED {
        println!("cargo:rerun-if-env-changed={name}");

        let value = env::var(name)
            .ok()
            .filter(|value| !value.is_empty())
            .or_else(|| dotenv_value(&from_file, name));

        // `option_env!` reads whatever is set here, so an absent value simply
        // leaves the runtime lookup as the only source.
        if let Some(value) = value {
            println!("cargo:rustc-env={name}={value}");
        }
    }
}

/// The value of `name` in a `.env`, ignoring comments and surrounding quotes.
fn dotenv_value(contents: &str, name: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let line = line.trim();
        if line.starts_with('#') {
            return None;
        }
        let (key, value) = line.split_once('=')?;
        if key.trim() != name {
            return None;
        }
        let value = value.trim().trim_matches('"').trim_matches('\'');
        (!value.is_empty()).then(|| value.to_owned())
    })
}
