TrackRak In-Store Activator — Build & Testing

This repo contains the Chrome MV3 extension and a Firefox-compatible manifest for temporary testing.

Quick commands (PowerShell / Windows)

1) Install dev deps:

```powershell
npm install
```

2) Build production packages (copies sources into `dist/`, obfuscates JS, and creates zips):

```powershell
npm run build:prod
```

Output:
- `dist/chrome/` — Chrome package (obfuscated JS)
- `dist/firefox/` — Firefox package (obfuscated JS)
- `dist/trackrak-chrome.zip` — zip of Chrome package
- `dist/trackrak-firefox.zip` — zip of Firefox package

Notes:
- Original sources under `src/` are NOT modified. Obfuscation runs only on files inside `dist/`.
- By default, files under `src/vendor` are excluded from obfuscation. Update `build/build-prod.js` to change the exclusion list.

Temporary Firefox testing

1) Build the Firefox test package:

```powershell
npm run build:prod
```

2) Run with `web-ext` (this launches a Firefox instance with the temporary extension):

```powershell
npx web-ext run --source-dir dist/firefox
```

Or use the npm shortcut (build + run):

```powershell
npm run firefox:run
```

If you need to specify a Firefox binary, use `--firefox "C:\Path\To\firefox.exe"`, or use the npm helper:

```powershell
npm run firefox:run:exe -- --firefox "C:\Path\To\Firefox Developer Edition\firefox.exe"
```

Development helper

- To create a simple Firefox temp package without obfuscation (useful for quick debugging), use the PowerShell helper:

```powershell
npm run build:firefox-temp
# then load dist/firefox/manifest.json in about:debugging -> Load Temporary Add-on
```

Customization

- To exclude files or folders from obfuscation, edit `build/build-prod.js` and modify `EXCLUDE_PATTERNS`.
- To tweak obfuscation settings, modify the options passed to `JavaScriptObfuscator.obfuscate()` in `build/build-prod.js`.

If you want, I can add automated tests or CI steps to run the builds and validate the generated packages.

Build & Obfuscation Options

- **Toggle obfuscation on/off:** The build supports an `OBFUSCATE` toggle. By default obfuscation is enabled.
	- Disable with an environment variable (PowerShell):
		```powershell
		$env:OBFUSCATE='false'; 
        node .\build\build-prod.js
		```
    - Or set "OBFUSCATE=false"
	- Or pass a CLI flag to skip obfuscation:
		```powershell
		node .\build\build-prod.js --no-obfuscate
		```

- **Content script obfuscation:** The build now obfuscates `src/content-script.js` by default but uses conservative options to reduce the risk of breaking page integration (no control-flow flattening, no dead-code injection, no string-array encoding). If you prefer not to obfuscate the content script, disable obfuscation with the toggle above.

- **Excluded patterns:** Files and folders excluded from obfuscation by default (see `EXCLUDE_PATTERNS` in `build/build-prod.js`):
	- `src/vendor` (includes `src/vendor/browser-polyfill.min.js`)
	- `src/assets`
	- `src/styles`
	- `src/background.js` (service worker / background — excluded due to CSP/runtime sensitivity)
	- `src/background-firefox.js` is pruned from the Chrome dist during the build (used only for Firefox MV2 testing)

- **Customizing obfuscation options:** Open `build/build-prod.js` and locate the call to `JavaScriptObfuscator.obfuscate(code, obfOptions)`. The file applies conservative `obfOptions` for `content-script.js` and more aggressive options for other scripts. Adjust these per-file options if you need stronger or weaker obfuscation.

- **Reviewer readiness:** Obfuscated code may trigger manual review by Chrome Web Store or Mozilla Add-ons teams. Keep an unobfuscated source bundle (or be prepared to reproduce the build) and document which files were obfuscated and why (a `README_PUBLISHING.md` is recommended).

Strip comments

- **Toggle comment stripping on/off:** The build can remove all JavaScript comments from files in the `dist` output using `terser`. By default comment stripping is enabled.
	- Disable comment stripping (PowerShell):
		```powershell
		$env:STRIP_COMMENTS='false'; node .\build\build-prod.js
		```
	- Or pass the CLI flag to skip stripping:
		```powershell
		node .\build\build-prod.js --no-strip-comments
		```
    - Or set STRIP_COMMENTS='false'
- **Behavior details:** Comment stripping runs after `src` is copied into `dist/*` and before obfuscation. The build uses `terser.minify()` with `comments: false` to remove comment blocks and line comments.

- **Important caution:** Stripping all comments will remove license headers and any developer notes embedded in files. If you must preserve license or attribution comments, disable `STRIP_COMMENTS` and consider using a `terser` configuration that preserves license comments instead (we can add an option to preserve `@license` / `@preserve` markers on request).

- **Why use it:** Removing comments reduces package size slightly and removes commentary that might leak internal notes or TODOs. It also complements obfuscation for release builds.
