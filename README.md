<div align="center">
<p align="center">
  <img src="./discov.svg" width="96" height="96" alt="Discov logo">
</p>

<h1 align="center"><b>Discov</b></h1>
<h4 align="center">Raycast + Memory + AI</h4>

<p align="center">
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/electron-40-blue.svg" alt="Electron"></a>
  <a href="http://makeapullrequest.com"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">Open-source launcher for macOS with Raycast-compatible extensions and AI-native actions.</p>
</div>

![Discov Screenshot](./assets/discov.png)

Open-source launcher for macOS: **Raycast + Memory + AI** in one app.

Discov gives you Raycast-style extension workflows, AI actions backed by configurable providers and memory, notes, canvas, clipboard history, snippet expansion, and window tiling — all from a single keyboard shortcut.

> **Discov is a fork of [SuperCmd](https://github.com/SuperCmdLabs/SuperCmd)** by
> [Shobhit Bhosure](https://github.com/shobhit99), used under the MIT License.
> It is an independent project and is not affiliated with or endorsed by SuperCmd.

## What It Is

Discov is an Electron + React launcher that focuses on Raycast extension compatibility while remaining community-driven and open source. It ships a full `@raycast/api` and `@raycast/utils` compatibility shim so existing Raycast extensions work without modification. For anything that requires tight system integration — hotkeys, window management, clipboard, snippet injection — it drops into Swift and Objective-C to talk directly to macOS frameworks (ApplicationServices, EventKit, Carbon) for native speed and reliability.

## Key Features

- **Raycast extension compatibility** — `@raycast/api` and `@raycast/utils` shims; install extensions directly from the Raycast store
- **Raycast backup import** — import encrypted `.rayconfig` backups with settings, hotkeys, extensions, scripts, quicklinks, snippets, notes, and extension prefs
- **AI cursor prompt** — inline AI suggestions at your cursor position across any app
- **AI chat** — chat with configurable providers (OpenAI / Anthropic / Ollama / Gemini / OpenAI-compatible)
- **Clipboard history** — full clipboard manager with Cmd+1–9 quick-paste shortcuts
- **Snippet expansion** — create and trigger text snippets with keyboard shortcuts
- **Quick links** — bookmark URLs and launch them from the launcher
- **Notes** — lightweight in-launcher note-taking
- **Canvas** — freeform drawing and diagramming
- **File search** — fast indexed file search with protected-roots support
- **Calendar/schedule** — view today's events from EventKit
- **Window tiling** — 24 window placement commands (halves, thirds, quarters, center, fill, 10px nudge/resize)
- **Hyper key** — remap Caps Lock to a custom modifier with configurable behavior
- **System commands** — Sleep, Restart, Lock Screen, Log Out, Close All Apps, Empty Trash
- **Script command support** — run custom shell/Python/Ruby scripts from the launcher
- **Auto-updates** — built-in updater via GitHub Releases; check manually or install on next launch
- **Memory-aware AI** — Supermemory integration
- **Glassy UI** — liquid-glass morphism with custom background image, blur, and opacity controls
- **Localization** — English, Chinese (Simplified/Traditional), Japanese, Korean, French, German, Spanish, Russian

## Tech Stack

- Electron 40 (main process)
- React 18 + Vite 5 (renderer)
- TypeScript 5.3
- Tailwind CSS 3
- Swift binaries for macOS-native integrations (11 Swift helpers + fast-paste native module)

## Project Structure

```text
src/main/        Electron main process, IPC, extension execution, AI, settings
src/renderer/    React UI + Raycast compatibility layer + built-in feature views
src/native/      Swift native helpers (11 binaries)
extensions/      Installed/managed extension data
dist/            Build output
```

### Key source files

| Path | Purpose |
|---|---|
| `src/main/main.ts` | Entry point — IPC handlers, window management, global shortcuts |
| `src/main/preload.ts` | contextBridge — exposes `window.electron` API to renderer |
| `src/main/commands.ts` | App/extension/script discovery; `getAvailableCommands()` with cache |
| `src/main/extension-runner.ts` | Extension execution engine (esbuild bundle + require shim) |
| `src/main/extension-registry.ts` | Extension catalog, install, uninstall, update |
| `src/main/ai-provider.ts` | AI streaming (OpenAI / Anthropic / Ollama / Gemini) via Node http/https |
| `src/main/settings-store.ts` | JSON settings persistence (`AppSettings`, cached in memory) |
| `src/renderer/src/App.tsx` | Root component — wires hooks and routes to views |
| `src/renderer/src/raycast-api/` | `@raycast/api` + `@raycast/utils` compatibility runtime |
| `src/renderer/src/hooks/` | Feature hooks — state and logic, no JSX |
| `src/renderer/src/views/` | Full-screen view components — pure UI |

### Native Swift helpers

| Binary | Purpose |
|---|---|
| `calendar-events` | EventKit calendar integration |
| `color-picker` | System color picker |
| `get-selected-text` | Extract selected text from frontmost app |
| `hotkey-hold-monitor` | Hold-style hotkey detection (Fn / modifier keys) |
| `hyper-key-monitor` | Caps Lock → Hyper Key remapping |
| `input-monitoring-request` | Request Input Monitoring permission |
| `snippet-expander` | Keyboard-triggered snippet expansion |
| `window-adjust` | Window tiling and resizing (ApplicationServices) |
| `fast-paste-addon/` | Node.js native module for fast clipboard paste (Cmd+1–9) |

## Install

Discov is currently built from source and installed locally — there is no
signed release, Homebrew tap, or notarized `.dmg` yet.

```bash
npm install
npm run reinstall
```

`npm run reinstall` builds for your Mac's architecture, packages the app
unsigned, ad-hoc signs it so macOS will launch it, and installs it to
`/Applications/Discov.app`. See [Development Setup](#development-setup) for the
full toolchain requirements.

> **Note:** because the build is unsigned, macOS may warn that the app is from an
> unidentified developer. Go to System Settings → Privacy & Security and click
> "Open Anyway".

### macOS Permissions

Discov needs the following permissions. The app will prompt you on first use, or you can enable them manually in **System Settings → Privacy & Security**:

| Permission | Why | Required for |
|---|---|---|
| **Accessibility** | Window management, keystroke injection | Window tiling, snippet expansion |
| **Input Monitoring** | Global hotkey detection (launcher shortcut, hyper key, Fn hotkeys) | Core launcher functionality |
| **Automation (AppleScript)** | Selected text capture, system automation | Extension actions |
| **Calendars** | Reading today's events | Optional — only if using schedule feature |

> You may need to restart the app after granting permissions.

### Auto-updates

Discov inherits a built-in auto-updater backed by GitHub Releases. It is
currently inert: `build.publish` points at `tadeucbm/Discov`, which has no
published releases, so update checks simply find nothing. Rebuild and reinstall
with `npm run reinstall` to update.

### Raycast Backup Import

Discov can import encrypted Raycast `.rayconfig` backups from the General settings tab.

It currently imports:
- Raycast settings that map cleanly to Discov
- the global launcher hotkey
- command hotkeys
- quicklinks
- snippets
- notes
- installed Raycast extensions
- extension preferences
- script command folders
- disabled script commands
- disabled extension commands

It intentionally skips or only partially maps:
- AI chats
- clipboard history
- MCP server config
- Raycast aliases, where the backup does not expose a clean first-class field

The importer decrypts backups locally and prompts for the backup password before reading the file.

---

## Development Setup

### Prerequisites

- **macOS** (required — native Swift modules won't compile on Linux/Windows)
- **Node.js 22+** — check with `node -v`
- **npm** — comes with Node.js
- **Xcode Command Line Tools** — required for `swiftc` (Swift compiler)
- **Homebrew** — used at runtime to resolve `git` and `npm` for extension installation

### 1. Install system dependencies

If you don't have Xcode Command Line Tools:
```bash
xcode-select --install
```

Verify Swift is available:
```bash
swiftc --version
```

If you don't have Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Clone and install
```bash
git clone https://github.com/tadeucbm/Discov.git
cd Discov
npm install
```

### 3. Build native modules

The `dev` script does **not** compile the Swift native helpers — build them once before your first run:
```bash
npm run build:native
```

This compiles all Swift binaries and native Node modules into `dist/native/`.

### 4. Run in development mode
```bash
npm run dev
```

This starts TypeScript watch for the main process, the Vite dev server for the renderer, and Electron in development mode.

### 5. Build for production
```bash
npm run build
```

Runs `build:main` + `build:renderer` + `build:native` in sequence.

### 6. Package the app
```bash
npm run package
```

Output artifacts are generated under `out/`. Packaging is unsigned and not
notarized — code signing and notarization are disabled in `package.json`
(`mac.identity: null`, `mac.notarize: false`).

### Useful Commands

```bash
npm run dev              # Start local development (watch + Vite + Electron)
npm run build            # Build main, renderer, and native modules
npm run build:main       # Compile Electron main process TypeScript
npm run build:renderer   # Build renderer with Vite
npm run build:native     # Compile Swift helpers and native modules
npm run package          # Build and package app with electron-builder (unsigned)
npm run reinstall        # Replace /Applications/Discov.app with a fresh local build
npm run check:i18n       # Check internationalization strings
```

`npm run reinstall` quits the running copy, removes the old bundle, resets its
macOS privacy permissions, rebuilds, installs into `/Applications` and relaunches.
User data is preserved unless `--wipe-data` is passed; see
`npm run reinstall -- --help` for all flags, and `--dry-run` to preview.

### Troubleshooting

| Problem | Solution |
|---|---|
| `swiftc: command not found` | Run `xcode-select --install` and restart your terminal |
| `npm install` fails on native modules | Ensure Xcode CLT is installed and up to date: `softwareupdate --install -a` |
| App launches but hotkeys don't work | Grant **Input Monitoring** permission (not just Accessibility) and restart the app |
| Window management doesn't work | Grant **Accessibility** permission — `window-adjust.swift` checks `AXIsProcessTrusted()` |
| Extensions fail to install | Verify Homebrew is installed (`brew --version`) — Discov needs brew-resolved `git` to clone extensions |
| `node-gyp` build errors | Check Node.js version (`node -v`) — requires 22+. Try deleting `node_modules` and re-running `npm install` |
| `Electron failed to install correctly` | Electron's own zip extraction stalls silently on newer Node (seen on 26.x). `npm install` repairs it automatically; run `npm run ensure:electron-binary` if it persists |
| Apple Silicon (M1/M2/M3) issues | Ensure you're running the arm64 version of Node.js, not the x64 version via Rosetta |
| Native features missing after `npm run dev` | Run `npm run build:native` first — the dev script doesn't compile Swift binaries |
| Snippet expansion not working | Grant **Accessibility** permission; snippet-expander uses `CGEventPost` for keystroke injection |

## AI + Memory Setup

Configure everything from the app UI:

1. Launch Discov.
2. Open **Settings** (search "Settings" or use the gear icon).
3. Go to the **AI** tab.
4. Enable AI (`enabled = true`).
5. Pick your default provider and add the required key(s).

### Providers

| Provider | Setting | Notes |
|---|---|---|
| OpenAI | `openaiApiKey` | GPT-4o, GPT-4o-mini, etc. |
| Anthropic (Claude) | `anthropicApiKey` | Claude 3.5 Sonnet, Haiku, etc. |
| Google Gemini | `geminiApiKey` | Gemini 1.5 Pro, Flash, etc. |
| Ollama | `ollamaBaseUrl` | Default `http://localhost:11434` — local models |
| OpenAI-compatible | `openaiCompatibleBaseUrl` + `openaiCompatibleApiKey` | Any OpenAI-compatible endpoint |

### Memory keys

| Setting | Purpose |
|---|---|
| `supermemoryApiKey` | Supermemory API key |
| `supermemoryClient` | Supermemory client ID |
| `supermemoryBaseUrl` | Base URL (default: `https://api.supermemory.ai`) |
| `supermemoryLocalMode` | Use local Supermemory instance |

### Where settings are stored

All app settings are persisted in:

`~/Library/Application Support/Discov/settings.json`

Key fields:

```json
{
  "globalShortcut": "Alt+Space",
  "openAtLogin": false,
  "uiStyle": "glassy",
  "fontSize": "medium",
  "appLanguage": "system",
  "ai": {
    "enabled": true,
    "provider": "openai",
    "openaiApiKey": "",
    "anthropicApiKey": "",
    "geminiApiKey": "",
    "ollamaBaseUrl": "http://localhost:11434",
    "supermemoryApiKey": "",
    "supermemoryBaseUrl": "https://api.supermemory.ai",
    "defaultModel": "openai-gpt-4o-mini"
  }
}
```

OAuth tokens are stored separately in `~/Library/Application Support/Discov/oauth-tokens.json`.

### Optional environment variable fallbacks

- `SUPERMEMORY_API_KEY`
- `SUPERMEMORY_CLIENT`
- `SUPERMEMORY_BASE_URL`
- `SUPERMEMORY_LOCAL`

## Privacy & Security

Discov is open-source, so you can audit exactly what it does. The short version:

- **Telemetry**: none. Discov sends no analytics events.
- **AI prompts**: sent directly from your device to your configured provider (OpenAI / Anthropic / Gemini / Ollama).
- **Extension install/uninstall**: reports extension name + an anonymous random machine ID to `api.supercmd.sh` for download counts.

See **[SECURITY.md](./SECURITY.md)** for the full breakdown.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on development setup, code architecture, PR conventions, and more.

Quick version:

1. Fork the repo and create a feature branch.
2. Make your changes, keeping Raycast extension compatibility in mind.
3. Run `npm run build` to verify.
4. Open a PR with a clear description of what, why, and how you tested.

## References

- Raycast API docs: https://developers.raycast.com/api-reference/
- Raycast extension store: https://www.raycast.com/store

## Contributors

Discov builds on the work of everyone who contributed to upstream SuperCmd:

<p><a href="https://github.com/shobhit99"><img src="https://avatars.githubusercontent.com/u/38807205?v=4" width="48" height="48" alt="shobhit99" title="shobhit99" style="border-radius:50%"></a> <a href="https://github.com/monotykamary"><img src="https://avatars.githubusercontent.com/u/1130103?v=4" width="48" height="48" alt="monotykamary" title="monotykamary" style="border-radius:50%"></a> <a href="https://github.com/elicep01"><img src="https://avatars.githubusercontent.com/u/184329244?v=4" width="48" height="48" alt="elicep01" title="elicep01" style="border-radius:50%"></a> <a href="https://github.com/tuanddd"><img src="https://avatars.githubusercontent.com/u/25856620?v=4" width="48" height="48" alt="tuanddd" title="tuanddd" style="border-radius:50%"></a> <a href="https://github.com/stephaneRR"><img src="https://avatars.githubusercontent.com/u/120036021?v=4" width="48" height="48" alt="stephaneRR" title="stephaneRR" style="border-radius:50%"></a> <a href="https://github.com/ericmason"><img src="https://avatars.githubusercontent.com/u/17150?v=4" width="48" height="48" alt="ericmason" title="ericmason" style="border-radius:50%"></a> <a href="https://github.com/pablopunk"><img src="https://avatars.githubusercontent.com/u/4324982?v=4" width="48" height="48" alt="pablopunk" title="pablopunk" style="border-radius:50%"></a> <a href="https://github.com/Hantok"><img src="https://avatars.githubusercontent.com/u/1752322?v=4" width="48" height="48" alt="Hantok" title="Hantok" style="border-radius:50%"></a> <a href="https://github.com/dardevelin"><img src="https://avatars.githubusercontent.com/u/1424739?v=4" width="48" height="48" alt="dardevelin" title="dardevelin" style="border-radius:50%"></a></p>

## GitHub Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tadeucbm/Discov&type=Date)](https://star-history.com/#tadeucbm/Discov&Date)

## License

[MIT](./LICENSE) — © 2026 Shobhit Bhosure (original SuperCmd work) and
© 2026 Tadeu Castelo Branco Madureira (Discov modifications).
