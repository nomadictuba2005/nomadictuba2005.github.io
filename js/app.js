// Ties the weather app and the hidden notebook together, and handles locking.
import { initWeather } from './weather.js';
import * as V from './vault.js';
import { mountHub, unmountHub, autoLockSuspended, autoLockMinutes } from './hub.js';
import { showSetup, hideSetup } from './setup.js';
import { SETUP_PHRASE, SETUP_LINK } from './config.js';

const weatherEl = document.getElementById('weather');
const hubEl = document.getElementById('hub');
let lastActivity = Date.now();

function openHub(firstRun = false) {
  weatherEl.hidden = true;
  hubEl.hidden = false;
  lastActivity = Date.now();
  mountHub(hubEl, { onExit: exitHub, onWiped: exitHub, firstRun });
}

// Quick exit: swap the screen first so it's instant, then save and lock.
async function exitHub() {
  if (hubEl.hidden) return;
  hubEl.hidden = true;
  weatherEl.hidden = false;
  window.scrollTo(0, 0);
  await unmountHub();
  V.lock();
}

initWeather({
  // Every search goes through here first. The secret code never leaves the device.
  async onQuery(q) {
    if (q.toLowerCase() === SETUP_PHRASE.toLowerCase() && !(await V.exists())) {
      showSetup({ onReady: openHub });
      return true;
    }
    if (await V.unlock(q)) {
      openHub();
      return true;
    }
    return false;
  },
});

// Private setup link (see config.js). Clean the address bar first so the
// link doesn't stay in browser history, then open setup if there's no notebook yet.
if (SETUP_LINK && location.hash === SETUP_LINK) {
  history.replaceState(null, '', location.pathname + location.search);
  V.exists().then(has => { if (!has) showSetup({ onReady: openHub }); });
}

// Esc = quick exit on a computer
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  hideSetup();
  if (V.isUnlocked()) exitHub();
});

// Lock as soon as the app is hidden (app switcher, home button, another tab)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || autoLockSuspended()) return;
  hideSetup();
  if (V.isUnlocked()) exitHub();
});
window.addEventListener('pagehide', () => {
  hideSetup();
  if (V.isUnlocked()) exitHub();
});

// Lock after a few minutes without any interaction
for (const ev of ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart']) {
  window.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true, capture: true });
}
setInterval(() => {
  if (V.isUnlocked() && !autoLockSuspended() && Date.now() - lastActivity > autoLockMinutes() * 60000) exitHub();
}, 10000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
