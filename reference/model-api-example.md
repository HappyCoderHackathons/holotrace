# Model API example

The model API accepts the sharpened image produced by the local OpenCV pass and a `recognition-v0` JSON request whose boxes use pixels in that same image. It returns raw recognition evidence; it does not return canonical Circuit IR or a simulator netlist.

## Request files

Given a processed image named `captured-circuit.png`, save its OpenCV proposals as `recognition.json`:

```json
{
  "schema_version": "recognition-v0",
  "client_preprocess_version": "opencv-v1",
  "image_width": 1280,
  "image_height": 720,
  "regions": [
    {
      "id": "region-0",
      "box": { "x0": 145, "y0": 92, "x1": 286, "y1": 211 },
      "local_label": "resistor",
      "local_confidence": 0.67
    }
  ]
}
```

The image dimensions and every region must describe `captured-circuit.png`, including any crop, rotation, or resize performed by OpenCV.

## Call the API

Keep the bearer token in the calling backend or native process. Do not put it in Svelte code, a `PUBLIC_` variable, or a bundled configuration file.

```sh
export HOLOTRACE_MODEL_API_URL="https://api.ifyousmellityouwilleventuallydie.tech"
export HOLOTRACE_ML_API_KEY="replace-with-the-runtime-secret"

curl --fail-with-body \
  -H "Authorization: Bearer $HOLOTRACE_ML_API_KEY" \
  -F "image=@captured-circuit.png;type=image/png" \
  -F "request=<recognition.json;type=application/json" \
  "$HOLOTRACE_MODEL_API_URL/v0/recognize"
```

An abbreviated response looks like this:

```json
{
  "schema_version": "recognition-v0",
  "label_set_version": "cghd-v0",
  "preprocess_version": "gray-flat-v1",
  "client_preprocess_version": "opencv-v1",
  "classifier_version": "resnet_tiny-20260919-174324",
  "detector_version": null,
  "regions": [
    {
      "region_id": "region-0",
      "label": "resistor",
      "confidence": 0.91,
      "alternatives": [],
      "local_label": "resistor"
    }
  ],
  "detections": []
}
```

## Tauri application flow

The implemented upload path is:

```text
selected image
  -> src/lib/opencvRecognition.ts
     sharpen image + find regions + create recognition-v0 request
  -> Tauri IPC: recognize_circuit
  -> src-tauri/src/lib.rs
     decode PNG + add bearer + multipart POST
  -> model API RecognitionResult
  -> circuit.detection.recognition
```

For local development, put the two native-only values in the repository's `.env` file:

```dotenv
HOLOTRACE_MODEL_API_URL=https://api.ifyousmellityouwilleventuallydie.tech
HOLOTRACE_ML_API_KEY=replace-with-the-runtime-secret
```

The Tauri process searches for `.env` from its working directory and, as a fallback, from the executable directory and its parents. Existing process environment variables take precedence over values in the file. The `.env` file is ignored by Git and must not be packaged with a distributed application.

The values can also be set in the process environment before starting Tauri:

```sh
HOLOTRACE_MODEL_API_URL="https://api.ifyousmellityouwilleventuallydie.tech" \
HOLOTRACE_ML_API_KEY="replace-with-the-runtime-secret" \
bun run tauri dev
```

PowerShell:

```powershell
$env:HOLOTRACE_MODEL_API_URL = "https://api.ifyousmellityouwilleventuallydie.tech"
$env:HOLOTRACE_ML_API_KEY = "replace-with-the-runtime-secret"
bun run tauri dev
```

Rust validates the data URL, enforces the API's 20 MB image limit, and applies a two-minute request timeout. API failures return a user-facing message without logging the bearer or image body.

`RecognitionResult` stays attached to detection provenance until the normalization stage combines it with the OpenCV wire graph and produces canonical Circuit IR. A distributed client still needs user-scoped authentication or a backend proxy; a shared service bearer must not be packaged with an application release.
