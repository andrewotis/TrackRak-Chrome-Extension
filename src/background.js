chrome.action.onClicked.addListener((tab) => {
  console.log("[TrackRak] Extension icon clicked");
  chrome.storage.local.set({ widgetClosed: false }, () => {
    chrome.tabs.sendMessage(tab.id, { action: "reopenWidget" }, () => {
      console.log("[TrackRak] Message sent to content script");
    });
  });
});