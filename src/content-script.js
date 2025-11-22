// src/content-script.js
// Content-script only widget (runs in extension context, not page JS).
// Drop this file in as your content script (manifest content_scripts should reference it).

(function () {
  if (window.__TrackRakContentScriptInjected) return;
  window.__TrackRakContentScriptInjected = true;

  const STORAGE_KEY_PREMIUM = "TrackRakHasPremium";
  const STORAGE_KEY_EUID = "TrackRakRakutenEuid";
  const STORAGE_KEY_EUTID = "TrackRakRakutenEutid";

  const HOST_ID = "trackrak-widget-host";
  const STYLE_ID = "trackrak-widget-global-style";

  // Minimal styles for shadow DOM
  const widgetCss = `
    :host { all: initial; }
    .trk-root {
        width: 400px;
        max-width: 92vw;
        background: linear-gradient(180deg,#ffffff,#fbfbff);
        color: #111;
        border: 1px solid rgba(15,23,42,0.06);
        border-radius: 4px;
        box-shadow: 10px 8px 30px #111;
        border: 1px solid #111;
        padding: 9px;
        font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }

    .trk-header {
      display: flex;
      align-items: flex-start; /* align children at top */
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      padding-right: 4px; /* small breathing room for close */
    }

    .trk-head-left {
      display: flex;
      flex-direction: column; /* stack title above logo */
      align-items: center;
      gap: 6px;
      text-align: center;
      flex: 1; /* allow left block to take remaining width */
    }

    .trk-content {
      align-items: center;
      text-align: center;
    }

    .trk-title {
      font-weight: 700;
      font-size: 16px;
      color: #000;
      line-height: 1.1;
      margin: 0;
    }

    .trk-logo {
      width: auto;
      height: 100px;
      border-radius: 6px;
      object-fit: cover;
      background: #f2f6ff;
      margin-top: 6px;
    }

    /* Close button pinned top-right with no extra vertical offset */
    .trk-close {
      background: transparent;
      border: none;
      font-size: 16px;
      color: #6b7280;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      align-self: flex-start; /* ensure it stays at the top in the header row */
    }
    .trk-close:hover {
      background: rgba(11,95,255,0.06);
      color: #0b5fff;
    }

    .trk-login input { 
        display: block;
        width: 100%;
        margin: 6px 0;
        padding: 12px 12px;
        background-color: #fff;
        color: #111;
        border: 1px solid #111;
        border-radius: 8px;
        font-size: 13px;
        box-sizing: border-box;
    }
    .trk-btn { 
      -webkit-text-size-adjust: 100%; 
      --trk-font: Arial, system-ui, -apple-system, "Segoe UI", Roboto; 
      --trk-text: #111111; 
      --trk-card-bg: #ffffff; 
      --trk-card-radius: 8px; 
      --trk-shadow: 0 6px 18px rgba(0,0,0,0.12); 
      --trk-accent: #0366d6; 
      --trk-input-border: #d0d7de; 
      --trk-button-bg: #f4f4f4; 
      --trk-button-border: #888; 
      --trk-success: #0f5132; 
      --trk-error: #b42318; 
      font-family: sans-serif; 
      margin-top: 10px; 
      vertical-align: baseline; 
      line-height: normal; 
      color: #000000; 
      -webkit-appearance: button; 
      cursor: pointer; 
      padding: 7px 20px; 
      border-radius: 50px; 
      font-size: 18px; 
      background-color: #95bb3c; 
      font-weight: bolder; 
      border: 2px solid #000 !important;  
      }
    .trk-msg { margin-top:2px; color:#374151; font-size:13px; }
    .trk-progress-bar { width:100%; height:8px; background:#eef2ff; border-radius:6px; overflow:hidden; margin-top:8px; }
    .trk-progress-fill { height:100%; width:0%; background:#0b5fff; transition: width 240ms linear; }
    .trk-action { display:flex; flex-direction:column; gap:5px; align-items: center; text-align: center;}
  `;

  // small helper: create element with class/text
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // create host and shadow root
  function createHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    return host;
  }

  // attach Shadow DOM UI
  function buildUI() {
    const host = createHost();
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.right = "16px";
    host.style.bottom = "16px";

    const root = host.shadowRoot || host.attachShadow({ mode: "open" });

    // global style (only once)
    if (!root.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = widgetCss;
      root.appendChild(style);
    }

    // main wrapper
    let container = root.getElementById("trk-root");
    if (!container) {
      container = el("div", "trk-root");
      container.id = "trk-root";

      // header DOM (replace existing header construction)
      const header = el("div", "trk-header");
      const headLeft = el("div", "trk-head-left");

      // Title first, then logo (stacked)
      const title = el(
        "div",
        "trk-title",
        "TrackRak Rakuten In-Store Offer Activator"
      );

      const logo = el("img", "trk-logo");
      logo.id = "trk-logo";
      try {
        logo.src = chrome.runtime.getURL("src/assets/logo.png");
      } catch (e) {}

      headLeft.appendChild(title);
      headLeft.appendChild(logo);

      // Close button stays as a sibling (top-right)
      const closeBtn = el("button", "trk-close", "✕");
      closeBtn.id = "trk-close";
      closeBtn.addEventListener("click", () => {
        const h = document.getElementById(HOST_ID);
        if (h) h.remove();
        chrome.storage.local.set({ widgetClosed: true });
      });

      // Assemble header: left block then close button (right)
      header.appendChild(headLeft);
      header.appendChild(closeBtn);

      const content = el("div", "trk-content");
      content.id = "trk-content";

      container.appendChild(header);
      container.appendChild(content);
      root.appendChild(container);
    }

    return { root, container, content: root.getElementById("trk-content") };
  }

  // helper to clear content
  function clearContent(content) {
    while (content.firstChild) content.removeChild(content.firstChild);
  }

  // UI render helpers
  function renderLogin(content, onSubmit) {
    clearContent(content);
    const wrap = el("div", "trk-login");

    const email = el("input");
    email.type = "email";
    email.placeholder = "TrackRak Email";
    email.id = "trk-email";
    const pass = el("input");
    pass.type = "password";
    pass.placeholder = "TrackRak Password";
    pass.id = "trk-pass";

    const btn = el("button", "trk-btn", "Login");
    const msg = el("div", "trk-msg");

    // helper to wrap a promise with a timeout
    function withTimeout(promise, ms = 10000) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const t = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("timeout"));
        }, ms);
        promise
          .then((v) => {
            if (settled) return;
            settled = true;
            clearTimeout(t);
            resolve(v);
          })
          .catch((e) => {
            if (settled) return;
            settled = true;
            clearTimeout(t);
            reject(e);
          });
      });
    }

    btn.addEventListener("click", async () => {
      // basic client-side validation
      const em = String(email.value || "").trim();
      const pw = String(pass.value || "").trim();
      if (!em || !pw) {
        msg.textContent = "Please enter email and password.";
        return;
      }

      // UI state
      btn.disabled = true;
      btn.textContent = "Logging in…";
      msg.textContent = "";

      try {
        const result = await withTimeout(onSubmit(em, pw), 15000);
        if (!result) {
          msg.textContent = "Login attempt failed. See console for details.";
        }
      } catch (err) {
        console.error("[TrackRak] login handler error", err);
        if (err && err.message === "timeout") {
          msg.textContent = "Login timed out. Check network or try again.";
        } else {
          msg.textContent = "Login failed. Check console for details.";
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Login";
      }
    });

    wrap.appendChild(email);
    wrap.appendChild(pass);
    wrap.appendChild(btn);
    wrap.appendChild(msg);
    content.appendChild(wrap);
  }

  function renderMessage(content, text, buttonText, onClick) {
    clearContent(content);
    const wrapper = el("div", "trk-message");
    const p = el("div", "", text);
    wrapper.appendChild(p);
    if (buttonText) {
      const btn = el("button", "trk-btn", buttonText);
      btn.addEventListener("click", onClick);
      wrapper.appendChild(btn);
    }
    content.appendChild(wrapper);
  }

  function renderAction(content, text, btnText, onClick) {
    clearContent(content);
    const wrap = el("div", "trk-action");
    const p = el("div", "", text);
    const btn = el("button", "trk-btn", btnText);
    btn.addEventListener("click", onClick);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    content.appendChild(wrap);
  }

  function renderProgress(content) {
    clearContent(content);
    const wrap = el("div", "trk-progress");
    const status = el("div", "", "Preparing to activate offers...");
    status.id = "trk-progress-status";
    const bar = el("div", "trk-progress-bar");
    const fill = el("div", "trk-progress-fill");
    fill.id = "trk-progress-fill";
    bar.appendChild(fill);
    wrap.appendChild(status);
    wrap.appendChild(bar);
    content.appendChild(wrap);
  }

  function setProgress(content, { done, total, currentOfferName }) {
    const status = content.querySelector("#trk-progress-status");
    const fill = content.querySelector("#trk-progress-fill");
    if (status)
      status.textContent = `${done} / ${total} activated. Current: ${
        currentOfferName || "..."
      }`;
    if (fill && total) {
      const pct = Math.round((done / total) * 100);
      fill.style.width = pct + "%";
    }
    if (done === total && status)
      status.textContent = `All ${total} offers have been activated.`;
  }

  // Storage helpers (direct chrome.storage.local use)
  function storageGet(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          console.error("[TrackRak] storageGet error", err);
          resolve(undefined);
          return;
        }
        resolve(res ? res[key] : undefined);
      });
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      const toSet = {};
      toSet[key] = value;
      chrome.storage.local.set(toSet, () => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          console.error("[TrackRak] storageSet error", err);
          resolve(false);
          return;
        }
        try {
          localStorage.setItem("TrackRakSignal_" + key, String(Date.now()));
        } catch (e) {}
        resolve(true);
      });
    });
  }

  function storageRemove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], () => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          console.error("[TrackRak] storageRemove error", err);
          resolve(false);
          return;
        }
        try {
          localStorage.setItem("TrackRakSignal_" + key, String(Date.now()));
        } catch (e) {}
        resolve(true);
      });
    });
  }

  // Realistic login API call. Replace LOGIN_URL if different.
  async function loginWithTrackRakApi(email, password) {
    const LOGIN_URL = "https://trackrak.com/api/auth/sub"; // update to your real endpoint
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 400;

    if (!email || !password) return { status: 400 };

    const payload = {
      email: String(email).trim(),
      password: String(password),
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const resp = await fetch(LOGIN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          credentials: "omit",
        });

        const status = resp.status;
        let jsonBody = null;
        try {
          jsonBody = await resp.json();
        } catch (e) {}

        return { status, jsonBody };
      } catch (err) {
        console.warn("[TrackRak] login network error attempt", attempt, err);
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        console.error("[TrackRak] login failed after retries", err);
        return null;
      }
    }
  }

  // Fetch in-store offers (example; adjust endpoint/logic to real).
  async function fetchAllInStoreOffers() {
    try {
      const base_endpoint =
        "https://www.rakuten.com/feedapi/v1/regions/USA/topic";
      const topicId = 43461;
      const sort = "alphabetical";
      let cursor = "";
      let hasNext = true;
      const offers = [];
      while (hasNext) {
        const q = `${base_endpoint}?topicId=${topicId}&sort=${sort}&cursor=${encodeURIComponent(
          cursor
        )}`;
        const r = await fetch(q, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-Platform": "DESKTOP_WEB",
          },
        });
        const data = await r.json();
        const edges = data?.data?.viewer?.topic?.items?.edges || [];
        const pageInfo = data?.data?.viewer?.topic?.items?.pageInfo || {
          hasNextPage: false,
          endCursor: "",
        };
        edges.forEach((e) => {
          if (e?.node?.itemData) offers.push(e.node.itemData);
        });
        hasNext = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor || "";
        await new Promise((r) => setTimeout(r, 200));
      }
      return offers;
    } catch (err) {
      console.error("[TrackRak] fetchAllInStoreOffers error", err);
      return [];
    }
  }

  // Activate single offer; returns parsed JSON if present
  async function activateOffer(offer, eb, rakutenUserId) {
    try {
      const url =
        "https://rrcloapi.rrcbsn.com/offers_linker/v1/link-all-cards-to-offers";
      const payload = {
        userGUID: rakutenUserId,
        offerIds: [parseInt(offer.id, 10)],
        trackingTicket: { sourceName: "Web-Desktop", sourceId: 6991168 },
      };
      const resp = await fetch(url, {
        method: "POST",
        headers: { Ebtoken: eb, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      try {
        const json = await resp.json();
        return { ok: true, json, status: resp.status };
      } catch (e) {
        return { ok: true, json: null, status: resp.status };
      }
    } catch (err) {
      console.error("[TrackRak] activateOffer error", err);
      return { ok: false, error: err };
    }
  }

  // Activate all, stop if first response indicates No-Cards
  // Replace existing activateAllInStoreOffers with this implementation
  // Replace existing activateAllInStoreOffers with this implementation
  async function activateAllInStoreOffers(
    unactivated_offers,
    eb,
    rakutenUserId,
    progressCb
  ) {
    if (!Array.isArray(unactivated_offers)) unactivated_offers = [];
    const total = unactivated_offers.length;
    if (total === 0) return { done: 0, total: 0 };

    let done = 0;
    for (let i = 0; i < unactivated_offers.length; i++) {
      const offer = unactivated_offers[i];
      const name =
        offer.merchantname_text || offer.merchantname || `offer-${offer.id}`;

      const r = await activateOffer(offer, eb, rakutenUserId);
      // r.json may be null if parsing failed; guard carefully
      const js = r && r.json;
      const statusVal = js && js.data && js.data.status;

      // If the API explicitly reports "No-Cards" (or case variants), stop immediately.
      if (
        typeof statusVal === "string" &&
        statusVal.toLowerCase().includes("no-card")
      ) {
        console.warn(
          "[TrackRak] activation stopped: No-Cards detected in response",
          statusVal,
          js
        );
        return { done, total, noCards: true, firstResponse: js };
      }

      // otherwise continue normal processing
      done++;
      if (typeof progressCb === "function")
        progressCb({ done, total, currentOfferName: name });
      // slight delay to avoid bursting requests
      await new Promise((r) => setTimeout(r, 120));
    }

    try {
      localStorage.setItem("TrackRakLastActivated", new Date().toISOString());
    } catch (e) {}
    return { done, total };
  }

  // parse __NEXT_DATA__ on Rakuten pages to obtain euid/eutid (if present)
  function parseRakutenIdsFromPage() {
    try {
      const s = document.querySelector("#__NEXT_DATA__");
      if (s && s.innerText) {
        const j = JSON.parse(s.innerText);
        const euid = j?.props?.appState?.euid || null;
        const eutid = j?.props?.appState?.eutid || null;
        return { euid, eutid };
      }
    } catch (err) {
      console.warn("[TrackRak] parseRakutenIdsFromPage error", err);
    }
    return { euid: null, eutid: null };
  }

  // main flow
  async function startWidget() {
    const { root, content } = buildUI();
    console.log("[TrackRak] widget started");

    const storedMsg = await storageGet("activationMessage");
    if (storedMsg) {
      renderMessage(content, storedMsg, "Dismiss", () => {
        chrome.storage.local.set({ widgetClosed: true }, () => {
          const h = document.getElementById("trackrak-widget-host");
          h && h.remove();
        });
      });
      await chrome.storage.local.remove("activationMessage");
      return;
    }

    // helper to check premium persistence
    async function checkPremium() {
      const v = await storageGet(STORAGE_KEY_PREMIUM);
      console.log("[TrackRak] checkPremium read ->", v);
      if (v === true || v === "true") return true;
      return false;
    }

    const hasPremium = await checkPremium();
    if (!hasPremium) {
      // render login UI

      function attemptLogin() {
        renderLogin(content, async (email, password) => {
          console.log("[TrackRak] login submit", email && "***");
          const resp = await loginWithTrackRakApi(email, password);
          if (!resp) {
            renderMessage(
              content,
              "An error occurred during login. Please try again.",
              "Try Again",
              attemptLogin
            );
            return;
          }
          if (resp.status === 401) {
            renderMessage(
              content,
              "Invalid credentials, please try again.",
              "Try Again",
              attemptLogin
            );
            return;
          }

          const json = resp.jsonBody || null;
          if (
            json &&
            json.message === "authorized" &&
            json.plan === "premium"
          ) {
            const ok = await storageSet(STORAGE_KEY_PREMIUM, true);
            console.log("[TrackRak] storageSet premium ->", ok);
            if (!ok) {
              renderMessage(
                content,
                "Login succeeded but we could not persist the session. Try again or reload the page.",
                "Try Again",
                attemptLogin
              );
              return;
            }

            renderMessage(
              content,
              "Click below to navigate to the Rakuten In-Store page.",
              "Go to Rakuten In-Store",
              () => {
                try {
                  window.open("https://rakuten.com/in-store", "_blank");
                } catch (e) {
                  location.href = "https://rakuten.com/in-store";
                }
                const h = document.getElementById(HOST_ID);
                h && h.remove();
              }
            );
            return;
          } else {
            await storageSet(STORAGE_KEY_PREMIUM, false);
            renderMessage(
              content,
              "Upgrade your plan to Premium to add Rakuten In-Store offers."
            );
          }
        });
      }

      attemptLogin();

      return;
    }

    // already premium: proceed
    await proceedAfterAuth(content);
  }

  async function proceedAfterAuth(content) {
    // if not on Rakuten in-store, prompt user to navigate there
    const currentUrl = location.href;
    const allowed = [
      "https://rakuten.com/in-store",
      "https://www.rakuten.com/in-store",
    ];
    if (!allowed.some((a) => currentUrl.startsWith(a))) {
      renderMessage(
        content,
        "Click below to navigate to the Rakuten In-Store page.",
        "Go to Rakuten In-Store",
        () => {
          try {
            window.open("https://rakuten.com/in-store", "_blank");
          } catch (e) {
            location.href = "https://rakuten.com/in-store";
          }
        }
      );
      return;
    }

    // parse Rakuten IDs
    const { euid, eutid } = parseRakutenIdsFromPage();
    if (!euid || !eutid) {
      // still prompt sign-in and Try Again
      renderMessage(
        content,
        "Please sign in to your Rakuten account.",
        "Try Again",
        async () => {
          const parsed = parseRakutenIdsFromPage();
          if (parsed.euid && parsed.eutid) {
            await storageSet(STORAGE_KEY_EUID, parsed.euid);
            await storageSet(STORAGE_KEY_EUTID, parsed.eutid);
            // NEW BEHAVIOR: immediately show Activate Offers UI after storing IDs
            await renderActivateFlow(content);
          } else {
            renderMessage(
              content,
              "Still not signed in. Please sign in on Rakuten to proceed."
            );
          }
        }
      );
      return;
    } else {
      // store IDs and immediately show Activate Offers UI
      await storageSet(STORAGE_KEY_EUID, euid);
      await storageSet(STORAGE_KEY_EUTID, eutid);
      await renderActivateFlow(content);
    }
  }

  async function renderActivateFlow(content) {
    renderAction(
      content,
      "Click below to activate offers.",
      "Activate Offers",
      async () => {
        renderProgress(content);
        const offers = await fetchAllInStoreOffers();
        const unactivated = offers.filter(
          (o) => o.offer_status === "available"
        );
        const euid = await storageGet(STORAGE_KEY_EUID);
        const eutid = await storageGet(STORAGE_KEY_EUTID);
        if (!euid || !eutid) {
          renderMessage(
            content,
            "You must be signed in to your Rakuten account to continue. Sign in to Rakuten, then re-open this extension to activate your In-Store offers.",
            "Try Again",
            async () => {
              await proceedAfterAuth(content);
            }
          );
          return;
        }

        const result = await activateAllInStoreOffers(
          unactivated,
          euid,
          eutid,
          (progress) => {
            setProgress(content, progress);
          }
        );

        if (result && result.noCards) {
          renderMessage(
            content,
            "Unable to activate offers. Add at least one card to your Rakuten wallet, refresh the page, and try again."
          );
          return;
        }

        const finalMessage = `Offer activation finished. ${
          result ? result.done : 0
        } offers added.`;
        await chrome.storage.local.set({ activationMessage: finalMessage });

        setTimeout(() => {
          try {
            window.location.reload();
          } catch (e) {
            location.href = location.href;
          }
        }, 800);

        // renderMessage(
        //   content,
        //   `Offer activation finished. ${result ? result.done : 0} offers added.`
        // );
        // setTimeout(() => {
        //   try {
        //     window.location.reload();
        //   } catch (e) {
        //     location.href = location.href;
        //   }
        // }, 800);
      }
    );
  }

  // start
  try {
    // Treat a missing `widgetClosed` key as `true` (closed by default).
    // This ensures the extension does not auto-open the widget on first
    // install — the user must open it via the extension toolbar icon.
    chrome.storage.local.get("widgetClosed", (res) => {
      const closed = res && Object.prototype.hasOwnProperty.call(res, "widgetClosed")
        ? res.widgetClosed
        : true; // default to closed when key is absent
      if (!closed) {
        startWidget();
      } else {
        console.log("[TrackRak] widgetClosed flag set (default true), skipping widget render");
      }
    });
  } catch (err) {
    console.error("[TrackRak] startWidget error", err);
  }

  // listen for cross-tab localStorage signals to update widget if necessary
  window.addEventListener(
    "storage",
    (ev) => {
      if (!ev.key) return;
      if (ev.key.startsWith("TrackRakSignal_")) {
        console.log("[TrackRak] detected cross-tab signal", ev.key);
      }
    },
    false
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "reopenWidget") {
      chrome.storage.local.set({ widgetClosed: false }, () => {
        startWidget();
        sendResponse({ ok: true });
      });
      return true;
    }
  });
})();
