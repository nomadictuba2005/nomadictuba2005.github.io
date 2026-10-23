// Encrypted local storage.
// Everything sensitive is encrypted with AES-GCM using a key derived from the
// user's secret code (PBKDF2). The code itself is never stored anywhere.
// The database is deliberately named like an ordinary cache.

const DB_NAME = 'breeze-cache';
const ITERATIONS = 250000;
const enc = new TextEncoder();
const dec = new TextDecoder();

let dbPromise = null;
let key = null;   // CryptoKey, only in memory while unlocked
let data = null;  // decrypted vault, only in memory while unlocked

function defaultData() {
  return {
    incidents: [],
    person: {},
    plan: { checks: {}, notes: {} },
    contacts: [],
    alertMessage: "I'm not safe right now. Please call me or get help.",
    settings: { autoLockMin: 5 },
  };
}

// ---------- IndexedDB helpers ----------

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('blobs');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  });
}

const get = (store, k) => run(store, 'readonly', s => s.get(k));
const put = (store, k, v) => run(store, 'readwrite', s => s.put(v, k));
const del = (store, k) => run(store, 'readwrite', s => s.delete(k));
const keys = store => run(store, 'readonly', s => s.getAllKeys());
const clear = store => run(store, 'readwrite', s => s.clear());

// ---------- Crypto helpers ----------

async function deriveKey(pass, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(k, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes));
  return { iv, ct };
}

async function decrypt(k, box) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, k, box.ct));
}

// Ask the browser not to clear this storage automatically when space runs low.
function keepStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- Public API ----------

export async function exists() {
  return !!(await get('kv', 'meta'));
}

export function isUnlocked() {
  return key !== null;
}

export function getData() {
  return data;
}

export { newId };

export async function create(pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  key = await deriveKey(pass, salt, ITERATIONS);
  data = defaultData();
  const verifier = await encrypt(key, enc.encode('breeze'));
  await put('kv', 'meta', { v: 1, salt, iterations: ITERATIONS, verifier });
  await save();
  keepStorage();
}

// Returns true if `pass` is the right code. Wrong codes simply fail to decrypt.
export async function unlock(pass) {
  if (!pass) return false;
  const meta = await get('kv', 'meta');
  if (!meta) return false;
  const k = await deriveKey(pass, meta.salt, meta.iterations);
  try {
    await decrypt(k, meta.verifier);
  } catch {
    return false;
  }
  key = k;
  const box = await get('kv', 'vault');
  data = defaultData();
  if (box) Object.assign(data, JSON.parse(dec.decode(await decrypt(k, box))));
  keepStorage();
  return true;
}

export function lock() {
  key = null;
  data = null;
}

export async function save() {
  if (!key) throw new Error('locked');
  await put('kv', 'vault', await encrypt(key, enc.encode(JSON.stringify(data))));
}

export async function putBlob(bytes) {
  const id = newId();
  await put('blobs', id, await encrypt(key, bytes));
  return id;
}

export async function getBlob(id) {
  const box = await get('blobs', id);
  return box ? decrypt(key, box) : null;
}

export async function deleteBlob(id) {
  await del('blobs', id);
}

export async function changeCode(newPass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newKey = await deriveKey(newPass, salt, ITERATIONS);
  for (const id of await keys('blobs')) {
    const plain = await getBlob(id);
    await put('blobs', id, await encrypt(newKey, plain));
  }
  const verifier = await encrypt(newKey, enc.encode('breeze'));
  await put('kv', 'meta', { v: 1, salt, iterations: ITERATIONS, verifier });
  key = newKey;
  await save();
}

export async function wipe() {
  lock();
  await clear('blobs');
  await clear('kv');
}

// ---------- Backup (stays encrypted) ----------

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

const packBox = b => ({ iv: b64(b.iv), ct: b64(b.ct) });
const unpackBox = b => ({ iv: unb64(b.iv), ct: unb64(b.ct) });

export async function exportBackup() {
  const meta = await get('kv', 'meta');
  const vault = await get('kv', 'vault');
  const blobs = {};
  for (const id of await keys('blobs')) blobs[id] = packBox(await get('blobs', id));
  return JSON.stringify({
    app: 'breeze',
    v: 1,
    meta: { v: meta.v, iterations: meta.iterations, salt: b64(meta.salt), verifier: packBox(meta.verifier) },
    vault: packBox(vault),
    blobs,
  });
}

// Replaces everything with the backup, then unlocks it with `pass`.
export async function importBackup(json, pass) {
  let b;
  try { b = JSON.parse(json); } catch { b = {}; }
  if (b.app !== 'breeze') throw Object.assign(new Error('Not a Breeze backup'), { code: 'not-breeze' });
  const meta = { v: b.meta.v, iterations: b.meta.iterations, salt: unb64(b.meta.salt), verifier: unpackBox(b.meta.verifier) };
  const k = await deriveKey(pass, meta.salt, meta.iterations);
  try {
    await decrypt(k, meta.verifier);
  } catch {
    throw Object.assign(new Error('That code does not match this backup'), { code: 'bad-code' });
  }
  await clear('blobs');
  await clear('kv');
  await put('kv', 'meta', meta);
  await put('kv', 'vault', unpackBox(b.vault));
  for (const [id, box] of Object.entries(b.blobs || {})) await put('blobs', id, unpackBox(box));
  return unlock(pass);
}
