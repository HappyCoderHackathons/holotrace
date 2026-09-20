use std::env;

use reqwest;
use base64::Engine;
use reqwest::multipart::{Form, Part};

#[tauri::command]
async fn analyze(
    json_data: String,
    img_b64: String,
) -> Result<String, String> {
    let api_url = env::var("API_URL")
    .expect("API_URL is not set");

    let api_key = env::var("API_KEY")
        .expect("API_KEY is not set");

    // Remove the `data:image/png;base64,` prefix
    let img_b64 = img_b64
        .strip_prefix("data:image/png;base64,")
        .unwrap_or(&img_b64);

    // Decode Base64 → PNG bytes
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(img_b64)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Create the image multipart field
    let image_part = Part::bytes(image_bytes)
        .file_name("captured-circuit.png")
        .mime_str("image/png")
        .map_err(|e| e.to_string())?;

    // Create the JSON multipart field
    let request_part = Part::text(json_data)
        .file_name("recognition.json")
        .mime_str("application/json")
        .map_err(|e| e.to_string())?;

    // Build multipart form
    let form = Form::new()
        .part("image", image_part)
        .part("request", request_part);

    // Create HTTP client
    let client = reqwest::Client::new();

    // Send request
    let response = client
        .post(format!("{}/v0/recognize", api_url))
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    // Get response status
    let status = response.status();

    // Get response body
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "API returned {}: {}",
            status,
            body
        ));
    }

    Ok(body)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![analyze])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}