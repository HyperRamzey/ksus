export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy path */
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    // Intentional legacy fallback: execCommand is deprecated but still works in
    // WebViews (older Android/iOS in-app browsers) where the Clipboard API is
    // unavailable or blocked — see commit cd5c7cb. Do not remove without
    // verifying the "clipboard denied" recovery flow still works.
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    ta.remove();
    return false;
  }
}
