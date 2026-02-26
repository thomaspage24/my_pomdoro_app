# Pomodoro (Tauri v2 + Vanilla JS)

A cross-platform desktop Pomodoro timer built with:
- Tauri v2
- Vite
- Vanilla HTML/CSS/JS

Features:
- Focus (25) / Break (5) timer modes
- Start, Pause, Reset
- Auto-switch mode when timer reaches 0 (does not auto-start next mode)
- Native desktop notifications
- Keyboard shortcuts
- Catppuccin themes (Latte, Frappe, Macchiato, Mocha)
- Persistent state (mode, remaining time, theme)

## 1) Prerequisites

### macOS

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
brew install node
cargo install tauri-cli --version "^2.0" --locked
```

### Arch Linux (Hyprland)

```bash
sudo pacman -Syu
sudo pacman -S --needed \
  base-devel curl wget file openssl \
  webkit2gtk-4.1 gtk3 librsvg libayatana-appindicator \
  nodejs npm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
cargo install tauri-cli --version "^2.0" --locked
```

## 2) Clone and install

```bash
git clone https://github.com/thomaspage24/my_pomdoro_app.git
cd my_pomdoro_app
npm install
```

If `cargo` is not found in a new terminal:

```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 3) Run locally (dev)

```bash
npm run tauri dev
```

## 4) Build production app

```bash
npm run tauri build
```

Build artifacts are generated in:

```text
src-tauri/target/release/bundle/
```

On macOS, the app bundle is typically:

```text
src-tauri/target/release/bundle/macos/Pomodoro.app
```

## 5) Keyboard shortcuts

- `Space`: Start / Pause toggle
- `R`: Reset current mode
- `F`: Switch to Focus (only when paused)
- `B`: Switch to Break (only when paused)

## 6) Notifications

- Uses official Tauri v2 notification plugin.
- On first use, your OS may ask for notification permission.
- Notification messages:
  - `Focus finished!`
  - `Break finished!`

## 7) Theming

- Default theme: `Mocha`
- Theme picker in the app header:
  - Latte
  - Frappe
  - Macchiato
  - Mocha
- Selected theme is persisted across launches.

## 8) Troubleshooting

### `cargo` not found

```bash
source "$HOME/.cargo/env"
```

### macOS blocks app launch

For locally built unsigned apps, use right-click -> `Open` once.

### `forbidden path` save errors

Ensure the Tauri capability file is present and includes fs allow rules for `$APPDATA/**`:

```text
src-tauri/capabilities/default.json
```
