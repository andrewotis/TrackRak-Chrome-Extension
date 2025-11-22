Your extension already uses mostly-compatible APIs (chrome.storage, content script, action, etc.), so porting to Firefox should be straightforward.

# Main areas to consider: 
- MV3 service worker support in Firefox, 
- optional promise-style browser.* API polyfill, 
- a Firefox-specific manifest entry (browser_specific_settings), 
- testing/packaging steps with web-ext

# Recommended steps (detailed)

1) Add Firefox-specific manifest metadata (optional but recommended)
- Add browser_specific_settings so Firefox recognizes the addon ID and minimum supported Firefox version. Example snippet to add to manifest.json:
- Change the id to a real reverse-domain identifier you control (or keep a local id for testing).
- |strict_min_version| is optional but useful if you rely on MV3 service worker support in newer FF.

2) Decide how to handle promise-style APIs (polyfill)
- Firefox exposes a browser namespace that returns promises. Chrome uses callback-style chrome.*. Your code already uses callbacks (e.g., chrome.storage.local.get(callback)) which works in Firefox.
- For cleaner cross-browser code you can include Mozilla's webextension-polyfill so you can use browser.* promise-based APIs everywhere. This is optional.
- To include polyfill without build tooling, add the polyfill script to src and import it in background/service worker and pages that need it. If you don't want to change code, you can skip this step — chrome.* calls should work in Firefox as-is.

3) Background/service-worker compatibility
- Your manifest.json declares an MV3 service_worker ("background": { "service_worker": "src/background.js" }).
- Firefox started rolling out support for MV3 service workers but behavior and timing vary. To be robust:
    - Target a Firefox minimum version that supports MV3 service workers (use browser_specific_settings.strict_min_version).
    - Or provide a fallback background script (MV2-style) only if you choose to support older Firefox versions — this requires switching manifest_version and is a larger change.
- Practical path: set strict_min_version to a modern Firefox release and test the service worker in Firefox Developer/Release.

4) web_accessible_resources and assets
- Your web_accessible_resources entry is already in MV3 format and should be acceptable for Firefox. Keep an eye on resource paths and ensure images referenced via chrome.runtime.getURL() are available (they are).

5) Permissions / host_permissions
- permissions: ["storage"] and host_permissions: ["<all_urls>"] are fine for Firefox. Firefox will show the host permission when installing.

6) Cross-browser APIs and behavior gotchas
- chrome.runtime.sendMessage / onMessage and chrome.storage.local behave the same in Firefox.
- localStorage inside content scripts remains page-scoped; your use of localStorage.setItem("TrackRakSignal_"+key, ...) will work cross-tab in Firefox too.
- The one injection guard window.__TrackRakContentScriptInjected is fine.
- If you use chrome.action.openPopup() or programmatic popup opening, note differences in behavior.

7) Testing locally in Firefox
- Install web-ext (recommended) and run:
    - In PowerShell (pwsh):
    * CODE * 
    npm install --no-save web-ext
    npx web-ext lint
    npx web-ext run --firefox
- Or load the extension temporarily:
    - Open about:debugging#/runtime/this-firefox
    - Click “Load Temporary Add-on…” and select manifest.json in your project root.

8) Packaging and publishing
- Use npx web-ext build to create a signed package for distribution:
- To submit to addons.mozilla.org (AMO) you’ll need to follow AMO packaging and signing steps. web-ext sign can help if you have AMO credentials.

9) Optional change I can make for you now
- Add "browser_specific_settings" to manifest.json for Firefox, and optionally include webextension-polyfill to make APIs promise-based.
- Or update the close button to call your storageSet helper (I recommended earlier) to ensure cross-tab signaling works uniformly. This is unrelated to Firefox but useful.

# Files to modify
- Update manifest.json to include browser_specific_settings (small, safe change).
- Add src/vendor/browser-polyfill.min.js and adjust background script to import it.
- Or change close button to call storageSet("widgetClosed", true).

# Other changes
- Add browser_specific_settings to manifest.json (I can patch that immediately).
- Add the webextension-polyfill and wire it into the background/service worker (I can add files and small imports).
- Update close button to use storageSet for consistent cross-tab signals.