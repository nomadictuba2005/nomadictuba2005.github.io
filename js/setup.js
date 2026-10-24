// Notebook setup. Only reachable through the setup phrase or setup link, never shown on its own.
import * as V from './vault.js';
import { t, setLang, getLang, LANGS } from './i18n.js';

const el = () => document.getElementById('setup');

export function hideSetup() {
  el().hidden = true;
  el().innerHTML = '';
}

export function showSetup({ onReady }) {
  const box = el();
  box.innerHTML = `
    <div class="setup-page">
      <div class="setup-top">
        <select class="lang-switch" id="setup-lang" aria-label="Language">
          ${LANGS.map(([code, name]) => `<option value="${code}" ${getLang() === code ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
        <button class="hide-btn" id="setup-cancel">${t('top.hide')}</button>
      </div>
      <h1>${t('setup.title')}</h1>
      <p>${t('setup.intro')}</p>
      <ol class="steps">
        <li>${t('setup.step1')}</li>
        <li>${t('setup.step2')}</li>
        <li>${t('setup.step3')}</li>
      </ol>
      <form id="setup-form" class="form" autocomplete="off">
        <label>${t('setup.code')}
          <input class="secret" name="a" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
        <label>${t('setup.again')}
          <input class="secret" name="b" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
        <p class="hint">${t('setup.hint')}</p>
        <p class="err" id="setup-err"></p>
        <button class="btn primary full">${t('setup.create')}</button>
      </form>
      <p class="setup-alt">${t('setup.moving')}
        <label class="btn link">${t('setup.restore')}<input type="file" accept=".json,application/json" hidden id="setup-restore"></label></p>
    </div>`;
  box.hidden = false;
  const err = box.querySelector('#setup-err');

  box.querySelector('#setup-cancel').addEventListener('click', hideSetup);

  // Switching language redraws the screen in the new language
  box.querySelector('#setup-lang').addEventListener('change', e => {
    setLang(e.target.value);
    showSetup({ onReady });
  });

  box.querySelector('#setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const a = fd.get('a'), b = fd.get('b');
    if (a.length < 4) return (err.textContent = t('code.short'));
    if (a !== b) return (err.textContent = t('code.mismatch'));
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = t('setup.creating');
    await V.create(a);
    const d = V.getData();
    d.settings.lang = getLang();
    d.alertMessage = t('alert.default');
    await V.save();
    hideSetup();
    onReady(true);
  });

  box.querySelector('#setup-restore').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    // Swap in a fresh form so the "create" submit handler is gone
    const old = box.querySelector('#setup-form');
    const form = old.cloneNode(false);
    old.replaceWith(form);
    form.innerHTML = `
      <label>${t('setup.restoreCode')}
        <input class="secret" name="code" autocomplete="off" autocapitalize="off" spellcheck="false" required></label>
      <p class="err" id="setup-err"></p>
      <button class="btn primary full">${t('setup.restoreBtn')}</button>`;
    const err2 = form.querySelector('#setup-err');
    form.onsubmit = async ev => {
      ev.preventDefault();
      try {
        await V.importBackup(await file.text(), new FormData(form).get('code'));
        hideSetup();
        onReady(false);
      } catch (x) {
        err2.textContent = x.code === 'bad-code' ? t('restore.bad') : t('restore.notBreeze');
      }
    };
  });
}
