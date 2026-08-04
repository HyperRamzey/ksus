import { SCRIPTS, generateRandomLoadstring, getChangelog, type ScriptDef } from './data';
import { copyToClipboard } from './clipboard';

const COPY_ICON_PATH =
  'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
const HISTORY_ICON_PATH =
  'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build an <svg><path></svg> icon node (no innerHTML — avoids the XSS lint). */
function makeIcon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'animated-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

/** Replace a button's content with an icon + text label. */
function setButtonLabel(btn: HTMLButtonElement, pathData: string, label: string): void {
  btn.replaceChildren(makeIcon(pathData), document.createTextNode(` ${label}`));
}

const EMOJIS = ['❤️', '💖', '💗', '💓', '💕', '💞'];

let lastFocused: HTMLElement | null = null;
const hideTimers = new WeakMap<HTMLElement, number>();

export function showModal(modal: HTMLElement): void {
  // Cancel a pending hide (e.g. rapid Back→Forward) so it can't blank us
  const pending = hideTimers.get(modal);
  if (pending) window.clearTimeout(pending);
  lastFocused = document.activeElement as HTMLElement | null;
  modal.hidden = false;
  requestAnimationFrame(() => {
    modal.classList.add('visible');
    // Move focus into the dialog so keyboard/screen-reader users land inside it
    modal.querySelector<HTMLElement>('.close-modal')?.focus();
  });
}

// Page title as shipped in index.html — restored when the detail modal closes.
const BASE_TITLE = document.title;

export function hideModal(modal: HTMLElement): void {
  modal.classList.remove('visible');
  hideTimers.set(modal, window.setTimeout(() => {
    modal.hidden = true;
  }, 300));
  // Return focus to whatever opened the dialog
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
  if (modal.id === 'script-detail-modal') {
    document.title = BASE_TITLE;
    // UI close of a pushed entry: rewind history (popstate no-ops because the
    // modal is already hidden). Deep-link landings have no pushed state — just
    // clean the URL in place.
    if (window.history.state?.s) window.history.back();
    else setScriptParam(null);
  }
}

/** Keep ?s=<script-id> in sync with the open detail modal. */
function setScriptParam(id: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('s', id);
    else url.searchParams.delete('s');
    window.history.replaceState(null, '', url);
  } catch {
    // URL construction or history rejection — non-fatal; modal still works.
  }
}

function openPreviewModal(scriptText: string, copied: boolean): void {
  const modal = document.getElementById('script-preview-modal') as HTMLElement;
  const display = document.getElementById('script-link-display') as HTMLPreElement;
  const msg = document.getElementById('script-preview-msg') as HTMLElement;
  display.textContent = scriptText;
  msg.textContent = copied
    ? 'Your script is ready! It has been automatically copied to your clipboard.'
    : 'Your script is ready! Clipboard access was blocked — tap the code below to select it, then copy it manually.';
  showModal(modal);
}

/** Copy-with-theatre: loader bar + cycling emoji, then modal + clipboard. */
async function runCopyFlow(btn: HTMLButtonElement, pre: HTMLPreElement): Promise<void> {
  if (btn.dataset.loading === '1') return;
  if (btn.classList.contains('copied')) {
    btn.classList.remove('copied');
    setButtonLabel(btn, COPY_ICON_PATH, 'Copy Script');
    return;
  }
  btn.dataset.loading = '1';
  const scriptText = generateRandomLoadstring();
  const originalText = pre.textContent ?? '';
  pre.textContent = '';

  const loader = document.createElement('div');
  loader.className = 'loader-container';
  const bar = document.createElement('div');
  bar.className = 'loader-bar';
  const text = document.createElement('div');
  text.className = 'loader-text';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = 'Generating Script for you';
  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'emoji';
  emojiSpan.textContent = '❤️';
  text.appendChild(labelSpan);
  text.appendChild(emojiSpan);
  loader.appendChild(bar);
  loader.appendChild(text);
  pre.appendChild(loader);

  const duration = Math.floor(Math.random() * 3000) + 2000;
  bar.style.animationDuration = `${duration / 1000}s`;

  let emojiIdx = 0;
  const emojiTimer = window.setInterval(() => {
    emojiSpan.textContent = EMOJIS[(emojiIdx = (emojiIdx + 1) % EMOJIS.length)];
  }, 300);

  await new Promise((r) => window.setTimeout(r, duration));
  window.clearInterval(emojiTimer);
  loader.remove();
  pre.textContent = originalText;

  const ok = await copyToClipboard(scriptText);
  openPreviewModal(scriptText, ok);
  if (ok) {
    btn.classList.add('copied');
    setButtonLabel(btn, COPY_ICON_PATH, '✓ Copied!');
  }
  delete btn.dataset.loading;
}

function openChangelog(script: ScriptDef): void {
  const modal = document.getElementById('changelog-modal') as HTMLElement;
  const title = document.getElementById('changelog-title') as HTMLElement;
  const content = document.getElementById('version-history-content') as HTMLElement;
  title.textContent = `${script.title} - Version History`;
  content.textContent = '';
  for (const v of getChangelog(script.changelogKey)) {
    const item = document.createElement('div');
    item.className = 'version-item';
    const date = document.createElement('div');
    date.className = 'version-date';
    date.textContent = v.date;
    const changes = document.createElement('div');
    changes.className = 'version-changes';
    changes.textContent = v.changes;
    item.append(date, changes);
    content.appendChild(item);
  }
  if (!content.childElementCount) {
    const empty = document.createElement('p');
    empty.textContent = 'No version history recorded for this script yet.';
    content.appendChild(empty);
  }
  showModal(modal);
}

function openDetailModal(script: ScriptDef): void {
  const modal = document.getElementById('script-detail-modal') as HTMLElement;
  const title = document.getElementById('modal-title') as HTMLElement;
  const description = document.getElementById('modal-description') as HTMLElement;
  const copyBtn = document.getElementById('modal-copy-btn') as HTMLButtonElement;
  const gallery = document.getElementById('modal-image-gallery') as HTMLElement;
  title.textContent = script.title;
  description.textContent = script.description;
  // Tab title mirrors the open script — deep-linked/shared tabs are identifiable.
  document.title = `${script.title} — xlam HUB`;
  // Mirror the open script into ?s= so the view is shareable, and push a
  // history entry so the (mobile) Back button closes the modal instead of
  // leaving the site. Deep-link landings already have ?s= in the URL — no
  // push there, so Back still exits to wherever the visitor came from.
  if (new URLSearchParams(window.location.search).get('s') !== script.id) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('s', script.id);
      window.history.pushState({ s: script.id }, '', url);
    } catch {
      // URL construction or pushState rejection — non-fatal
    }
  }
  setButtonLabel(copyBtn, COPY_ICON_PATH, '💪 Copy Script');
  const shareBtn = document.getElementById('modal-share-btn') as HTMLButtonElement;
  shareBtn.textContent = '🔗 Share';
  copyBtn.onclick = async () => {
    const text = generateRandomLoadstring();
    const ok = await copyToClipboard(text);
    if (ok) {
      setButtonLabel(copyBtn, COPY_ICON_PATH, '✅ Copied!');
    } else {
      // Clipboard blocked — still surface the script link so the user can copy manually.
      openPreviewModal(text, false);
    }
  };
  shareBtn.onclick = async () => {
    try {
      const url = new URL(window.location.href);
      url.search = `?s=${script.id}`;
      const link = url.toString();
      // Native share sheet where available (mobile); clipboard elsewhere.
      if (navigator.share) {
        try {
          await navigator.share({ title: script.title, url: link });
          return;
        } catch {
          /* user cancelled — fall through to clipboard */
        }
      }
      if (await copyToClipboard(link)) {
        shareBtn.textContent = '✅ Link copied!';
        window.setTimeout(() => {
          shareBtn.textContent = '🔗 Share';
        }, 2000);
      }
    } catch {
      // URL or share failure — non-fatal
    }
  };
  // Populate gallery dynamically
  gallery.replaceChildren();
  if (script.images?.length) {
    for (const src of script.images) {
      const btn = document.createElement('button');
      btn.className = 'gallery-img-container';
      btn.type = 'button';
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${script.title} preview`;
      img.className = 'gallery-img';
      img.loading = 'lazy';
      img.decoding = 'async';
      // Remove the whole tile if the image is missing
      img.onerror = () => btn.remove();
      btn.appendChild(img);
      gallery.appendChild(btn);
    }
  }
  showModal(modal);
}

export function renderCards(): void {
  const container = document.getElementById('scripts-container') as HTMLElement;

  SCRIPTS.forEach((script, i) => {
    const card = document.createElement('article');
    card.className = 'script-card';
    card.style.setProperty('--card-i', String(i));
    card.dataset.scriptId = script.id;
    // Searchable haystack: heading + description (card badge tags removed)
    card.dataset.search = `${script.heading} ${script.description}`.toLowerCase();

    const h2 = document.createElement('h2');
    h2.textContent = script.heading;

    // Image strip on card (max 3 thumbnails)
    if (script.images?.length) {
      const imgStrip = document.createElement('div');
      imgStrip.className = 'card-images';
      const maxThumbs = Math.min(script.images.length, 3);
      for (let i = 0; i < maxThumbs; i++) {
        const thumb = document.createElement('img');
        thumb.src = script.images[i];
        thumb.alt = `${script.title} preview ${i + 1}`;
        thumb.className = 'card-img-thumb';
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        thumb.fetchPriority = 'low'; // decorative thumbs never compete with content
        thumb.width = 160;
        thumb.height = 90;
        // A missing file should collapse silently, not show a broken-image icon
        thumb.onerror = () => thumb.remove();
        imgStrip.appendChild(thumb);
      }
      card.insertBefore(imgStrip, h2.nextSibling);
    }

    const meta = document.createElement('div');
    meta.className = 'script-meta';

    const pre = document.createElement('pre');
    pre.textContent = 'Click "Copy Script" to get the code';

    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn copy-btn';
    setButtonLabel(copyBtn, COPY_ICON_PATH, 'Copy Script');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      void runCopyFlow(copyBtn, pre);
    });

    const historyBtn = document.createElement('button');
    historyBtn.type = 'button';
    historyBtn.className = 'btn secondary-btn';
    setButtonLabel(historyBtn, HISTORY_ICON_PATH, 'Version History');
    historyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openChangelog(script);
    });

    buttons.append(copyBtn, historyBtn);
    card.append(h2, meta, pre, buttons);
    // Card is clickable + keyboard-operable (opens detail modal)
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${script.title} — details`);
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      openDetailModal(script);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if ((e.target as HTMLElement).closest('button, a')) return;
      e.preventDefault();
      openDetailModal(script);
    });
    container.appendChild(card);
  });

  // Honour ?s=<id> deep links: open that script's detail modal on load.
  const requested = new URLSearchParams(window.location.search).get('s');
  if (requested) {
    const target = SCRIPTS.find((s) => s.id === requested);
    if (target) openDetailModal(target);
    else setScriptParam(null); // stale/unknown id — clean the URL
  }

  // Back/Forward drive the modal: Back closes it (instead of leaving the
  // site), Forward reopens it. Both branches are loop-safe — hideModal only
  // rewinds history when a pushed ?s= entry is still current, and
  // openDetailModal only pushes when ?s= isn't already in the URL.
  window.addEventListener('popstate', () => {
    const modal = document.getElementById('script-detail-modal') as HTMLElement;
    const id = new URLSearchParams(window.location.search).get('s');
    const isOpen = modal.classList.contains('visible');
    if (!id && isOpen) {
      hideModal(modal);
    } else if (id && !isOpen) {
      const target = SCRIPTS.find((s) => s.id === id);
      if (target) openDetailModal(target);
    }
  });
}

export function setupSearch(): void {
  const searchBar = document.getElementById('search-bar') as HTMLInputElement;
  const noResults = document.getElementById('no-results') as HTMLElement;
  const status = document.getElementById('search-status') as HTMLElement;

  const applyFilter = (term: string): void => {
    const q = term.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll<HTMLElement>('.script-card').forEach((card) => {
      const haystack = card.dataset.search ?? card.querySelector('h2')?.textContent?.toLowerCase() ?? '';
      const match = haystack.includes(q);
      card.style.display = match ? 'flex' : 'none';
      if (match) visible++;
    });
    noResults.hidden = visible > 0;
    // Announce result count to screen readers (empty query = no announcement)
    status.textContent = q ? `${visible} script${visible === 1 ? '' : 's'} found` : '';
  };

  searchBar.addEventListener('input', () => {
    applyFilter(searchBar.value);
    syncQueryParam(searchBar.value);
  });

  // "/" focuses the search bar (common list-page convention); ignored while typing.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
    e.preventDefault();
    searchBar.focus();
  });

  // Escape in the search bar clears the filter (type="search" only clears the text).
  searchBar.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !searchBar.value) return;
    e.stopPropagation(); // don't also close a modal
    searchBar.value = '';
    applyFilter('');
    syncQueryParam('');
  });

  // "Clear search" button inside the no-results message
  document.getElementById('clear-search')?.addEventListener('click', () => {
    searchBar.value = '';
    applyFilter('');
    syncQueryParam('');
    searchBar.focus();
  });

  // Honour ?q= so the JSON-LD SearchAction (and shared search links) work.
  const initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) {
    searchBar.value = initialQuery;
    applyFilter(initialQuery);
  }
}

let syncTimer = 0;
/** Debounced: mirror the search term into ?q= so results are shareable. */
function syncQueryParam(term: string): void {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      const q = term.trim();
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      window.history.replaceState(null, '', url);
    } catch {
      // Non-fatal — search still works without ?q= sync.
    }
  }, 400);
}
