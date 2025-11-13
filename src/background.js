// src/background.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    sendResponse({ ok: false, error: 'invalid message' });
    return;
  }

  if (message.type === 'STORAGE_GET') {
    const key = message.key;
    chrome.storage.local.get([key], (res) => {
      sendResponse({ ok: true, value: res ? res[key] : undefined });
    });
    return true;
  }

  if (message.type === 'STORAGE_SET') {
    const toSet = {};
    toSet[message.key] = message.value;
    chrome.storage.local.set(toSet, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'STORAGE_CLEAR') {
    const key = message.key;
    chrome.storage.local.remove([key], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'PING') {
    sendResponse({ pong: true });
    return;
  }

  sendResponse({ ok: false, error: 'unknown type' });
});