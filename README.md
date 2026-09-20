# holotrace
## Development
To run this project make sure you have installed Rust and Cargo locally, if you are unsure run the following
```console
rustc --version
cargo --version
```
If you need to install Rust go [here](https://rust-lang.org/tools/install/?utm_source=chatgpt.com)

Make sure you install all system depenedencies
```console
sudo apt install -y \
libgtk-3-dev \
libsoup-3.0-dev \
libjavascriptcoregtk-4.1-dev \
libwebkit2gtk-4.1-dev
```

To start the develop app
```console
bun run tauri dev
```