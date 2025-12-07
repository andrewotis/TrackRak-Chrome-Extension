// Load a small browser polyfill to expose `browser.*` promises in environments
// where only `chrome.*` exists. This is lightweight and safe for Chrome/Firefox.
try {
  importScripts(chrome.runtime.getURL('src/vendor/browser-polyfill.min.js'));
} catch (e) {}

chrome.action.onClicked.addListener((tab) => {
  console.log("[TrackRak] Extension icon clicked");
  chrome.storage.local.set({ widgetClosed: false }, () => {
    chrome.tabs.sendMessage(tab.id, { action: "reopenWidget" }, () => {
      console.log("[TrackRak] Message sent to content script");
    });
  });
});