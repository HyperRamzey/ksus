import { applyDancingText } from './dancing';

/** Skips BIOS / XP login / loading bar — goes straight to main content. */
export function runBootSequence(onMainReady: () => void): void {
  const main = document.getElementById('main-content') as HTMLElement;
  const menuBtn = document.getElementById('menu-btn') as HTMLButtonElement;

  document.getElementById('bios-screen')?.remove();
  document.getElementById('xp-login-screen')?.remove();
  document.getElementById('loading-bar')?.remove();

  document.body.dataset.stage = 'main';
  main.hidden = false;
  menuBtn.hidden = false;
  applyDancingText(main);
  onMainReady();
}
