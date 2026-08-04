/**
 * Lightweight interaction polish, all transform/opacity only:
 *  - scroll-reveal via IntersectionObserver (one-shot, no scroll listener)
 *  - desktop 3D card tilt following the pointer (rAF-throttled)
 *  - button ripple on click (single delegated listener, CSS-animated)
 * Every piece bails out under prefers-reduced-motion or on touch devices
 * where it doesn't make sense.
 */
import { log, logWarn } from './logger';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function setupCardEntry(): void {
  log('Reveal', 'setting up card entry listeners');
  document.querySelectorAll<HTMLElement>('.script-card').forEach((card) => {
    card.addEventListener('animationend', (e) => {
      if (e.animationName === 'card-entry' || e.animationName === 'card-entry-mobile') {
        log('Reveal', 'card entry animation complete');
        card.classList.add('entered');
      }
    }, { once: true });
  });
}

export function setupReveal(): void {
  if (reduced) {
    log('Reveal', 'skipped: prefers-reduced-motion enabled');
    return;
  }
  if (!('IntersectionObserver' in window)) {
    logWarn('Reveal', 'IntersectionObserver not available');
    return;
  }
  log('Reveal', 'setting up scroll reveal');
  const targets = document.querySelectorAll<HTMLElement>('.script-card, footer');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        log('Reveal', 'element revealed: %s', entry.target.tagName);
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  targets.forEach((el) => {
    el.classList.add('reveal-pending');
    io.observe(el);
  });
  log('Reveal', 'observing %d elements', targets.length);
}

export function setupCardTilt(): void {
  if (!fine) {
    log('Reveal', 'skipped: not a fine-pointer device');
    return;
  }
  if (reduced) {
    log('Reveal', 'skipped: prefers-reduced-motion enabled');
    return;
  }
  log('Reveal', 'setting up 3D card tilt');
  const MAX_TILT = 5; // degrees
  let raf = 0;
  let card: HTMLElement | null = null;
  let mx = 0, my = 0;

  function apply(): void {
    raf = 0;
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (mx - r.left) / r.width - 0.5;
    const py = (my - r.top) / r.height - 0.5;
    card.style.transform =
      `translateZ(0) perspective(1000px) rotateX(${(-py * MAX_TILT).toFixed(2)}deg) rotateY(${(px * MAX_TILT).toFixed(2)}deg) translateY(-6px)`;
  }

  document.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.script-card');
    if (el !== card) {
      if (card) card.style.transform = '';
      card = el;
    }
    if (!card) return;
    mx = e.clientX;
    my = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    if (card && !card.contains(e.relatedTarget as Node)) {
      card.style.transform = '';
      card = null;
    }
  }, { passive: true });
}

export function setupRipple(): void {
  if (reduced) {
    log('Reveal', 'skipped: prefers-reduced-motion enabled');
    return;
  }
  log('Reveal', 'setting up button ripple');
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.btn, .placard, .xp-login-btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${d}px`;
    ripple.style.left = `${e.clientX - r.left - d / 2}px`;
    ripple.style.top = `${e.clientY - r.top - d / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }, { passive: true });
}
