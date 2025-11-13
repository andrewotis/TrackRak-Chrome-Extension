// src/chunks/ui.mjs
const STYLE_MARKER_ID = 'trackrak-widget-style-marker';

async function applyStylesToShadowRoot(shadowRoot) {
  if (!shadowRoot) return;
  if (shadowRoot.getElementById(STYLE_MARKER_ID)) return;

  const styleHref = (window.__TrackRakInject && window.__TrackRakInject.styleHref) || null;

  if (styleHref) {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = styleHref;
      link.id = STYLE_MARKER_ID;
      let loaded = false;
      await new Promise((resolve) => {
        link.onload = () => { loaded = true; resolve(); };
        link.onerror = () => { loaded = false; resolve(); };
        shadowRoot.appendChild(link);
      });
      if (loaded) return;
      const e = shadowRoot.getElementById(STYLE_MARKER_ID);
      if (e) e.remove();
    } catch (err) {}
  }

  if (styleHref) {
    try {
      const resp = await fetch(styleHref, { cache: 'no-store' });
      if (resp.ok) {
        const cssText = await resp.text();
        const styleEl = document.createElement('style');
        styleEl.id = STYLE_MARKER_ID;
        styleEl.textContent = cssText;
        shadowRoot.appendChild(styleEl);
        return;
      }
    } catch (err) {}
  }

  const minimal = document.createElement('style');
  minimal.id = STYLE_MARKER_ID;
  minimal.textContent = `
    .trk-root { background: #fff; color:#111; padding:8px; border-radius:6px; font-family: Arial, sans-serif; }
    .trk-btn { background:#0b5fff; color:#fff; border-radius:6px; padding:8px 10px; }
  `;
  shadowRoot.appendChild(minimal);
}

export async function buildRootUI() {
  let host = document.getElementById('trackrak-widget-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'trackrak-widget-host';
    document.body.appendChild(host);
  }

  let root = host.shadowRoot;
  if (!root) {
    root = host.attachShadow({ mode: 'open' });

    // Build DOM programmatically (no innerHTML) to avoid Trusted Types / CSP issues
    const rootWrapper = document.createElement('div');
    rootWrapper.id = 'trackrak-widget-root';
    rootWrapper.className = 'trk-root';
    rootWrapper.setAttribute('role', 'dialog');
    rootWrapper.setAttribute('aria-label', 'TrackRak Widget');

    const header = document.createElement('div');
    header.className = 'trk-header';

    const headLeft = document.createElement('div');
    headLeft.className = 'trk-head-left';

    const logo = document.createElement('img');
    logo.id = 'trk-logo';
    logo.className = 'trk-logo';
    logo.alt = 'TrackRak logo';

    const title = document.createElement('div');
    title.className = 'trk-title';
    // title.textContent = 'TrackRak Rakuten In-Store Offer Activator';

    headLeft.appendChild(logo);
    headLeft.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'trk-close';
    closeBtn.className = 'trk-close';
    closeBtn.setAttribute('aria-label', 'Close widget');
    closeBtn.textContent = '✕';

    header.appendChild(headLeft);
    header.appendChild(closeBtn);

    const contentDiv = document.createElement('div');
    contentDiv.id = 'trk-content';

    rootWrapper.appendChild(header);
    rootWrapper.appendChild(contentDiv);

    root.appendChild(rootWrapper);
  }

  // ensure styles are applied
  await applyStylesToShadowRoot(root);

  // set logo src if available
  const logoEl = root.getElementById('trk-logo');
  if (logoEl) {
    const logoHref = (window.__TrackRakInject && window.__TrackRakInject.logoHref) || '';
    if (logoHref) {
      logoEl.src = logoHref;
    } else {
      logoEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect rx="6" width="28" height="28" fill="%230b5fff"/><text x="50%" y="55%" font-size="12" font-family="Arial" fill="white" text-anchor="middle" alignment-baseline="middle">TR</text></svg>';
    }
  }

  // wire close button
  const closeBtnEl = root.getElementById('trk-close');
  closeBtnEl && closeBtnEl.addEventListener('click', () => {
    const hostEl = document.getElementById('trackrak-widget-host');
    hostEl && hostEl.remove();
  });

  const content = root.getElementById('trk-content');

  function clear() { while (content.firstChild) content.removeChild(content.firstChild); }

  function renderMessageInner(text, options = {}) {
    clear();
    const wrapper = document.createElement('div');
    wrapper.className = 'trk-message';
    const p = document.createElement('div');
    p.textContent = text;
    wrapper.appendChild(p);

    if (options.buttonText) {
      const btn = document.createElement('button');
      btn.id = 'trk-action-button';
      btn.className = 'trk-btn';
      btn.textContent = options.buttonText;
      btn.addEventListener('click', options.onClick);
      wrapper.appendChild(btn);
    }

    content.appendChild(wrapper);
  }

  function renderLoginForm({ onSubmit }) {
    clear();
    const wrap = document.createElement('div');
    wrap.className = 'trk-login';

    const email = document.createElement('input');
    email.type = 'email';
    email.placeholder = 'Email';
    email.id = 'trk-email';
    email.setAttribute('aria-label', 'Email');

    const pass = document.createElement('input');
    pass.type = 'password';
    pass.placeholder = 'Password';
    pass.id = 'trk-pass';
    pass.setAttribute('aria-label', 'Password');

    const btn = document.createElement('button');
    btn.className = 'trk-btn';
    btn.textContent = 'Login';
    btn.addEventListener('click', () => onSubmit(email.value, pass.value));

    const msg = document.createElement('div');
    msg.id = 'trk-login-msg';
    msg.className = 'trk-msg';

    wrap.appendChild(email);
    wrap.appendChild(pass);
    wrap.appendChild(btn);
    wrap.appendChild(msg);
    content.appendChild(wrap);
  }

  function renderActionButton(text, btnText, onClick) {
    clear();
    const wrap = document.createElement('div');
    wrap.className = 'trk-action';
    const p = document.createElement('div');
    p.textContent = text;
    const btn = document.createElement('button');
    btn.id = 'activateRakutenInStoreOffers';
    btn.className = 'trk-btn';
    btn.textContent = btnText;
    btn.addEventListener('click', onClick);
    wrap.appendChild(p);
    wrap.appendChild(btn);
    content.appendChild(wrap);
  }

  function renderProgress() {
    clear();
    const wrap = document.createElement('div');
    wrap.className = 'trk-progress';
    const status = document.createElement('div');
    status.id = 'trk-progress-status';
    status.textContent = 'Preparing to activate offers...';
    const bar = document.createElement('div');
    bar.className = 'trk-progress-bar';
    const fill = document.createElement('div');
    fill.id = 'trk-progress-fill';
    fill.className = 'trk-progress-fill';
    bar.appendChild(fill);
    wrap.appendChild(status);
    wrap.appendChild(bar);
    content.appendChild(wrap);
  }

  function setProgressLocal({ done, total, currentOfferName }) {
    const status = root.getElementById('trk-progress-status');
    const fill = root.getElementById('trk-progress-fill');
    if (status) status.textContent = `${done} / ${total} activated. Current: ${currentOfferName || '...'}`;
    if (fill && total > 0) {
      const pct = Math.round((done / total) * 100);
      fill.style.width = `${pct}%`;
    }
    if (done === total && status) {
      status.textContent = `All ${total} offers have been activated.`;
    }
  }

  return {
    renderLoginForm,
    renderMessage: renderMessageInner,
    renderActionButton,
    renderProgress,
    setProgress: setProgressLocal
  };
}

export function showMessage(text) {
  const host = document.getElementById('trackrak-widget-host');
  const root = host && host.shadowRoot;
  if (!root) return;
  const content = root.getElementById('trk-content');
  if (!content) return;
  // create element programmatically
  while (content.firstChild) content.removeChild(content.firstChild);
  const d = document.createElement('div');
  d.className = 'trk-message';
  d.textContent = text;
  content.appendChild(d);
}