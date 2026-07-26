# Security & Privacy

Discov occupies a central role in your workflow — it sees your keystrokes, clipboard, and AI prompts. This document explains exactly what the app monitors and what data leaves your device.

---

## What This Document Covers

- [Data Collected & Telemetry](#data-collected--telemetry)
- [What Leaves Your Device](#what-leaves-your-device)
- [Privacy Options](#privacy-options)
- [API Key & Secret Storage](#api-key--secret-storage)
- [Extension Security](#extension-security)
- [Electron Security Architecture](#electron-security-architecture)
- [Known Limitations](#known-limitations)
- [Reporting a Vulnerability](#reporting-a-vulnerability)

---

## Data Collected & Telemetry

**Discov collects no analytics.** There is no telemetry SDK in the app: upstream
SuperCmd shipped an [Aptabase](https://aptabase.com/) `app_started` event, and
that integration was removed in this fork along with its dependency.

There is no outbound reporting of any kind. Discov generates no machine or
install identifier.

### No Upstream SuperCmd Traffic

Discov is a fork of SuperCmd and sends **nothing** to the upstream project's
infrastructure. Specifically, these were removed:

- **Extension install/uninstall reporting** — previously sent the extension name
  plus a persistent random machine ID to `api.supercmd.sh`. Gone, along with the
  `.machine-id` file, which is deleted on startup if an older build created it.
- **Extension catalog and bundle downloads** — previously served by
  `api.supercmd.sh`. Discovery and installs now go to GitHub. A self-hosted
  backend can be used instead via the `extensionApiUrl` setting; there is no
  default endpoint.
- **Managed OAuth proxy** — Linear, Spotify and Jira sign-in previously routed
  through `api.supercmd.sh`, which held the client secret, completed the token
  exchange server-side and returned a finished access token. That put your live
  provider token through third-party infrastructure. All OAuth now goes directly
  to the provider. See [OAuth](#oauth) below.
- **Canvas bundle** — previously downloaded from an upstream S3 bucket. Now built
  locally or served from a URL you configure (`canvasBundleUrl`).

These hosts are additionally **blocked at the network layer**
(`src/main/blocked-hosts.ts`), covering both Electron session traffic and
main-process Node requests, so a future refactor or a merged upstream commit
cannot silently reintroduce a call. A test in the suite fails the build if either
host reappears in the source or the built app.

### OAuth

OAuth flows go directly from your device to the provider, using PKCE. Because the
upstream proxy is gone, the built-in Linear, Spotify and Jira integrations no
longer ship a default client ID — the ones they carried were upstream's
registrations and only resolved inside the proxy. Supply your own client ID (in
the extension, or in the auth prompt), or use a personal access token, which
skips OAuth entirely.

---

## What Leaves Your Device

| Destination | What is sent | When | Controlled by |
|---|---|---|---|
| GitHub (`raw.githubusercontent.com`, `api.github.com`, `github.com`) | Extension name | When browsing the catalog or installing an extension | Extension store usage |
| Your configured AI provider (OpenAI / Anthropic / Gemini / custom) | Your prompt + system prompt | When you use AI features | AI settings |
| `http://localhost:11434` | Your prompt | When using Ollama | AI settings (local) |
| `https://api.supermemory.ai` | Memory snippets (up to ~2,400 chars) | When Supermemory integration is enabled | Memory settings |
| GitHub Releases API | App version string | On auto-update check | Built-in updater |
| Your own extension backend (`extensionApiUrl`) | Extension name | When browsing the catalog or installing | Opt-in; unset by default |

---

## Privacy Options

### Analytics

Nothing to disable — analytics were removed from this fork. The
`@aptabase/electron` dependency is gone, so no build-time or runtime opt-out is
needed.

### Extension Install Reporting

Nothing to disable — install/uninstall reporting was removed from this fork, and
no machine identifier is generated. If an older build created a `.machine-id`
file, Discov deletes it on startup.

### Disable Clipboard History

Go to **Settings → General** and disable **Clipboard History**, or delete the stored history:
```bash
rm -rf ~/Library/Application\ Support/Discov/clipboard-history/
```

### Use Local AI

Set your AI provider to **Ollama** with a local model. All AI processing stays on-device.

### Use Local Memory

Leave `supermemoryApiKey` blank. Discov will fall back to `local-memories.json` on your device.

---

## API Key & Secret Storage

API keys (OpenAI, Anthropic, Gemini, Supermemory) are stored in **plain text** in:

```
~/Library/Application Support/Discov/settings.json
```

- The file is readable by your user account and any process running as you.
- macOS Time Machine backups will include this file.
- Any extension running inside Discov can request a file read via IPC.

**Mitigations until keychain storage is implemented:**
- Keep your device screen locked when unattended.
- Exclude `~/Library/Application Support/Discov/` from Time Machine if you're concerned about backup exposure.
- Use read-only API keys with minimal permissions where your provider allows it.

> Using the OS keychain for secret storage is on our roadmap.

---

## Extension Security

Extensions run as JavaScript bundles inside the renderer process, with access to Discov's IPC bridge. An extension can:

- Read and write files on your behalf
- Execute AppleScript
- Make network requests
- Read settings (including other extensions' preferences)

**Mitigations:**
- Extensions in the Discov store are sourced from the public [Raycast extension registry](https://github.com/raycast/extensions), which is open-source and community-reviewed.
- Extension bundles are pre-built with esbuild — no `eval()` or dynamic code generation at runtime.
- `contextIsolation: true` and `nodeIntegration: false` are enforced on all windows.

Treat installing an extension like installing any other macOS app — it runs with your user's permissions.

**Per-extension sandboxing (capability restrictions) is not yet implemented.**

---

## Electron Security Architecture

| Control | Status | Notes |
|---|---|---|
| `contextIsolation: true` | ✅ Enabled on all windows | Renderer cannot access Node.js directly |
| `nodeIntegration: false` | ✅ Enabled on all windows | Node APIs not exposed to renderer |
| `contextBridge` preload | ✅ Used correctly | Only explicit IPC surface is exposed |
| `sandbox: true` | ⚠️ Partial | Enabled on overlay windows; not on main windows |
| Content Security Policy | ⚠️ Not enforced | `sc-asset://` protocol has `bypassCSP: true` for extension assets |
| IPC sender validation | ⚠️ Not implemented | Relies on Electron's isolation boundary |
| Hardened Runtime | ✅ Enabled | macOS notarization with hardened runtime |
| HTTPS for all remote calls | ✅ | All external endpoints use TLS; Ollama is localhost |

---

## Known Limitations

1. **No settings UI for `extensionApiUrl` / `canvasBundleUrl`** — both must be set by editing `settings.json` directly.
2. **API keys stored in plain text** — not using macOS Keychain yet.
3. **No per-extension sandboxing** — all extensions share the same IPC surface.
4. **IPC handlers lack sender validation** — relies on Electron's process isolation.
5. **CSP bypass for asset protocol** — `sc-asset://` bypasses Content Security Policy to serve extension images.

---

## Reporting a Vulnerability

If you discover a security issue, **please do not open a public GitHub issue.**

Report privately via:
- **GitHub Security Advisories**: [https://github.com/tadeucbm/Discov/security/advisories/new](https://github.com/tadeucbm/Discov/security/advisories/new)

<!-- TODO(rebrand): add a security contact address once a Discov domain exists. -->


Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any proof-of-concept code (if applicable)

We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days for critical issues.
