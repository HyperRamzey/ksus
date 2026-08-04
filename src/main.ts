import './styles.css';
import './logo-glitch';
import { runBootSequence } from './boot';
import { renderCards, setupSearch } from './cards';
import { setupModals } from './modals';
import { setupChrome } from './chrome';
import { setupPwa, scheduleAutoPrompts } from './pwa';
import { startSmoke } from './smoke';
import { startConstellation } from './constellation';
import { setupReveal, setupCardEntry, setupCardTilt, setupRipple } from './reveal';

const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

function enableCustomCursor(): void {
  if (isTouch) return;
  const cursor = document.getElementById('custom-cursor') as HTMLElement;
  document.body.classList.add('custom-cursor-enabled');
  cursor.classList.add('active');
  document.addEventListener('mousemove', (e) => {
    // translate3d keeps cursor movement on the compositor thread
    cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
  }, { passive: true });
}

function init(): void {
  renderCards();
  setupSearch();
  setupModals();
  setupChrome();
  setupPwa();
  startSmoke(document.getElementById('smoke-canvas') as HTMLCanvasElement);
  startConstellation(document.getElementById('star-constellation') as HTMLCanvasElement);
  setupCardEntry();
  setupReveal();
  setupCardTilt();
  setupRipple();
  enableCustomCursor();

  runBootSequence(() => {
    scheduleAutoPrompts();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
