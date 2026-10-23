// Ties the weather app and the hidden notebook together, and handles locking.
// The notebook never depends on the weather: weather.js is loaded separately, and the search box
// (where the code is typed) is handled here, so the notebook opens even if the weather is broken.
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

const weather = import('./weather.js')
  .then(m => { m.initWeather(); return m; })
  .catch(() => null);

// Every search goes through here first. The secret code never leaves the device;
// only text that isn't the code or setup phrase is passed on as a city search.
async function isSecret(q) {
  if (q.toLowerCase() === SETUP_PHRASE.toLowerCase() && !(await V.exists())) {
    showSetup({ onReady: openHub });
    return true;
  }
  if (await V.unlock(q)) {
    openHub();
    return true;
  }
  return false;
}

const searchInput = document.getElementById('wx-q');
document.getElementById('wx-search').addEventListener('submit', async e => {
  e.preventDefault();
  const q = searchInput.value.trim();
  searchInput.blur();
  if (!q) return;
  if (await isSecret(q)) {
    searchInput.value = '';
    document.getElementById('wx-results').hidden = true;
    return;
  }
  (await weather)?.search(q);
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
  // When a new version takes over, reload so it's used right away, but only from the weather
  // screen with nothing typed. Never while the notebook is open.
  const hadVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadVersion && !V.isUnlocked() && !document.querySelector('#weather').hidden && !document.querySelector('#wx-q').value) location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
