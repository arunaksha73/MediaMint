'use strict';

/* ==========================================================================
   Utilities
   ========================================================================== */

const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function showToast(message, duration = 2800) {
  const toast = qs('#toast');
  if (!toast) return;
  // Truncate long technical error strings so they don't blow up the toast UI
  const MAX = 120;
  toast.textContent = message.length > MAX ? message.slice(0, MAX) + '…' : message;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

/* ==========================================================================
   Theme toggle (persists only in-memory for this session)
   ========================================================================== */

(function themeToggle() {
  const toggle = qs('#themeToggle');
  const root = document.documentElement;
  let isLight = false;

  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  if (prefersLight) {
    isLight = true;
    root.setAttribute('data-theme', 'light');
    toggle.setAttribute('aria-pressed', 'true');
  }

  toggle.addEventListener('click', () => {
    isLight = !isLight;
    if (isLight) {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    toggle.setAttribute('aria-pressed', String(isLight));
  });
})();

/* ==========================================================================
   Mobile menu
   ========================================================================== */

(function mobileMenu() {
  const burger = qs('#navBurger');
  const menu = qs('#mobileMenu');
  if (!burger || !menu) return;

  const close = () => {
    burger.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
  };

  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    menu.classList.toggle('is-open', !open);
  });

  qsa('a', menu).forEach((link) => link.addEventListener('click', close));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

/* ==========================================================================
   Scroll reveal
   ========================================================================== */

(function scrollReveal() {
  const targets = qsa('.reveal');
  if (!('IntersectionObserver' in window) || targets.length === 0) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          setTimeout(() => el.classList.add('is-visible'), (i % 4) * 80);
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
})();

/* ==========================================================================
   Hero floating particles
   ========================================================================== */

(function particles() {
  const field = qs('#particles');
  if (!field) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const count = window.innerWidth < 640 ? 10 : 18;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 3 + Math.random() * 5;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${60 + Math.random() * 40}%`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);
    p.style.animationDuration = `${8 + Math.random() * 10}s`;
    p.style.animationDelay = `${Math.random() * 10}s`;
    field.appendChild(p);
  }
})();

/* ==========================================================================
   API base URL — shared across all modules
   ========================================================================== */

/* ==========================================================================
   API base URL
   ─────────────────────────────────────────────────────────────────────────
   The frontend can be deployed on Vercel (static CDN) while the Express
   backend runs on Render.  When that split-deployment is detected we swap
   apiBase to the Render URL so all /api/* calls reach the actual server.

   ⚙️  UPDATE THIS when you redeploy the backend to a new Render service:
   ========================================================================== */
const RENDER_BACKEND_URL = 'https://media-mint.onrender.com'; // ← your Render URL

let apiBase = window.location.origin;
(function () {
  const host = window.location.hostname;
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(host);
  const isFileScheme = window.location.protocol === 'file:';
  const isWrongPort  = isLocalhost && window.location.port !== '3000';

  if (isFileScheme || isWrongPort) {
    // Running from file:// or wrong local port — point at local server
    apiBase = 'http://localhost:3000';
  } else if (!isLocalhost) {
    // Deployed environment: always use the Render backend, regardless of
    // which CDN/domain is serving the HTML (Vercel, GitHub Pages, etc.)
    apiBase = RENDER_BACKEND_URL;
  }
  // If isLocalhost && port === 3000: Express serves everything, apiBase stays as-is
})();

/* ==========================================================================
   Downloader form — paste, clear, validate, fetch + preview
   ========================================================================== */

(function downloader() {
  const form = qs('#downloaderForm');
  const field = qs('#downloaderField');
  const input = qs('#urlInput');
  const pasteBtn = qs('#pasteBtn');
  const clearBtn = qs('#clearBtn');
  const submitBtn = qs('#downloadBtn');
  const previewCard = qs('#previewCard');
  if (!form || !input) return;

  const igPattern = /^https?:\/\/(www\.)?instagram\.com\/.+/i;

  function toggleClear() {
    clearBtn.classList.toggle('is-visible', input.value.trim().length > 0);
  }

  input.addEventListener('input', () => {
    toggleClear();
    field.classList.remove('is-invalid');
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        input.value = text.trim();
        input.focus();
        toggleClear();
        showToast('Link pasted');
      }
    } catch (err) {
      input.focus();
      showToast('Paste blocked — long-press field or use Ctrl+V');
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    toggleClear();
    field.classList.remove('is-invalid');
    if (previewCard) previewCard.hidden = true;
  });

  function spawnRipple(e, btn) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
    ripple.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  const apiEndpoint = `${apiBase}/api/download`;

  submitBtn.addEventListener('click', (e) => spawnRipple(e, submitBtn));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();

    if (!value || !igPattern.test(value)) {
      field.classList.add('is-invalid');
      showToast('Paste a valid Instagram link to continue');
      input.focus();
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    if (previewCard) previewCard.hidden = true;

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: value })
      });

      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (!response.ok || !result.success) {
        throw new Error((result && result.error) || 'Failed to retrieve media. Please try again.');
      }

      // --- Populate title ---
      const titleEl = qs('#previewTitle');
      if (titleEl) titleEl.textContent = result.title || 'Instagram Media';

      // --- Populate tags ---
      const tagsEl = qs('#previewTags');
      if (tagsEl) {
        const typeLabel = result.type
          ? result.type.charAt(0).toUpperCase() + result.type.slice(1)
          : 'Media';
        tagsEl.innerHTML = [
          `<span class="tag">${typeLabel}</span>`,
          result.duration ? `<span class="tag">${result.duration}</span>` : '',
          result.quality  ? `<span class="tag">${result.quality}</span>`  : '',
          result.filesize ? `<span class="tag">${result.filesize}</span>` : ''
        ].join('');
      }

      // --- Video vs thumbnail ---
      const videoWrap = qs('#previewVideoWrap');
      const videoEl   = qs('#previewVideo');
      const thumbEl   = qs('#previewThumb');

      if (result.type === 'reel' && result.downloadUrl) {
        // Show the real HTML5 video player
        if (videoEl) {
          videoEl.src = result.downloadUrl;
          if (result.thumbnail) videoEl.poster = result.thumbnail;
        }
        if (videoWrap) videoWrap.style.display = 'block';
        if (thumbEl)   thumbEl.style.display   = 'none';
      } else {
        // Show thumbnail / photo
        if (videoWrap) videoWrap.style.display = 'none';
        if (thumbEl) {
          thumbEl.style.display = '';
          thumbEl.innerHTML = result.thumbnail
            ? `<img src="${result.thumbnail}" alt="Thumbnail"
                style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:inherit;">`
            : `<div class="preview__thumb-shine"></div>
               <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                 <path d="M8 5v14l11-7L8 5Z" fill="currentColor" /></svg>`;
        }
      }

      // --- Wire up download button ---
      const dlBtn = qs('#previewDownloadBtn');
      if (dlBtn) {
        dlBtn.dataset.url  = result.downloadUrl || '';
        dlBtn.dataset.type = result.type || 'media';
      }

      previewCard.hidden = false;
      previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      showToast('✅ Media ready — click Download to save');

    } catch (err) {
      console.error(err);
      showToast('❌ ' + (err.message || 'Error connecting to the backend server'));
      field.classList.add('is-invalid');
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });
})();

/* ==========================================================================
   Preview card download button
   ========================================================================== */

(function previewDownload() {
  /**
   * Trigger a download without navigating the current page away.
   *
   * Strategy matrix (all rely on the server sending Content-Disposition: attachment):
   *
   *  Mobile (iOS & Android) → window.open(_blank)
   *    - iOS Safari: the only permitted download method. New tab gets the
   *      attachment header → native "Save to Files" sheet appears.
   *    - Android Chrome: hidden <a download> navigates the current page away
   *      even on same-origin links, causing "page not found". window.open
   *      opens the proxy in a background tab; the download manager intercepts
   *      the Content-Disposition header and the tab closes itself.
   *
   *  Desktop → hidden <a download> click
   *    - No popup-blocker concerns on desktop.
   *    - Content-Disposition: attachment triggers the browser's save dialog.
   *
   * We deliberately avoid:
   *  • window.location.href  — navigates the page away; any server error shows
   *                           "page not found" and the user loses their result.
   *  • fetch → blob → a.download — iOS ignores download on blob URLs (WebKit
   *                           policy); loading a full video into RAM crashes
   *                           low-memory phones.
   */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#previewDownloadBtn');
    if (!btn) return;

    const url = btn.dataset.url;
    if (!url) {
      showToast('Download URL is not available');
      return;
    }

    const mediaType = btn.dataset.type || 'media';
    const ts        = Date.now();
    const filename  = `instagram_${mediaType}_${ts}`;
    const proxyUrl  = `${apiBase}/api/proxy/download?url=${encodeURIComponent(url)}&filename=${filename}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    showToast('⬇️ Download starting…');

    if (isMobile) {
      // Mobile (iOS + Android): open in a new tab.
      // The server responds with Content-Disposition: attachment so the browser
      // triggers the native download manager / "Save to Files" sheet instead of
      // rendering the video. The tab closes automatically after the download starts.
      const win = window.open(proxyUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        // Popup was blocked (common on in-app browsers like Instagram's WebView).
        // Show a helpful message so the user knows what to do.
        showToast('⚠️ Pop-up blocked — open this page in Chrome/Safari and try again');
      }
    } else {
      // Desktop: hidden anchor click. Same-origin proxy + Content-Disposition:
      // attachment reliably triggers the browser save dialog without navigation.
      const a = document.createElement('a');
      a.href     = proxyUrl;
      a.download = filename;
      a.rel      = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 2000);
    }
  });
})();


/* ==========================================================================
   FAQ accordion
   ========================================================================== */

(function accordion() {
  const items = qsa('.accordion__item');
  items.forEach((item) => {
    const trigger = qs('.accordion__trigger', item);
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      items.forEach((other) => {
        other.classList.remove('is-open');
        qs('.accordion__trigger', other).setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

/* ==========================================================================
   Footer year
   ========================================================================== */

(function footerYear() {
  const el = qs('#year');
  if (el) el.textContent = new Date().getFullYear();
})();
