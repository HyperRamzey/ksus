/**
 * Randomly triggers the glitch effect on the logo text.
 * Every 2–5 seconds there's a 50% chance of a short glitch burst (~0.6s).
 * Bails out under prefers-reduced-motion.
 */

(function init(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const el = document.querySelector('.lamhub-text')!;

  const GLITCH_DUR = 600; // ms the glitch class stays on

  function schedule(): void {
    const delay = 2000 + Math.random() * 3000; // 2–5 seconds
    setTimeout(() => {
      // 50% chance
      if (Math.random() < 0.5) {
        el.classList.add('glitching');
        setTimeout(() => el.classList.remove('glitching'), GLITCH_DUR);
      }
      schedule(); // always reschedule
    }, delay);
  }

  schedule();
})();
