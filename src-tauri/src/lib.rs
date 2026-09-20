use std::{env, time::Duration};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::{multipart, Client, Url};
use serde::{Deserialize, Serialize};

const MAX_IMAGE_BYTES: usize = 20 * 1024 * 1024;

fn load_dotenv() {
    if dotenvy::dotenv().is_ok() {
        return;
    }

    let Ok(executable) = env::current_exe() else {
        return;
    };
    let Some(executable_dir) = executable.parent() else {
        return;
    };

    for directory in executable_dir.ancestors() {
        let candidate = directory.join(".env");
        if candidate.is_file() {
            let _ = dotenvy::from_path(candidate);
            return;
        }
    }
}

/// A model API setting, from the process or a `.env` first so a developer can
/// point a packaged build somewhere else, then from what `build.rs` baked in.
///
/// The baked value is what makes the packaged builds work: none of them ship a
/// `.env`, and Android has no filesystem location to read one from. It does
/// mean the key is recoverable from a shipped binary, which is true of any
/// credential a client holds; moving the model API behind per-user auth is the
/// only real fix.
fn setting(name: &str, baked: Option<&str>) -> Option<String> {
    env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| baked.filter(|value| !value.is_empty()).map(str::to_owned))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OpenCvRecognitionInput {
    image_data_url: String,
    request: RecognitionRequest,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct RecognitionRequest {
    schema_version: String,
    client_preprocess_version: String,
    image_width: u32,
    image_height: u32,
    regions: Vec<RegionProposal>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct RegionProposal {
    id: String,
    #[serde(rename = "box")]
    bounding_box: BoundingBox,
    local_label: Option<String>,
    local_confidence: Option<f64>,
}

#[derive(Deserialize, Serialize)]
struct BoundingBox {
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
}

#[derive(Serialize)]
struct ModelApiError {
    message: String,
}

impl ModelApiError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

fn decode_data_url(data_url: &str) -> Result<(String, Vec<u8>), ModelApiError> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| ModelApiError::new("OpenCV returned an invalid image data URL."))?;
    let mime = metadata
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or_else(|| ModelApiError::new("The processed image must be base64 encoded."))?;
    if !matches!(mime, "image/png" | "image/jpeg" | "image/webp") {
        return Err(ModelApiError::new(
            "The processed image type is not supported.",
        ));
    }
    let image = BASE64
        .decode(encoded)
        .map_err(|_| ModelApiError::new("The processed image could not be decoded."))?;
    if image.len() > MAX_IMAGE_BYTES {
        return Err(ModelApiError::new(
            "The processed image exceeds the 20 MB limit.",
        ));
    }
    Ok((mime.to_owned(), image))
}

#[tauri::command]
async fn recognize_circuit(
    input: OpenCvRecognitionInput,
) -> Result<serde_json::Value, ModelApiError> {
    let base_url = setting("HOLOTRACE_MODEL_API_URL", option_env!("HOLOTRACE_MODEL_API_URL"))
        .ok_or_else(|| {
            ModelApiError::new("HOLOTRACE_MODEL_API_URL is not configured for this build.")
        })?;
    let api_key = setting("HOLOTRACE_ML_API_KEY", option_env!("HOLOTRACE_ML_API_KEY"))
        .ok_or_else(|| {
            ModelApiError::new("HOLOTRACE_ML_API_KEY is not configured for this build.")
        })?;
    let endpoint = Url::parse(&format!("{}/v0/recognize", base_url.trim_end_matches('/')))
        .map_err(|_| ModelApiError::new("HOLOTRACE_MODEL_API_URL is invalid."))?;
    let (mime, image) = decode_data_url(&input.image_data_url)?;
    let request_json = serde_json::to_string(&input.request)
        .map_err(|_| ModelApiError::new("The OpenCV recognition request could not be encoded."))?;
    let image_part = multipart::Part::bytes(image)
        .file_name("opencv-capture.png")
        .mime_str(&mime)
        .map_err(|_| ModelApiError::new("The processed image type is invalid."))?;
    let form = multipart::Form::new()
        .part("image", image_part)
        .text("request", request_json);

    let response = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| ModelApiError::new("Could not initialize the model API client."))?
        .post(endpoint)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|_| ModelApiError::new("Could not reach the model API."))?;
    let status = response.status();
    if !status.is_success() {
        return Err(ModelApiError::new(format!(
            "The model API rejected the request with HTTP {}.",
            status.as_u16()
        )));
    }
    response
        .json()
        .await
        .map_err(|_| ModelApiError::new("The model API returned invalid JSON."))
}

/// WebView2 denies `getUserMedia` by default and, unlike a browser, shows the
/// user no prompt to override it — the request simply fails. Granting the
/// camera kind here is what makes the in-app viewfinder work on the desktop
/// build. Scoped to the camera; every other permission keeps its default.
#[cfg(windows)]
fn allow_camera_permission(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;

    let result = window.with_webview(|webview| unsafe {
        let controller = webview.controller();
        let core = match controller.CoreWebView2() {
            Ok(core) => core,
            Err(error) => {
                log::warn!("could not reach CoreWebView2: {error}");
                return;
            }
        };

        let mut token = std::mem::zeroed();
        let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
            if let Some(args) = args {
                let mut kind = COREWEBVIEW2_PERMISSION_KIND_CAMERA;
                args.PermissionKind(&mut kind)?;
                if kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                }
            }
            Ok(())
        }));

        if let Err(error) = core.add_PermissionRequested(&handler, &mut token) {
            log::warn!("could not register the camera permission handler: {error}");
        }
    });

    if let Err(error) = result {
        log::warn!("webview unavailable, camera capture will be blocked: {error}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_dotenv();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![recognize_circuit])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(windows)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    allow_camera_permission(&window);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
