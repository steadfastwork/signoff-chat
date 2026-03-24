# Signoff Chat — Desktop Build Guide

## Local development

```bash
# From the repo root — install all workspace deps
npm install

# From apps/desktop
cd apps/desktop
npm run dev          # tsc + electron . (web app must already be running on :3000)
```

The dev script compiles TypeScript then launches Electron. The web app is started
separately by the main process (`next dev` in `apps/web`), so you only need to run
`npm run dev` from `apps/desktop`.

---

## Building for distribution

### 1. Build the web app first (Next.js standalone)

```bash
cd apps/web
NEXT_PUBLIC_IS_ELECTRON=true npx next build
```

This produces `apps/web/.next/standalone/` which `electron-builder` copies into
the packaged app as `resources/web/`.

### 2. Compile the Electron main process

```bash
cd apps/desktop
npx tsc
```

### 3. Package

| Command                    | Output                                |
|----------------------------|---------------------------------------|
| `npm run package:mac`      | `release/*.dmg` + `release/*.zip`     |
| `npm run package:win`      | `release/*.exe` (NSIS + portable)     |
| `npm run package:linux`    | `release/*.AppImage` + `release/*.deb`|
| `npm run package:all`      | All three platforms                   |

Or use the combined shortcut that also runs the web build:

```bash
npm run build           # build:web + build:electron
npm run package:mac     # then package
```

Artifacts land in `apps/desktop/release/`.

---

## Code-signing certificates

### macOS

You need an **Apple Developer** account with:
- **Developer ID Application** certificate (for distribution outside the App Store)
- An **app-specific password** from appleid.apple.com for notarization

Export your Developer ID Application certificate from Keychain Access as a `.p12`
file and base64-encode it:

```bash
base64 -i DeveloperID_Application.p12 | pbcopy
```

Set these environment variables before packaging locally:

```bash
export CSC_LINK=/path/to/DeveloperID_Application.p12
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"    # 10-char team ID from developer.apple.com
```

`electron-builder.yml` uses `notarize: { teamId: ${APPLE_TEAM_ID} }` — this
invokes the built-in notarization flow (electron-builder v24+). No separate
`afterSign` script is required.

### Windows

You need an **EV Code Signing certificate** (`.p12` / `.pfx`) from a CA such as
DigiCert or Sectigo.

```bash
export WIN_CSC_LINK=/path/to/win-cert.p12
export WIN_CSC_KEY_PASSWORD="your-p12-password"
```

Note: `verifyUpdateCodeSignature: false` is set in the config because
auto-update signature verification requires an EV cert and a consistent
`publisherName`. Adjust this once you have an EV cert.

### Linux

No signing is required. AppImage and deb are unsigned.

---

## GitHub Actions secrets

Add these in **Settings → Secrets and variables → Actions** of the repository:

| Secret                       | Description                                              |
|------------------------------|----------------------------------------------------------|
| `MAC_CERT_P12_BASE64`        | Base64-encoded Developer ID Application `.p12`           |
| `MAC_CERT_PASSWORD`          | Password for the macOS `.p12`                            |
| `APPLE_ID`                   | Apple ID email used for notarization                     |
| `APPLE_APP_SPECIFIC_PASSWORD`| App-specific password from appleid.apple.com             |
| `APPLE_TEAM_ID`              | 10-character Apple Team ID                               |
| `WIN_CERT_P12_BASE64`        | Base64-encoded Windows code-signing `.p12` (optional)    |
| `WIN_CERT_PASSWORD`          | Password for the Windows `.p12` (optional)               |

`GITHUB_TOKEN` is provided automatically by Actions — no manual secret needed.

---

## Release process

1. Bump `version` in `apps/desktop/package.json`.
2. Commit and push.
3. Tag the commit:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. The `desktop-release.yml` workflow triggers automatically:
   - `build-mac` — signs + notarizes on `macos-latest`
   - `build-win` — signs on `windows-latest`
   - `build-linux` — packages on `ubuntu-latest`
   - `create-release` — waits for all three, then creates a GitHub Release with
     all artifacts attached.

5. Pre-release tagging: tags containing `-beta` or `-rc` (e.g. `v1.2.3-beta.1`)
   are automatically marked as pre-releases.

---

## Auto-update notes

Auto-update uses **electron-updater** pointed at GitHub Releases.

- **Check schedule**: 3 seconds after launch, then every 4 hours.
- **Download**: silent background download (`autoDownload: true`).
- **Install**: prompted dialog — "Restart now" or "Later".
  `autoInstallOnAppQuit: true` ensures the update is applied on next quit even
  if the user clicks "Later".
- **Never forced**: the app never quits without user consent.
- **Update feed**: each platform reads `latest-mac.yml` / `latest.yml` /
  `latest-linux.yml` from the GitHub Release assets. These are uploaded
  automatically by `electron-builder`.

To test auto-update locally without a real release, set:

```bash
# Temporarily point at a local dev-update.yml
# (See electron-updater docs for dev mode setup)
process.env.APPIMAGE = '/path/to/app.AppImage'  # Linux only
```

---

## Local DB file paths

The SQLite database (`signoff-chat.db`) is stored in Electron's `userData`
directory:

| Platform | Path                                                                  |
|----------|-----------------------------------------------------------------------|
| macOS    | `~/Library/Application Support/Signoff Chat/signoff-chat.db`         |
| Windows  | `%APPDATA%\Signoff Chat\signoff-chat.db`                              |
| Linux    | `~/.config/Signoff Chat/signoff-chat.db`                              |

To locate it at runtime: `app.getPath('userData')`.

The database uses WAL mode and is never auto-deleted. To wipe it manually,
delete the `.db` file (and optionally the `-shm` / `-wal` journals alongside it).
The "Clear local history" option in Preferences deletes all rows but keeps the
file and schema intact.

---

## Asset requirements

Before the app will launch without crashing, ensure these files exist:

```
apps/desktop/assets/
  icon.icns           macOS app icon
  icon.ico            Windows app icon
  icon.png            Linux app icon (512×512 recommended)
  tray-template.png   macOS tray icon — 18×18 template image (@2x also)
  tray-base.png       Base tray icon for status dot compositing (non-template)
  entitlements.mac.plist
  sounds/
    nudge.wav
    message.wav
    buddy-online.wav
```

Sound files must be ≤ 1 second WAV files. They are unpacked from the asar
archive (`asarUnpack: ["assets/sounds/**"]`) so the OS audio player can
access them by filesystem path.
