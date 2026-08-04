/** Flyout menu, back-to-top, edge-swipe to open menu, swipe-to-dismiss prompts. */
import { showModal } from './cards';

export function setupChrome(): void {
  const menuBtn = document.getElementById('menu-btn') as HTMLButtonElement;
  const flyout = document.getElementById('flyout-menu') as HTMLElement;
  const backToTop = document.getElementById('back-to-top') as HTMLButtonElement;
  const faqLink = document.getElementById('faq-link') as HTMLAnchorElement;
  const executorModal = document.getElementById('executor-modal') as HTMLElement;

  function setMenu(open: boolean): void {
    flyout.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenu(!flyout.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!flyout.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) setMenu(false);
  });
  document.addEventListener('touchstart', (e) => {
    if (!flyout.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) setMenu(false);
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !flyout.classList.contains('open')) return;
    setMenu(false);
    menuBtn.focus(); // return focus to the toggle for keyboard users
  });

  faqLink.addEventListener('click', (e) => {
    e.preventDefault();
    showModal(executorModal);
    setMenu(false);
  });

  // Back-to-top — rAF-throttled scroll listener
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      backToTop.classList.toggle('visible', window.scrollY > 300);
      ticking = false;
    });
  }, { passive: true });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  setupSwipes(flyout, setMenu);
}

function setupSwipes(flyout: HTMLElement, setMenu: (open: boolean) => void): void {
  let startX: number | null = null;
  let startY: number | null = null;
  let swipeTarget: HTMLElement | 'menu' | null = null;

  // The non-passive (scroll-blocking) touchmove listener is attached only
  // while a swipe gesture is actually in progress; normal page scrolling
  // never waits on JS.
  function onTouchMove(e: TouchEvent): void {
    if (startX === null || startY === null || !swipeTarget) return;
    const diffX = e.touches[0].clientX - startX;
    const diffY = e.touches[0].clientY - startY;
    if (swipeTarget !== 'menu') {
      if (Math.abs(diffX) > Math.abs(diffY) && diffX > 0) {
        e.preventDefault();
        swipeTarget.style.transform = `translateX(${diffX}px) translateZ(0)`;
      }
    } else if (diffX > 0 && !flyout.classList.contains('open')) {
      e.preventDefault();
      const progress = Math.min(diffX / 300, 1);
      flyout.style.transform = `translateX(${-105 + 105 * progress}%) translateZ(0)`;
    }
  }

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    const prompt = (e.target as HTMLElement).closest<HTMLElement>('.auto-prompt');
    if (prompt) {
      swipeTarget = prompt;
      prompt.classList.add('swiping');
    } else if (startX < 50) {
      swipeTarget = 'menu';
    }
    if (swipeTarget) document.addEventListener('touchmove', onTouchMove, { passive: false });
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    document.removeEventListener('touchmove', onTouchMove);
    if (swipeTarget && swipeTarget !== 'menu') {
      swipeTarget.classList.remove('swiping');
      swipeTarget.style.transform = '';
    } else if (swipeTarget === 'menu') {
      flyout.style.transform = '';
    }
    startX = startY = null;
    swipeTarget = null;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    document.removeEventListener('touchmove', onTouchMove);
    if (startX === null) return;
    const diffX = e.changedTouches[0].clientX - startX;
    if (swipeTarget && swipeTarget !== 'menu') {
      swipeTarget.classList.remove('swiping');
      if (diffX > 100) {
        dismissPromptEl(swipeTarget);
      } else {
        swipeTarget.style.transform = '';
      }
    } else if (swipeTarget === 'menu') {
      flyout.style.transform = '';
      if (diffX > 100) setMenu(true);
    }
    startX = startY = null;
    swipeTarget = null;
  }, { passive: true });
}

export function dismissPromptEl(el: HTMLElement): void {
  el.classList.remove('show');
  el.style.transform = 'translateY(100px) translateZ(0)';
  el.style.opacity = '0';
  localStorage.setItem(`${el.id}_dismissed`, 'true');
  window.setTimeout(() => el.remove(), 300);
}
