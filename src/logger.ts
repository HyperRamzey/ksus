/**
 * Single-switch console logger — set ENABLE_LOGGING to false before build
 * to strip all logging output in production.
 *
 * Uses a simple if-guard that Vite's treeshaking will eliminate when
 * ENABLE_LOGGING is a compile-time const false.
 */
export const ENABLE_LOGGING = true; // ← flip to false to disable all logging

function now(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function log(label: string, ...args: unknown[]): void {
  if (!ENABLE_LOGGING) return;
  console.log(`[xlam] [${now()}] ${label}`, ...args);
}

export function logWarn(label: string, ...args: unknown[]): void {
  if (!ENABLE_LOGGING) return;
  console.warn(`[xlam] [${now()}] ${label}`, ...args);
}

export function logError(label: string, ...args: unknown[]): void {
  if (!ENABLE_LOGGING) return;
  console.error(`[xlam] [${now()}] ${label}`, ...args);
}
