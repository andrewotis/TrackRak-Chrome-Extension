TrackRak Extension — Privacy Policy (template)

Overview

This privacy policy explains what information the TrackRak In-Store Activator browser extension collects, why it is collected, how it is used, and your choices.

Data Collected
- Rakuten identifiers (e.g. euid/eutid) — parsed from the Rakuten in-store page to enable offer activation.
- Local storage keys used for UI state (no personal data are transmitted by default).
- User logs in through TrackRak API, authentication is handled by your backend; no credentials are stored in the extension.

Purpose
- To enable the extension to find and activate in-store offers for authenticated users.
- To persist the widget open/closed state across tabs.

Third Parties
- The extension connects to the TrackRak backend APIs and Rakuten endpoints necessary for activation. See README or contact the developer for full endpoint list.

Storage & Retention
- Identifiers are stored in the browser's `chrome.storage.local` and are retained until the user clears the extension data or signs out.

Security
- No credentials or sensitive tokens are stored in plaintext in extension files. Use HTTPS for backend endpoints.

User Choices
- Users can remove the extension or clear its storage to delete stored identifiers.

Contact
- Developer: (add your contact email or support URL here)

Notes for publishing
- Update the `homepage_url` and `privacy_policy` fields in `manifest.json`/`manifest-firefox.json` with the hosted policy URL before submitting to stores.
- On the Chrome Web Store and Mozilla Add-ons, you must provide a privacy policy URL in the store listing if your extension collects user data.

Template maintained by the TrackRak development team. Replace placeholder sections with accurate details before publishing.
