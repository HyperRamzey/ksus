import { dismissPromptEl } from './chrome';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const ICON_FALLBACK =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyUzYuNDggMjIgMTIgMjJTMjIgMTcuNTIgMjIgMTJTMTcuNTIgMiAxMiAyWiIgZmlsbD0iIzJkZTJlNiIvPgo8L3N2Zz4K';

function notify(title: string, body: string, tag: string): void {
  try {
    new Notification(title, { body, icon: ICON_FALLBACK, tag });
  } catch {
    /* Android WebView may require a ServiceWorkerRegistration — non-fatal */
  }
}

let hourlyTimerSet = false;
function startHourlyNotifications(): void {
  if (hourlyTimerSet) return;
  hourlyTimerSet = true;
  window.setInterval(() => {
    notify('xlam HUB Update Check', 'Check out the latest script updates and new releases!', 'update-notification');
  }, 3_600_000);
}

async function requestNotifications(interactive: boolean): Promise<void> {
  if (!('Notification' in window)) {
    if (interactive) alert('❌ This browser does not support notifications.');
    return;
  }
  if (Notification.permission === 'granted') {
    notify('xlam HUB', "Notifications are enabled! You'll get updates every hour.", 'status-notification');
    startHourlyNotifications();
    return;
  }
  if (Notification.permission === 'denied') {
    if (interactive) {
      alert(
        '🔔 Notifications are blocked. To enable:\n\n1. Click the lock/info icon in the address bar\n2. Allow notifications for this site\n3. Refresh the page'
      );
    }
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notify('xlam HUB - Notifications Enabled!', "You'll now receive updates about new scripts and features every hour!", 'welcome-notification');
      startHourlyNotifications();
    } else if (interactive) {
      alert('❌ Notification permission was denied or dismissed.');
    }
  } catch {
    if (interactive) alert('❌ Error requesting notification permission.');
  }
}

function installPWA(): void {
  const prompt = deferredPrompt;
  if (!prompt) {
    alert('Install option not available. You can manually add this site to your home screen.');
    return;
  }
  void prompt.prompt();
  void prompt.userChoice.finally(() => {
    deferredPrompt = null;
    const installBtn = document.getElementById('install-pwa') as HTMLButtonElement;
    installBtn.hidden = true;
  });
}

function showPrompt(id: string, delay: number): void {
  const el = document.getElementById(id);
  if (!el) return;
  // notification prompt shows every visit (old-site behaviour); others respect dismissal
  if (id !== 'notification-prompt' && localStorage.getItem(`${id}_dismissed`)) return;
  window.setTimeout(() => {
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
  }, delay);
}

export function setupPwa(): void {
  const installBtn = document.getElementById('install-pwa') as HTMLButtonElement;
  const notifBtn = document.getElementById('notifications-toggle') as HTMLButtonElement;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installBtn.hidden = false;
  });

  installBtn.addEventListener('click', installPWA);
  notifBtn.addEventListener('click', () => void requestNotifications(true));

  // Auto-prompt buttons
  document.querySelectorAll<HTMLElement>('.auto-prompt').forEach((prompt) => {
    prompt.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'enable-notifications') void requestNotifications(true);
        else if (action === 'install-pwa') installPWA();
        dismissPromptEl(prompt);
      });
    });
  });

  // Service worker for offline support (production builds only)
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    });
  }
}

export function scheduleAutoPrompts(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    showPrompt('notification-prompt', 3000);
  }
  if ('serviceWorker' in navigator) {
    showPrompt('install-prompt', 6000);
  }
}
