# Holotrace

Holotrace turns a photograph of a hand-drawn circuit into an interactive circuit that can be reviewed, edited, and simulated.

## Repository layout

| Folder | What it is |
| --- | --- |
| [`src/`](src), [`src-tauri/`](src-tauri) | The app: the SvelteKit interface and the Tauri (Rust) shell. Development instructions are below. |
| [`opencv/`](opencv/README.md) | The on-device OpenCV first pass: a photo in, a sharpened image and a recognition request out. Also a webcam dev page. |
| [`classifier/`](classifier/README.md) | The PyTorch recognition models and the service that runs them. |
| [`api_server/`](api_server/README.md) | The server side: the database schema and turning recognition results into a circuit. |
| [`reference/`](reference/README.md) | Architecture and API documents. |
| [`circuit-stuff/`](circuit-stuff/README.md) | Scripts for trying out the recognition service by hand. |

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

The current recognition command expects server credentials in the native process environment. Those credentials must not be embedded in an APK. Android release builds therefore need a user-authenticated API or another server-issued credential flow before remote recognition can be enabled safely; the local editor and capture flow do not depend on that credential.

### Release signing

Release artifacts must be signed before distribution. Copy `src-tauri/gen/android/keystore.properties.example` to `src-tauri/gen/android/keystore.properties`, point it to an upload keystore outside the repository, and replace the placeholder values. The real properties file and keystore are ignored by Git.

The version name comes from `src-tauri/tauri.conf.json`. Update it before producing a release; Tauri derives Android's numeric version code from that semantic version.
