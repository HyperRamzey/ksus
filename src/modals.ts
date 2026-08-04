import { hideModal, showModal } from './cards';
import { copyToClipboard } from './clipboard';

/** Wires up every modal overlay, the image lightbox, and shared close behaviour. */
export function setupModals(): void {
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach((overlay) => {
    overlay.querySelector<HTMLButtonElement>('.close-modal')?.addEventListener('click', () => hideModal(overlay));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideModal(overlay);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll<HTMLElement>('.modal-overlay.visible').forEach(hideModal);
    closeImageOverlay();
  });

  // Trap Tab focus inside the topmost open dialog (aria-modal expects it).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const open = document.querySelector<HTMLElement>('.modal-overlay.visible');
    if (!open) return;
    const focusables = open.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !open.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !open.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  });

  // "Copy Again" inside the preview modal
  const manualCopyBtn = document.getElementById('manual-copy-btn') as HTMLButtonElement;
  const display = document.getElementById('script-link-display') as HTMLPreElement;
  manualCopyBtn.addEventListener('click', async () => {
    const text = display.textContent;
    if (text && (await copyToClipboard(text))) {
      manualCopyBtn.textContent = '✓ Copied!';
      window.setTimeout(() => {
        manualCopyBtn.textContent = '📋 Copy Again';
      }, 2000);
    }
  });

  // Free pet placard
  const placard = document.getElementById('free-pet-placard') as HTMLButtonElement;
  const petModal = document.getElementById('pet-modal') as HTMLElement;
  placard.addEventListener('click', () => showModal(petModal));

  setupImageOverlay();
}

const imageOverlay = (): HTMLElement => document.getElementById('image-overlay') as HTMLElement;

function closeImageOverlay(): void {
  const overlay = imageOverlay();
  if (!overlay.classList.contains('active')) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  window.setTimeout(() => {
    overlay.hidden = true;
  }, 300);
}

function setupImageOverlay(): void {
  const overlay = imageOverlay();
  const enlarged = document.getElementById('enlarged-image') as HTMLImageElement;

  // Delegated: gallery images are re-created every time the detail modal
  // opens, so a static querySelectorAll at init would never match them.
  document.addEventListener('click', (e) => {
    const container = (e.target as HTMLElement).closest<HTMLElement>('.gallery-img-container');
    const img = container?.querySelector<HTMLImageElement>('.gallery-img');
    if (!img) return;
    enlarged.src = img.src;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('active'));
    document.body.style.overflow = 'hidden';
  });

  overlay.querySelector('.close-overlay')?.addEventListener('click', closeImageOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeImageOverlay();
  });
}
