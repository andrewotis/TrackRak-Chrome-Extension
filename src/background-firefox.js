// MV2-style background script for Firefox temporary loads.
// Uses chrome.browserAction.onClicked for compatibility with MV2 environments.
chrome.browserAction.onClicked.addListener((tab) => {
  console.log("[TrackRak] Extension icon clicked (firefox)");
  chrome.storage.local.set({ widgetClosed: false }, () => {
    try {
      chrome.tabs.sendMessage(tab.id, { action: "reopenWidget" }, () => {
        console.log("[TrackRak] Message sent to content script");
      });
    } catch (e) {
      console.error("[TrackRak] sendMessage error", e);
    }
  });
});
