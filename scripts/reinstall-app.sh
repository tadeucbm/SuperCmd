#!/usr/bin/env bash
#
# Rebuild Discov from this checkout and reinstall it into /Applications.
#
# Steps: quit any running copy → remove the old bundle → reset its macOS
# privacy permissions → build + package → install → relaunch.
#
# User data (settings, extensions, clipboard history, notes, canvases) is kept
# unless --wipe-data is passed.
#
# Usage:
#   npm run reinstall                 # full cycle, keeps user data
#   npm run reinstall -- --dry-run    # print every step, change nothing
#   npm run reinstall -- --wipe-data  # also delete settings/extensions/history
#   npm run reinstall -- --no-build   # reuse the existing out/ package
#
set -euo pipefail

APP_NAME="Discov"
BUNDLE_ID="com.discov.app"
DEST="/Applications/${APP_NAME}.app"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DRY_RUN=0
DO_BUILD=1
DO_LAUNCH=1
RESET_PERMISSIONS=1
WIPE_DATA=0

# ─── Output helpers ──────────────────────────────────────────────────

if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

step()  { printf '\n%s==>%s %s%s%s\n' "$GREEN" "$RESET" "$BOLD" "$1" "$RESET"; }
info()  { printf '    %s\n' "$1"; }
warn()  { printf '    %s! %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail()  { printf '\n%serror:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '    %s$ %s%s\n' "$DIM" "$*" "$RESET"
  else
    "$@"
  fi
}

usage() {
  cat <<'EOF'
Rebuild Discov from this checkout and reinstall it into /Applications.

Steps: quit any running copy -> remove the old bundle -> reset its macOS
privacy permissions -> build + package -> install -> relaunch.

User data (settings, extensions, clipboard history, notes, canvases) is kept
unless --wipe-data is passed.

Usage:
  npm run reinstall                       full cycle, keeps user data
  npm run reinstall -- --dry-run          print every step, change nothing
  npm run reinstall -- --wipe-data        also delete settings/extensions/history
  npm run reinstall -- --no-build         reuse the existing out/ package
  npm run reinstall -- --keep-permissions leave privacy grants untouched
  npm run reinstall -- --no-launch        do not open the app afterwards
EOF
  exit 0
}

# ─── Arguments ───────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)            DRY_RUN=1 ;;
    --no-build)           DO_BUILD=0 ;;
    --no-launch)          DO_LAUNCH=0 ;;
    --keep-permissions)   RESET_PERMISSIONS=0 ;;
    --wipe-data)          WIPE_DATA=1 ;;
    -h|--help)            usage ;;
    *) fail "unknown option: $1 (try --help)" ;;
  esac
  shift
done

[ "$(uname -s)" = "Darwin" ] || fail "this script only supports macOS"
[ -f "${REPO_ROOT}/package.json" ] || fail "cannot locate the repo root from ${BASH_SOURCE[0]}"

cd "$REPO_ROOT"

if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s(dry run — nothing will be changed)%s\n' "$YELLOW" "$RESET"
fi

# ─── 1. Quit any running copy ────────────────────────────────────────

step "Quitting running ${APP_NAME} instances"

quit_pattern() {
  pgrep -f "$1" >/dev/null 2>&1
}

if quit_pattern "/Applications/${APP_NAME}.app"; then
  run osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
  for _ in $(seq 1 20); do
    quit_pattern "/Applications/${APP_NAME}.app" || break
    sleep 0.5
  done
  if quit_pattern "/Applications/${APP_NAME}.app"; then
    warn "graceful quit timed out, terminating"
    run pkill -f "/Applications/${APP_NAME}.app" || true
    sleep 1
    run pkill -9 -f "/Applications/${APP_NAME}.app" 2>/dev/null || true
  fi
  info "installed app stopped"
else
  info "installed app was not running"
fi

if quit_pattern "${REPO_ROOT}/node_modules/electron/dist/Electron.app"; then
  run pkill -f "${REPO_ROOT}/node_modules/electron/dist/Electron.app" || true
  info "dev instance stopped"
fi

# ─── 2. Remove the old bundle ────────────────────────────────────────

step "Removing the old application"

SUDO=""
if [ ! -w /Applications ]; then
  SUDO="sudo"
  warn "/Applications is not writable — sudo will be requested"
fi

if [ -e "$DEST" ]; then
  info "removing ${DEST}"
  run ${SUDO} rm -rf "$DEST"
else
  info "no existing install at ${DEST}"
fi

# ─── 3. Reset macOS privacy permissions ──────────────────────────────

if [ "$RESET_PERMISSIONS" -eq 1 ]; then
  step "Resetting privacy permissions for ${BUNDLE_ID}"

  if [ "$DRY_RUN" -eq 1 ]; then
    run tccutil reset All "$BUNDLE_ID"
  elif tccutil reset All "$BUNDLE_ID" >/dev/null 2>&1; then
    info "all TCC services reset"
  else
    warn "'tccutil reset All' failed — falling back to per-service resets"
    for service in Accessibility ListenEvent PostEvent Microphone Camera \
                   Calendar Reminders SpeechRecognition ScreenCapture \
                   AppleEvents SystemPolicyAllFiles MediaLibrary Photos AddressBook; do
      tccutil reset "$service" "$BUNDLE_ID" >/dev/null 2>&1 || true
    done
    info "per-service reset attempted"
  fi
  warn "you will be re-prompted for Accessibility, Input Monitoring and Microphone on first use"
else
  step "Keeping existing privacy permissions (--keep-permissions)"
fi

# ─── 4. Optionally wipe user data ────────────────────────────────────

if [ "$WIPE_DATA" -eq 1 ]; then
  step "Wiping user data"
  warn "this deletes settings, installed extensions, clipboard history, notes and canvases"

  for target in \
    "${HOME}/Library/Application Support/${APP_NAME}" \
    "${HOME}/Library/Preferences/${BUNDLE_ID}.plist" \
    "${HOME}/Library/Caches/${APP_NAME}" \
    "${HOME}/Library/Caches/${BUNDLE_ID}" \
    "${HOME}/Library/Logs/${APP_NAME}" \
    "${HOME}/Library/HTTPStorages/${BUNDLE_ID}" \
    "${HOME}/Library/WebKit/${BUNDLE_ID}" \
    "${HOME}/Library/Saved Application State/${BUNDLE_ID}.savedState" \
    "${HOME}/Library/Containers/${BUNDLE_ID}" \
    "${HOME}/Library/LaunchAgents/${BUNDLE_ID}.plist"
  do
    if [ -e "$target" ]; then
      info "removing ${target/#$HOME/\~}"
      run rm -rf "$target"
    fi
  done

  run defaults delete "$BUNDLE_ID" >/dev/null 2>&1 || true
else
  step "Keeping user data"
  info "settings, extensions and history are preserved (pass --wipe-data to remove them)"
fi

# ─── 5. Build and package ────────────────────────────────────────────

ARCH_FLAG="--arm64"
[ "$(uname -m)" = "x86_64" ] && ARCH_FLAG="--x64"

if [ "$DO_BUILD" -eq 1 ]; then
  step "Building ${APP_NAME}"
  run npm run build

  step "Packaging (${ARCH_FLAG#--}, unsigned)"
  run npx electron-builder --mac dir "$ARCH_FLAG" \
    -c.mac.identity=null \
    -c.mac.notarize=false
else
  step "Skipping build (--no-build)"
fi

BUILT_APP=""
for candidate in "out/mac-arm64/${APP_NAME}.app" "out/mac/${APP_NAME}.app" "out/mac-x64/${APP_NAME}.app"; do
  if [ -d "$candidate" ]; then BUILT_APP="$candidate"; break; fi
done

if [ -z "$BUILT_APP" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    BUILT_APP="out/mac-arm64/${APP_NAME}.app"
    info "(dry run) assuming ${BUILT_APP}"
  else
    fail "no packaged app found under out/ — run without --no-build"
  fi
fi

# ─── 6. Install into /Applications ───────────────────────────────────

step "Installing to ${DEST}"
info "source: ${BUILT_APP}"
run ${SUDO} ditto "$BUILT_APP" "$DEST"
run ${SUDO} xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

if [ "$DRY_RUN" -eq 1 ]; then
  info "(dry run) would ad-hoc sign the bundle if its signature does not verify"
elif codesign --verify "$DEST" >/dev/null 2>&1; then
  info "bundle signature verifies"
else
  info "ad-hoc signing the bundle so macOS will launch it"
  if ${SUDO} codesign --force --deep --sign - "$DEST" >/dev/null 2>&1 \
     && codesign --verify "$DEST" >/dev/null 2>&1; then
    info "ad-hoc signature applied"
  else
    warn "ad-hoc signing failed — macOS may refuse to open the app"
  fi
fi

# ─── 7. Launch ───────────────────────────────────────────────────────

if [ "$DO_LAUNCH" -eq 1 ]; then
  step "Launching ${APP_NAME}"
  run open -a "$DEST"
fi

printf '\n%s✓ %s installed at %s%s\n' "$GREEN" "$APP_NAME" "$DEST" "$RESET"
if [ "$RESET_PERMISSIONS" -eq 1 ]; then
  printf '  Re-grant permissions in System Settings → Privacy & Security when prompted.\n'
fi
