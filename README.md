# Holotrace

Holotrace turns a photograph of a hand-drawn circuit into an interactive circuit that can be reviewed, edited, and simulated.

## Repository layout

| Folder | What it is |
| --- | --- |
| [`src/`](src), [`src-tauri/`](src-tauri) | The app: the SvelteKit interface and the Tauri (Rust) shell. Development instructions are below. |
| [`src/lib/vision/`](src/lib/vision/README.md) | The on-device OpenCV first pass, part of the app: a photo in, a sharpened image and a recognition request out. |
| [`src/lib/diagram/`](src/lib/diagram/README.md) | The diagram format (a Wokwi-shaped `diagram.json` of parts and connections), its part catalog, and building and reading it. |
| [`src/lib/routing.ts`](src/lib/routing.ts) | How the editor draws a wire: only at right angles, with a short stub out of each pin, from a wire that says only what it connects. |
| [`opencv/`](opencv/README.md) | A webcam dev page for that first pass. It pulls the code from `src/lib/vision`. |
| [`classifier/`](classifier/README.md) | The PyTorch recognition models and the service that runs them. |
| [`api_server/`](api_server/README.md) | The server side: the database schema and turning recognition results into a circuit. |
| [`reference/`](reference/README.md) | Architecture and API documents. |
| [`circuit-stuff/`](circuit-stuff/README.md) | Scripts for trying out the recognition service by hand. |

## The editor

The canvas is an editor, not just a viewer. In **Edit** mode:

- **Place** a part by clicking or dragging it from the palette. Drag a part to move it, use the toolbar to rotate or mirror it, and select it to change its reference, value or colour in the panel on the right.
- **Wire** by dragging from one pin to another (on a touch screen, tap one pin, then the other). A wire can end at a pin or at a **junction**: release on a wire to put a junction there, or hold Alt (or Shift) and press on a wire or junction to start a new wire from it. Wires are always drawn at right angles; double-click a wire to add a corner and drag it, or use **Re-route** to let the editor route it again.
- **Delete** with the toolbar or the Delete key; Undo and Redo cover all of it.
- **Export** saves `circuit.diagram.json`, and **Import** (or dropping a file on the canvas) replaces the circuit with one. The format is described in [`src/lib/diagram`](src/lib/diagram/README.md).

A photo goes through the same path: the model's answer is merged with the first pass, the wires are traced from the drawing, and the result opens in the editor as a best guess to check and fix.

## Desktop development

Install [Bun](https://bun.sh/), Rust, and the platform dependencies required by [Tauri](https://v2.tauri.app/start/prerequisites/), then run:

```console
# cwd is project root
cd src-tauri
cargo build
```
```console
# cwd is project root
bun install
bun run tauri dev
```

## Android development

The generated Android Studio project is committed in `src-tauri/gen/android`. Tauri requires Android Studio with the Android SDK, platform tools, build tools, command line tools, and an NDK installed. It also requires the four Android Rust targets.

Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` for your machine, then install the Rust targets once:

```console
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Start the app on a connected device or running emulator:

```console
bun run android:dev
```

Build a universal APK for direct distribution:

```console
bun run android:build -- --apk
```

Build an Android App Bundle for Google Play:

```console
bun run android:build -- --aab
```

The Android application ID is `com.holotrace.mobile`, and Android 7.0 (API 24) is the minimum supported version. Camera access is requested only when the existing capture flow opens the device camera. Network access is required to send processed captures to the configured model service.

The Android CI workflow publishes an optimized universal APK for development testing. Until a production keystore is configured, CI uses Android debug signing so the package remains installable without storing a signing key in the repository.

The current recognition command expects server credentials in the native process environment. Those credentials must not be embedded in an APK. Android release builds therefore need a user-authenticated API or another server-issued credential flow before remote recognition can be enabled safely; the local editor and capture flow do not depend on that credential.

### Release signing

Release artifacts must be signed before distribution. Copy `src-tauri/gen/android/keystore.properties.example` to `src-tauri/gen/android/keystore.properties`, point it to an upload keystore outside the repository, and replace the placeholder values. The real properties file and keystore are ignored by Git.

The version name comes from `src-tauri/tauri.conf.json`. Update it before producing a release; Tauri derives Android's numeric version code from that semantic version.
