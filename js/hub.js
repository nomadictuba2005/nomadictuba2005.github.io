// The hidden notebook. Only rendered while unlocked; its DOM is removed
// completely when the user hides it, so nothing lingers on screen.
import * as V from './vault.js';
import { icon } from './icons.js';
import { content, typeId, typeLabel } from './content.js';
import { localHelp } from './local.js';
import { t, tn, setLang, getLang, locale, LANGS, pick } from './i18n.js';

let root = null;
let opts = {};
let tab = 'home';
let urls = [];          // object URLs for decrypted photos, revoked on hide
let draft = null;       // journal entry being edited
let saveTimer = null;
let suspendLock = false; // true while the camera/file picker is open
let persisted = null;    // whether the browser promised not to clear storage (null = unknown)

// On iPhone, Safari erases a website's storage after 7 days without a visit,
// but apps added to the Home Screen are kept. Detect when we're at risk.
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_INSTALLED = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const BACKUP_EVERY_DAYS = 14;
const HOTLINE = '1-800-799-7233';

// Entry fields that are tracked in edit history, in display order
const ENTRY_FIELDS = ['when', 'types', 'what', 'severity', 'injuries', 'where', 'witnesses', 'police', 'report', 'medical'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = () => V.getData();
const fmt = when => new Date(when).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
const fmtTime = when => new Date(when).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' });
const toLocalInput = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const telLink = n => `tel:${n.replace(/[^\d+]/g, '')}`;
// "?&body=" works on both iOS and Android
const smsLink = (n, body = '') => `sms:${n.replace(/[^\d+]/g, '')}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
const hotlineLink = () => `<a href="${telLink(HOTLINE)}">${HOTLINE}</a>`;
const kbOnly = s => `<span class="kb-only">${s}</span>`;

export const autoLockSuspended = () => suspendLock;
export const autoLockMinutes = () => data()?.settings.autoLockMin || 5;

const TABS = ['home', 'journal', 'person', 'plan', 'help'];

// ---------- Mount / unmount ----------

export function mountHub(container, o) {
  root = container;
  opts = o;
  tab = 'home';
  setLang(data().settings.lang || 'en');
  root.innerHTML = `
    <header class="nb-top"></header>
    <main class="nb-main" id="hub-main"></main>
    <div class="sheet" id="sheet" hidden></div>
    <div class="viewer" id="viewer" data-act="viewer-close" hidden></div>
    <div class="toast" id="toast" role="status"></div>`;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  render();
  // Ask for persistent storage; the answer decides whether Home shows a warning.
  const ask = navigator.storage?.persist ? navigator.storage.persist() : Promise.resolve(null);
  ask.then(p => {
    persisted = p;
    if (root && !p && (tab === 'home' || tab === 'settings')) render();
  }).catch(() => {});
}

export async function unmountHub() {
  if (!root) return;
  root.removeEventListener('click', onClick);
  root.removeEventListener('input', onInput);
  root.removeEventListener('change', onChange);
  // If they hit Hide mid-entry, keep what they wrote instead of losing it.
  const pending = draft ? commitDraft(true) : null;
  root.innerHTML = '';
  root = null;
  document.getElementById('print-report').innerHTML = '';
  await pending;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (V.isUnlocked()) await V.save();
  }
  urls.forEach(u => URL.revokeObjectURL(u));
  urls = [];
  suspendLock = false;
}

// ---------- Helpers ----------

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (V.isUnlocked()) { await V.save(); toast(t('saved')); }
  }, 600);
}

function toast(msg) {
  const el = root?.querySelector('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._h);
  el._h = setTimeout(() => el.classList.remove('show'), 1600);
}

async function blobUrl(id) {
  const bytes = await V.getBlob(id);
  if (!bytes) return '';
  const u = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
  urls.push(u);
  return u;
}

// Fill in <img data-blob="id"> elements with decrypted photos.
function hydrate(scope) {
  return Promise.all([...scope.querySelectorAll('img[data-blob]')].map(async img => {
    img.src = await blobUrl(img.dataset.blob);
    img.removeAttribute('data-blob');
    if (img.decode) await img.decode().catch(() => {});
  }));
}

// Resize to max 1600px and re-encode as JPEG. This also strips EXIF data such as GPS location.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob(async b => resolve(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error(t('photo.bad'))); };
    img.src = src;
  });
}

// Two-tap confirm instead of a browser dialog (dialogs block the page and look out of place).
function confirmTap(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  const old = btn.innerHTML;
  btn.innerHTML = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = old; } }, 3000);
  return false;
}

function planCount() {
  const all = content().PLAN.flatMap(s => s.items.map(([id]) => `${s.id}.${id}`));
  return [all.filter(k => data().plan.checks[k]).length, all.length];
}

// ---------- Rendering ----------

function renderTop() {
  root.querySelector('.nb-top').innerHTML = `
    <div class="nb-bar">
      <button class="hide-btn" data-act="exit" title="${t('top.hide')} (Esc)" aria-keyshortcuts="Escape">${t('top.hide')}<kbd class="kb-only">Esc</kbd></button>
      <span class="nb-space"></span>
      <button class="nb-settings ${tab === 'settings' ? 'on' : ''}" data-tab="settings">${t('top.settings')}</button>
      <a class="sos-btn" href="tel:911">${t('top.call911')}</a>
    </div>
    <nav class="nb-tabs" aria-label="${t('top.sections')}">${TABS.map(id => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${t('tab.' + id)}</button>`).join('')}</nav>`;
}

function render() {
  const main = root.querySelector('#hub-main');
  const views = { home: homeView, journal: journalView, person: personView, plan: planView, help: helpView, settings: settingsView };
  document.documentElement.lang = getLang();
  renderTop();
  main.innerHTML = views[tab]();
  window.scrollTo(0, 0);
  hydrate(main);
}

const intro = (title, text) => `<h1>${title}</h1><p class="lede">${text}</p>`;

const daysSince = iso => Math.floor((Date.now() - new Date(iso)) / 86400000);
const backupDue = d => (d.incidents.length || d.person.name) && (!d.lastBackup || daysSince(d.lastBackup) >= BACKUP_EVERY_DAYS);

// Warnings about losing the notebook. Only ever shown inside the notebook.
function keepSafeWarnings() {
  const d = data();
  const out = [];
  if (IS_IOS && !IS_INSTALLED) {
    out.push(`<div class="note warn"><h2>${t('warn.ios.title')}</h2>
      <p>${t('warn.ios.body')} ${t('warn.addHome')}</p></div>`);
  } else if (persisted === false) {
    out.push(`<div class="note warn"><h2>${t('warn.persist.title')}</h2>
      <p>${t('warn.persist.body')} ${IS_INSTALLED ? '' : t('warn.persist.install') + ' '}${t('warn.persist.backup')}</p>
      <button class="btn ghost sm" data-act="export">${t('backup.download')}</button></div>`);
  }
  if (backupDue(d)) {
    out.push(`<div class="note"><h2>${t('warn.backup.title')}</h2>
      <p>${d.lastBackup ? t('warn.backup.last', { days: tn('days', daysSince(d.lastBackup)) }) : t('warn.backup.never')} ${t('warn.backup.why')}</p>
      <button class="btn ghost sm" data-act="export">${t('backup.download')}</button></div>`);
  }
  return out.join('');
}

function homeView() {
  const d = data();
  const [done, total] = planCount();
  return `
    ${opts.firstRun ? `
      <div class="note">
        <h2>${t('home.ready.title')}</h2>
        <p>${t('home.ready.body', { esc: kbOnly(t('home.ready.esc')) })}</p>
      </div>` : ''}
    ${keepSafeWarnings()}
    ${intro(t('home.title'), t('home.lede'))}
    <button class="btn primary full big" data-act="new-entry">${t('home.write')}</button>
    <button class="btn link" data-act="quick-note">${t('home.quick')}</button>

    <h2 class="section">${t('home.talk')}</h2>
    <ul class="rows">
      <li>
        <div><b>${t('home.hotline.name')}</b><span>${t('home.hotline.desc')}</span></div>
        <a class="btn ghost sm" href="${telLink(HOTLINE)}">${t('call')}</a>
        <a class="btn ghost sm" href="${smsLink('88788', 'START')}">${t('text')}</a>
      </li>
      <li>
        <div><b>${t('home.trusted')}</b><span>${d.contacts.length ? t('home.trusted.has') : t('home.trusted.none')}</span></div>
        <button class="btn ghost sm" data-act="alert">${d.contacts.length ? t('home.trusted.send') : t('home.trusted.add')}</button>
      </li>
    </ul>

    <h2 class="section">${t('home.inhere')}</h2>
    <ul class="rows guide">
      <li><button class="row-link" data-tab="journal"><b>${t('tab.journal')}</b>
        <span>${t('home.journal.desc')} ${d.incidents.length ? t('home.journal.count', { entries: tn('entries', d.incidents.length) }) : t('home.journal.none')}</span></button></li>
      <li><button class="row-link" data-tab="person"><b>${t('tab.person')}</b>
        <span>${t('home.person.desc')}</span></button></li>
      <li><button class="row-link" data-tab="plan"><b>${t('tab.plan')}</b>
        <span>${t('home.plan.desc', { done, total })}</span></button></li>
      <li><button class="row-link" data-tab="help"><b>${t('tab.help')}</b>
        <span>${t('home.help.desc')}</span></button></li>
    </ul>`;
}

function journalView() {
  const list = [...data().incidents].sort((a, b) => b.when.localeCompare(a.when));
  const thisYear = new Date().getFullYear();
  return `
    ${intro(t('tab.journal'), t('journal.lede'))}
    <div class="actions">
      <button class="btn primary" data-act="new-entry">${t('journal.add')}</button>
      ${list.length ? `<button class="btn ghost" data-act="report">${t('journal.print')}</button>` : ''}
    </div>
    ${list.length ? `<ol class="timeline">${list.map(e => {
      const dt = new Date(e.when);
      const meta = [
        t('journal.howbad', { n: e.severity }),
        e.photos.length && tn('photos', e.photos.length),
        e.police && t('journal.police'),
        e.history?.length && tn('journal.edited', e.history.length),
      ].filter(Boolean).join('. ');
      return `<li><button class="tl" data-act="edit-entry" data-id="${e.id}">
        <span class="tl-date"><b>${dt.getDate()}</b>${dt.toLocaleDateString(locale(), { month: 'short' })}${dt.getFullYear() !== thisYear ? `<br>${dt.getFullYear()}` : ''}</span>
        <span class="tl-body">
          <span class="tl-head">${fmtTime(e.when)}${e.types.length ? `, ${esc(e.types.map(typeLabel).join(', ').toLowerCase())}` : ''}</span>
          <span class="tl-text">${esc(e.what.slice(0, 160)) || t('journal.nodesc')}${e.what.length > 160 ? '…' : ''}</span>
          <span class="tl-meta">${meta}</span>
        </span>
      </button></li>`;
    }).join('')}</ol>` : `<p class="empty">${t('journal.empty')}</p>`}`;
}

function personView() {
  const p = data().person;
  const { PERSON_FIELDS, PERSON_GROUPS } = content();
  const field = ([k, label, ph, type]) => `
        <label>${label}
          ${type === 'area'
            ? `<textarea rows="2" data-person="${k}" placeholder="${ph}">${esc(p[k])}</textarea>`
            : `<input type="${type || 'text'}" data-person="${k}" placeholder="${ph}" value="${esc(p[k])}">`}
        </label>`;
  return `
    ${intro(t('person.title'), t('person.lede'))}
    <div class="person-photo">
      ${p.photo ? `<img data-blob="${p.photo}" alt="${t('person.photoAlt')}" data-act="view">` : `<div class="ph">${t('person.nophoto')}</div>`}
      <div>
        <label class="btn ghost">${p.photo ? t('person.changePhoto') : t('person.addPhoto')}<input type="file" accept="image/*" hidden data-person-photo></label>
        ${p.photo ? `<button class="btn link" data-act="person-photo-remove">${t('remove')}</button>` : ''}
      </div>
    </div>
    ${PERSON_GROUPS.map(([title, keys]) => `
      <h2 class="section">${title}</h2>
      <div class="form">${PERSON_FIELDS.filter(f => keys.includes(f[0])).map(field).join('')}</div>`).join('')}`;
}

function planView() {
  const { checks, notes } = data().plan;
  const { PLAN, PLAN_NOTES } = content();
  const [done, total] = planCount();
  return `
    ${intro(t('tab.plan'), t('plan.lede', { hotline: hotlineLink() }))}
    <p class="progress">${t('plan.progress', { done, total })}<i class="bar"><i style="width:${(done / total) * 100}%"></i></i></p>
    ${PLAN.map(s => `
      <h2 class="section">${s.title}</h2><p class="hint">${s.hint}</p>
      <ul class="checks">${s.items.map(([id, label]) => `
        <li><label><input type="checkbox" data-check="${s.id}.${id}" ${checks[`${s.id}.${id}`] ? 'checked' : ''}><span>${label}</span></label></li>`).join('')}
      </ul>`).join('')}
    <h2 class="section">${t('plan.notes')}</h2>
    <div class="form">
      ${PLAN_NOTES.map(([k, label, ph]) => `
        <label>${label}<textarea rows="2" data-note="${k}" placeholder="${ph}">${esc(notes[k])}</textarea></label>`).join('')}
    </div>`;
}

// One hotline / program in a list
const resourceItem = r => `
  <li>
    <b>${r.name}</b>
    <p>${r.desc}</p>
    <div class="actions">
      ${r.call ? `<a class="btn ghost sm" href="${telLink(r.call)}">${t('help.callNum', { n: r.callLabel })}</a>` : ''}
      ${r.alt ? `<a class="btn ghost sm" href="${telLink(r.alt.call)}">${t('help.callNum', { n: r.alt.callLabel })}</a>` : ''}
      ${r.text ? `<a class="btn ghost sm" href="${smsLink(r.text.to, r.text.body)}">${r.text.label}</a>` : ''}
      ${r.web ? `<a class="btn link sm" href="${r.web}" target="_blank" rel="noopener noreferrer">${t('website')}</a>` : ''}
    </div>
  </li>`;

function localSection() {
  const near = localHelp();
  const items = [];
  if (near) {
    items.push(...near.resources.map(r => ({ ...r, desc: pick(r.desc) })));
    if (near.coalition) items.push({ name: near.coalition.name, desc: t('help.local.coalition.desc', { state: near.state }), web: near.coalition.web });
  }
  items.push({ name: t('help.local.211.name'), desc: t('help.local.211.desc'), call: '211', callLabel: '211' });
  items.push({ name: t('help.local.shelters.name'), desc: t('help.local.shelters.desc'), web: 'https://www.domesticshelters.org/' });
  return `
    <h2 class="section">${t('help.local')}${near?.area ? `: ${near.area}` : near?.state ? `: ${near.state}` : ''}</h2>
    ${near ? '' : `<p class="hint">${t('help.local.unknown')}</p>`}
    <ul class="hotlines">${items.map(resourceItem).join('')}</ul>`;
}

function helpView() {
  const d = data();
  const { RESOURCES, WARNING_SIGNS } = content();
  return `
    ${intro(t('tab.help'), t('help.lede'))}
    <h2 class="section">${t('help.people')}</h2>
    <p class="hint">${t('help.people.hint')}</p>
    ${d.contacts.length ? `<ul class="rows">${d.contacts.map(c => `
      <li>
        <button class="row-link" data-act="edit-contact" data-id="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.relation || c.phone)}${c.knowsCode ? `. ${t('help.knowsCode')}` : ''}</span></button>
        <a class="btn ghost sm" href="${telLink(c.phone)}">${t('call')}</a>
        <a class="btn ghost sm" href="${smsLink(c.phone)}">${t('text')}</a>
      </li>`).join('')}</ul>` : ''}
    <button class="btn ghost" data-act="new-contact">${t('help.addPerson')}</button>
    <div class="form spaced">
      <label>${t('help.message')}<textarea rows="2" data-alert-msg>${esc(d.alertMessage)}</textarea></label>
    </div>

    ${localSection()}

    <h2 class="section">${t('help.national')}</h2>
    <ul class="hotlines">${RESOURCES.map(resourceItem).join('')}</ul>
    <p class="hint">${t('help.traces')}</p>

    <h2 class="section">${t('help.signs')}</h2>
    <ul class="signs">${WARNING_SIGNS.map(s => `<li>${s}</li>`).join('')}</ul>
    <p class="hint">${t('help.signs.after', { hotline: hotlineLink() })}</p>`;
}

function settingsView() {
  const d = data();
  const s = d.settings;
  return `
    <h1>${t('settings.title')}</h1>
    <div class="form">
      <label>${t('settings.language')}
        <select data-setting="lang">
          ${LANGS.map(([code, name]) => `<option value="${code}" ${getLang() === code ? 'selected' : ''}>${name}</option>`).join('')}
        </select></label>
    </div>

    <h2 class="section">${t('settings.keep')}</h2>
    <ul class="status">
      <li class="${persisted === false ? 'bad' : persisted ? 'good' : ''}"><b>${t('settings.storage')}</b>
        ${persisted ? t('settings.storage.good') : persisted === false ? t('settings.storage.bad') : t('settings.storage.checking')}</li>
      ${IS_IOS ? `<li class="${IS_INSTALLED ? 'good' : 'bad'}"><b>${t('settings.home')}</b>
        ${IS_INSTALLED ? t('settings.home.good') : `${t('settings.home.bad')} ${t('warn.addHome')}`}</li>` : ''}
      <li class="${backupDue(d) ? 'bad' : d.lastBackup ? 'good' : ''}"><b>${t('settings.backup')}</b>
        ${d.lastBackup ? t('settings.backup.last', { date: fmt(d.lastBackup) }) : t('settings.backup.never')}</li>
    </ul>
    <p class="hint">${t('settings.keep.note')}</p>

    <h2 class="section">${t('settings.open')}</h2>
    <ol class="steps">
      <li>${t('settings.open.1')}</li>
      <li>${t('settings.open.2')}</li>
      <li>${t('settings.open.3')}</li>
    </ol>
    <div class="form">
      <label>${t('settings.autolock')}
        <select data-setting="autoLockMin">
          ${[1, 2, 5, 10].map(m => `<option value="${m}" ${s.autoLockMin === m ? 'selected' : ''}>${tn('minutes', m)}</option>`).join('')}
        </select></label>
    </div>

    <h2 class="section">${t('settings.code')}</h2>
    <form class="form" data-form="code">
      <label>${t('settings.code.new')}<input class="secret" name="a" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
      <label>${t('settings.code.again')}<input class="secret" name="b" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
      <button class="btn primary">${t('settings.code.btn')}</button>
    </form>

    <h2 class="section">${t('settings.backupTitle')}</h2>
    <p class="hint">${t('settings.backupHint')}</p>
    <div class="actions">
      <button class="btn ghost" data-act="export">${t('backup.download')}</button>
      <label class="btn ghost">${t('settings.restore')}<input type="file" accept=".json,application/json" hidden data-restore></label>
    </div>

    <h2 class="section">${t('settings.delete')}</h2>
    <p class="hint">${t('settings.delete.hint')}</p>
    <button class="btn danger" data-act="wipe">${t('settings.delete')}</button>`;
}

// ---------- Sheets (full-screen forms) ----------

function openSheet(html) {
  const s = root.querySelector('#sheet');
  s.innerHTML = html;
  s.hidden = false;
  s.scrollTop = 0;
  return s;
}

function closeSheet() {
  const s = root.querySelector('#sheet');
  s.hidden = true;
  s.innerHTML = '';
}

function sheetHead(title, saveAct) {
  return `<div class="sheet-head">
    <button class="btn link" data-act="sheet-cancel">${t('cancel')}</button>
    <h2>${title}</h2>
    ${saveAct ? `<button class="btn primary sm" data-act="${saveAct}">${t('save')}</button>` : '<span></span>'}
  </div>`;
}

// ---------- Edit history ----------

// The tracked fields of an entry, as it was at one point in time
const snapshot = e => ({ savedAt: e.updatedAt, ...Object.fromEntries(ENTRY_FIELDS.map(k => [k, e[k]])), photoCount: e.photos.length });

const sameValue = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const entryChanged = (a, b) => ENTRY_FIELDS.some(k => !sameValue(a[k], b[k])) || a.photos.length !== b.photos.length;

// How a field's value reads in the history list and report
function fieldText(k, v) {
  if (k === 'when') return fmt(v);
  if (k === 'types') return (v || []).map(typeLabel).join(', ');
  if (k === 'severity') return t('report.sev.val', { n: v });
  if (k === 'police' || k === 'medical') return v ? t('report.yes') : '—';
  return v || '—';
}

const FIELD_LABEL = {
  when: 'entry.when', types: 'report.types', what: 'report.what', severity: 'report.sev', injuries: 'report.injuries',
  where: 'report.where', witnesses: 'report.witnesses', police: 'entry.police', report: 'entry.report', medical: 'entry.medical',
};

// Each earlier version with just the fields that differ from the version after it, newest first
function historyItems(e) {
  const versions = [...(e.history || []), snapshot(e)];
  const out = [];
  for (let i = versions.length - 2; i >= 0; i--) {
    const v = versions[i], next = versions[i + 1];
    const changes = ENTRY_FIELDS.filter(k => !sameValue(v[k], next[k])).map(k => [t(FIELD_LABEL[k]), fieldText(k, v[k])]);
    if (v.photoCount !== next.photoCount) changes.push([t('entry.photos'), t('history.photos', { n: v.photoCount })]);
    out.push({ savedAt: v.savedAt, changes });
  }
  return out;
}

const historyList = e => `<ol class="history-list">${historyItems(e).map(h => `
  <li><b>${t('history.saved', { date: fmt(h.savedAt) })}</b>
    ${h.changes.length ? `<dl>${h.changes.map(([label, val]) => `<dt>${label}</dt><dd>${esc(val).replace(/\n/g, '<br>')}</dd>`).join('')}</dl>` : `<p>${t('history.nochange')}</p>`}
  </li>`).join('')}</ol>`;

// ---------- Entry editor ----------

function entryEditor(id) {
  const existing = id && data().incidents.find(i => i.id === id);
  const e = existing ? structuredClone(existing) : {
    id: V.newId(), when: toLocalInput(new Date()), types: [], what: '', severity: 3,
    injuries: '', where: '', witnesses: '', police: false, report: '', medical: false, photos: [],
  };
  e.types = e.types.map(typeId);
  draft = { e, isNew: !existing, added: [], removed: [] };
  openSheet(`
    ${sheetHead(existing ? t('entry.edit') : t('entry.new'), 'entry-save')}
    <form class="sheet-body form" data-form="entry" onsubmit="return false">
      <label>${t('entry.when')}<input type="datetime-local" name="when" value="${esc(e.when)}" required></label>
      <fieldset><legend>${t('entry.types')} <span>${t('entry.types.hint')}</span></legend>
        <div class="chips">${content().INCIDENT_TYPES.map(([tid, label]) => `
          <label class="chip"><input type="checkbox" name="types" value="${tid}" ${e.types.includes(tid) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
        </div>
      </fieldset>
      <label>${t('entry.what')}
        <textarea name="what" rows="7" placeholder="${t('entry.what.ph')}">${esc(e.what)}</textarea></label>
      <fieldset><legend>${t('entry.sev')} <span>${t('entry.sev.hint')}</span></legend>
        <div class="scale">${[1, 2, 3, 4, 5].map(n => `
          <label><input type="radio" name="severity" value="${n}" ${e.severity === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}
        </div>
      </fieldset>
      <label>${t('entry.hurt')}<textarea name="injuries" rows="2" placeholder="${t('entry.hurt.ph')}">${esc(e.injuries)}</textarea></label>
      <fieldset><legend>${t('entry.photos')}</legend>
        <div class="photos" id="photos"></div>
        <p class="hint">${t('entry.photos.hint')}</p>
      </fieldset>
      <label>${t('entry.where')}<input name="where" value="${esc(e.where)}"></label>
      <label>${t('entry.witnesses')}<input name="witnesses" value="${esc(e.witnesses)}" placeholder="${t('entry.witnesses.ph')}"></label>
      <label class="check"><input type="checkbox" name="police" ${e.police ? 'checked' : ''}><span>${t('entry.police')}</span></label>
      <label>${t('entry.report')}<input name="report" value="${esc(e.report)}"></label>
      <label class="check"><input type="checkbox" name="medical" ${e.medical ? 'checked' : ''}><span>${t('entry.medical')}</span></label>
      ${existing ? `
        <p class="hint">${e.updatedAt !== e.createdAt ? t('entry.written.changed', { date: fmt(e.createdAt), changed: fmt(e.updatedAt) }) : t('entry.written', { date: fmt(e.createdAt) })}</p>
        ${e.history?.length ? `<details class="history"><summary>${tn('history.versions', e.history.length)}</summary>
          <p class="hint">${t('history.hint')}</p>${historyList(e)}</details>` : ''}
        <button type="button" class="btn danger" data-act="entry-delete">${t('entry.delete')}</button>` : ''}
    </form>`);
  renderPhotos();
}

function renderPhotos() {
  const box = root.querySelector('#photos');
  box.innerHTML = draft.e.photos.map(id => `
    <div class="photo"><img data-blob="${id}" alt="" data-act="view">
      <button type="button" class="photo-x" data-act="photo-remove" data-id="${id}" aria-label="${t('entry.removePhoto')}">${icon('x')}</button></div>`).join('')
    + `<label class="photo-add">${icon('camera')}<span>${t('entry.takePhoto')}</span><input type="file" accept="image/*" capture="environment" hidden data-entry-photo></label>`
    + `<label class="photo-add">${icon('image')}<span>${t('entry.addPhoto')}</span><input type="file" accept="image/*" multiple hidden data-entry-photo></label>`;
  hydrate(box);
}

function readEntryForm() {
  const f = root.querySelector('form[data-form=entry]');
  const fd = new FormData(f);
  Object.assign(draft.e, {
    when: fd.get('when') || toLocalInput(new Date()),
    types: fd.getAll('types'),
    what: fd.get('what').trim(),
    severity: +(fd.get('severity') || 3),
    injuries: fd.get('injuries').trim(),
    where: fd.get('where').trim(),
    witnesses: fd.get('witnesses').trim(),
    police: fd.has('police'),
    report: fd.get('report').trim(),
    medical: fd.has('medical'),
  });
}

// Save the open entry. With `quiet`, skip empty new entries (used on Hide).
// Editing an existing entry keeps its previous version in `history`.
async function commitDraft(quiet = false) {
  if (!draft) return;
  const d = draft;
  if (root?.querySelector('form[data-form=entry]')) readEntryForm();
  draft = null;
  const e = d.e;
  if (quiet && d.isNew && !e.what && !e.types.length && !e.photos.length && !e.injuries) {
    await Promise.all(d.added.map(V.deleteBlob));
    return;
  }
  const now = new Date().toISOString();
  if (d.isNew) {
    e.createdAt = e.updatedAt = now;
    data().incidents.push(e);
  } else {
    const i = data().incidents.findIndex(x => x.id === e.id);
    const old = data().incidents[i];
    if (!entryChanged(old, e)) return;
    e.history = [...(old.history || []), snapshot(old)];
    e.updatedAt = now;
    data().incidents[i] = e;
  }
  await Promise.all(d.removed.map(V.deleteBlob));
  await V.save();
}

function quickNote() {
  openSheet(`
    ${sheetHead(t('quick.title'), 'quick-save')}
    <div class="sheet-body form">
      <p class="hint">${t('quick.hint')}</p>
      <textarea id="quick-text" rows="10" placeholder="${t('quick.ph')}"></textarea>
    </div>`);
  root.querySelector('#quick-text').focus();
}

function contactEditor(id) {
  const c = (id && data().contacts.find(x => x.id === id)) || { id: V.newId(), name: '', phone: '', relation: '', knowsCode: false, notes: '' };
  openSheet(`
    ${sheetHead(id ? t('contact.edit') : t('contact.add'), 'contact-save')}
    <form class="sheet-body form" data-form="contact" data-id="${c.id}" onsubmit="return false">
      <label>${t('contact.name')}<input name="name" value="${esc(c.name)}" required></label>
      <label>${t('contact.phone')}<input name="phone" type="tel" value="${esc(c.phone)}" required></label>
      <label>${t('contact.relation')}<input name="relation" value="${esc(c.relation)}" placeholder="${t('contact.relation.ph')}"></label>
      <label class="check"><input type="checkbox" name="knowsCode" ${c.knowsCode ? 'checked' : ''}><span>${t('contact.knowsCode')}</span></label>
      <label>${t('contact.notes')}<textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>
      ${id ? `<button type="button" class="btn danger" data-act="contact-delete" data-id="${c.id}">${t('contact.remove')}</button>` : ''}
    </form>`);
}

function alertSheet() {
  const cs = data().contacts;
  if (!cs.length) return contactEditor();
  openSheet(`
    ${sheetHead(t('alert.title'))}
    <div class="sheet-body">
      <p class="hint">${t('alert.hint')}</p>
      <blockquote class="quote">${esc(data().alertMessage)}</blockquote>
      <label class="check"><input type="checkbox" id="alert-loc" checked><span>${t('alert.loc')}</span></label>
      <ul class="rows">${cs.map(c => `
        <li><div><b>${esc(c.name)}</b><span>${esc(c.phone)}</span></div>
          <button class="btn primary sm" data-act="alert-send" data-id="${c.id}">${t('alert.send')}</button></li>`).join('')}
      </ul>
    </div>`);
}

function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => resolve(null), { timeout: 6000, enableHighAccuracy: true });
  });
}

// ---------- Printable report ----------

async function printReport() {
  const d = data();
  const p = d.person;
  const list = [...d.incidents].sort((a, b) => a.when.localeCompare(b.when));
  const row = (label, v) => v ? `<tr><th>${label}</th><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>` : '';
  const el = document.getElementById('print-report');
  el.innerHTML = `
    <h1>${t('report.title')}</h1>
    <p class="meta">${t('report.meta', { date: fmt(new Date()), entries: tn('entries', list.length) })}</p>
    ${Object.values(p).some(Boolean) ? `<h2>${t('report.person')}</h2>
      ${p.photo ? `<img class="subject" data-blob="${p.photo}" alt="">` : ''}
      <table>${content().PERSON_FIELDS.map(([k, label]) => row(label, p[k])).join('')}</table>` : ''}
    <h2>${t('report.incidents')}</h2>
    ${list.map((e, i) => `
      <article>
        <h3>${i + 1}. ${fmt(e.when)}</h3>
        <table>
          ${row(t('report.types'), e.types.map(typeLabel).join(', '))}
          ${row(t('report.sev'), t('report.sev.val', { n: e.severity }))}
          ${row(t('report.what'), e.what)}
          ${row(t('report.injuries'), e.injuries)}
          ${row(t('report.where'), e.where)}
          ${row(t('report.witnesses'), e.witnesses)}
          ${row(t('report.police'), e.police ? t('report.police.val') + (e.report ? t('report.police.num', { n: e.report }) : '') : '')}
          ${row(t('report.medical'), e.medical ? t('report.yes') : '')}
          ${row(t('report.written'), e.updatedAt !== e.createdAt ? t('entry.written.changed', { date: fmt(e.createdAt), changed: fmt(e.updatedAt) }) : t('entry.written', { date: fmt(e.createdAt) }))}
        </table>
        ${e.history?.length ? `<div class="report-history"><h4>${t('history.title')}</h4>${historyList(e)}</div>` : ''}
        ${e.photos.length ? `<div class="pics">${e.photos.map(id => `<img data-blob="${id}" alt="">`).join('')}</div>` : ''}
      </article>`).join('')}`;
  await hydrate(el);
  suspendLock = true; // the print dialog can briefly hide the page
  window.print();
  setTimeout(() => { suspendLock = false; }, 1000);
}

// ---------- Events ----------

async function onClick(ev) {
  const el = ev.target.closest('[data-tab],[data-act]');
  if (!el) return;
  if (el.dataset.tab) {
    // Switching sections from inside a form keeps what was written
    if (!root.querySelector('#sheet').hidden) {
      await commitDraft(true);
      closeSheet();
    }
    tab = el.dataset.tab;
    render();
    return;
  }
  const id = el.dataset.id;
  const d = data();
  switch (el.dataset.act) {
    case 'exit': opts.onExit(); break;
    case 'new-entry': entryEditor(); break;
    case 'edit-entry': entryEditor(id); break;
    case 'quick-note': quickNote(); break;
    case 'alert': alertSheet(); break;
    case 'new-contact': contactEditor(); break;
    case 'edit-contact': contactEditor(id); break;
    case 'report': printReport(); break;

    case 'sheet-cancel':
      if (draft) {
        await Promise.all(draft.added.map(V.deleteBlob));
        draft = null;
      }
      closeSheet();
      break;

    case 'entry-save':
      await commitDraft();
      closeSheet();
      render();
      toast(t('entry.saved'));
      break;

    case 'entry-delete':
      if (!confirmTap(el, t('entry.delete.confirm'))) break;
      d.incidents = d.incidents.filter(x => x.id !== draft.e.id);
      await Promise.all([...draft.e.photos, ...draft.removed].map(V.deleteBlob));
      draft = null;
      await V.save();
      closeSheet();
      render();
      toast(t('entry.deleted'));
      break;

    case 'photo-remove':
      draft.e.photos = draft.e.photos.filter(x => x !== id);
      if (draft.added.includes(id)) await V.deleteBlob(id); else draft.removed.push(id);
      renderPhotos();
      break;

    case 'view': {
      const v = root.querySelector('#viewer');
      v.innerHTML = `<img src="${ev.target.src}" alt=""><button class="hide-btn">${t('close')}</button>`;
      v.hidden = false;
      break;
    }
    case 'viewer-close':
      root.querySelector('#viewer').hidden = true;
      break;

    case 'quick-save': {
      const text = root.querySelector('#quick-text').value.trim();
      if (text) {
        const now = new Date().toISOString();
        d.incidents.push({
          id: V.newId(), when: toLocalInput(new Date()), types: [], what: text, severity: 3, injuries: '', where: '',
          witnesses: '', police: false, report: '', medical: false, photos: [], createdAt: now, updatedAt: now,
        });
        await V.save();
        toast(t('quick.saved'));
      }
      closeSheet();
      render();
      break;
    }

    case 'contact-save': {
      const f = root.querySelector('form[data-form=contact]');
      if (!f.reportValidity()) break;
      const fd = new FormData(f);
      const c = {
        id: f.dataset.id, name: fd.get('name').trim(), phone: fd.get('phone').trim(),
        relation: fd.get('relation').trim(), knowsCode: fd.has('knowsCode'), notes: fd.get('notes').trim(),
      };
      const i = d.contacts.findIndex(x => x.id === c.id);
      if (i >= 0) d.contacts[i] = c; else d.contacts.push(c);
      await V.save();
      closeSheet();
      render();
      toast(t('saved'));
      break;
    }

    case 'contact-delete':
      if (!confirmTap(el, t('contact.remove.confirm'))) break;
      d.contacts = d.contacts.filter(x => x.id !== id);
      await V.save();
      closeSheet();
      render();
      toast(t('contact.removed'));
      break;

    case 'alert-send': {
      const c = d.contacts.find(x => x.id === id);
      let msg = d.alertMessage;
      if (root.querySelector('#alert-loc')?.checked) {
        el.textContent = t('alert.finding');
        const pos = await getLocation();
        if (pos) msg += `\n${t('alert.where')} https://maps.google.com/?q=${pos.latitude.toFixed(5)},${pos.longitude.toFixed(5)}`;
      }
      location.href = smsLink(c.phone, msg);
      break;
    }

    case 'person-photo-remove':
      await V.deleteBlob(d.person.photo);
      delete d.person.photo;
      await V.save();
      render();
      break;

    case 'export': {
      const blob = new Blob([await V.exportBackup()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `breeze-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      d.lastBackup = new Date().toISOString();
      await V.save();
      toast(t('backup.done'));
      if (tab === 'home' || tab === 'settings') render();
      break;
    }

    case 'restore-go': {
      const code = root.querySelector('#restore-code').value;
      const file = root.querySelector('#sheet')._file;
      try {
        await V.importBackup(await file.text(), code);
        setLang(data().settings.lang || getLang());
        closeSheet();
        tab = 'home';
        render();
        toast(t('restore.done'));
      } catch (err) {
        root.querySelector('#restore-err').textContent = err.code === 'bad-code' ? t('restore.bad') : t('restore.notBreeze');
      }
      break;
    }

    case 'wipe':
      if (!confirmTap(el, t('settings.delete.confirm'))) break;
      await V.wipe();
      opts.onWiped();
      break;
  }
}

function onInput(ev) {
  const el = ev.target;
  const d = data();
  if (el.dataset.person) {
    d.person[el.dataset.person] = el.value;
    saveSoon();
  } else if (el.dataset.note) {
    d.plan.notes[el.dataset.note] = el.value;
    saveSoon();
  } else if ('alertMsg' in el.dataset) {
    d.alertMessage = el.value;
    saveSoon();
  }
}

async function onChange(ev) {
  const el = ev.target;
  const d = data();

  if (el.dataset.check) {
    d.plan.checks[el.dataset.check] = el.checked;
    saveSoon();
    const [done, total] = planCount();
    root.querySelector('#plan-count').textContent = t('plan.count', { done, total });
    root.querySelector('.progress .bar > i').style.width = `${(done / total) * 100}%`;
  } else if (el.dataset.setting === 'lang') {
    // Swap the default help message too, unless they've written their own
    const wasDefault = d.alertMessage === t('alert.default');
    d.settings.lang = setLang(el.value);
    if (wasDefault) d.alertMessage = t('alert.default');
    await V.save();
    render();
  } else if (el.dataset.setting) {
    d.settings[el.dataset.setting] = +el.value;
    saveSoon();
  } else if ('entryPhoto' in el.dataset) {
    for (const file of el.files) {
      try {
        const pid = await V.putBlob(await shrink(file));
        draft.e.photos.push(pid);
        draft.added.push(pid);
      } catch (err) { toast(err.message); }
    }
    renderPhotos();
  } else if ('personPhoto' in el.dataset && el.files[0]) {
    if (d.person.photo) await V.deleteBlob(d.person.photo);
    d.person.photo = await V.putBlob(await shrink(el.files[0]));
    await V.save();
    render();
  } else if ('restore' in el.dataset && el.files[0]) {
    const s = openSheet(`
      ${sheetHead(t('restore.title'))}
      <div class="sheet-body form">
        <p class="hint">${t('restore.hint')}</p>
        <label>${t('restore.code')}<input id="restore-code" class="secret" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <p class="err" id="restore-err"></p>
        <button class="btn primary" data-act="restore-go">${t('restore.btn')}</button>
      </div>`);
    s._file = el.files[0];
  }
}

// Change-code form is a real <form>, so handle submit separately.
document.addEventListener('submit', async ev => {
  if (!root || !ev.target.matches('form[data-form=code]')) return;
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const a = fd.get('a'), b = fd.get('b');
  if (a.length < 4) return toast(t('code.short'));
  if (a !== b) return toast(t('code.mismatch'));
  const btn = ev.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = t('settings.code.busy');
  await V.changeCode(a);
  ev.target.reset();
  btn.disabled = false;
  btn.textContent = t('settings.code.btn');
  toast(t('settings.code.done'));
});

// Keep the lock from firing while the camera / photo picker is open
// (here or on the setup screen), and clear it once the page is back.
document.addEventListener('click', ev => {
  if (ev.target.matches?.('input[type=file]')) suspendLock = true;
}, true);
document.addEventListener('cancel', ev => {
  if (ev.target.matches?.('input[type=file]')) suspendLock = false;
}, true);
document.addEventListener('change', ev => {
  if (ev.target.matches?.('input[type=file]')) suspendLock = false;
}, true);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(() => { suspendLock = false; }, 0);
});
