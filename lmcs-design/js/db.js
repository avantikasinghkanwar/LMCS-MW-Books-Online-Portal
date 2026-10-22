// LMCS Design database - IndexedDB in this browser. Separate from LMCS Books (different name, no shared stores).
// Stores:
//   kv      - settings and the brand record ({ key, value })
//   assets  - logos, school photos and reference pictures ({ id, kind, name, blob, branch, tags, createdAt })
//   designs - generated designs ({ id, title, formatId, custom, branch, brief, spec, refIds, photoIds, thumb, status, createdAt, updatedAt })

const DB_NAME = 'lmcs-design';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('assets')) {
        const s = db.createObjectStore('assets', { keyPath: 'id' });
        s.createIndex('kind', 'kind');
      }
      if (!db.objectStoreNames.contains('designs')) {
        const s = db.createObjectStore('designs', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function getKV(key, fallback = null) {
  const row = await tx('kv', 'readonly', s => reqP(s.get(key)));
  return row ? row.value : fallback;
}
export const setKV = (key, value) => tx('kv', 'readwrite', s => reqP(s.put({ key, value })));

export const putAsset = (a) => tx('assets', 'readwrite', s => reqP(s.put(a)));
export const getAsset = (id) => tx('assets', 'readonly', s => reqP(s.get(id)));
export const deleteAsset = (id) => tx('assets', 'readwrite', s => reqP(s.delete(id)));
export async function listAssets(kind) {
  const all = await tx('assets', 'readonly', s => reqP(kind ? s.index('kind').getAll(kind) : s.getAll()));
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export const putDesign = (d) => tx('designs', 'readwrite', s => reqP(s.put(d)));
export const getDesign = (id) => tx('designs', 'readonly', s => reqP(s.get(id)));
export const deleteDesign = (id) => tx('designs', 'readwrite', s => reqP(s.delete(id)));
export async function listDesigns() {
  const all = await tx('designs', 'readonly', s => reqP(s.getAll()));
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

// ---- Backup: everything (minus the API key) as one JSON file, blobs as data URLs ----

const blobToDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

export async function exportBackup() {
  const kv = (await tx('kv', 'readonly', s => reqP(s.getAll()))).filter(r => r.key !== 'apiKey');
  const assets = await Promise.all((await listAssets()).map(async a => ({ ...a, blob: await blobToDataURL(a.blob) })));
  const designs = await listDesigns();
  return { app: 'lmcs-design', version: 1, exportedAt: new Date().toISOString(), kv, assets, designs };
}

export async function importBackup(data) {
  if (data?.app !== 'lmcs-design') throw new Error('This file is not an LMCS Design backup.');
  for (const row of data.kv || []) await setKV(row.key, row.value);
  for (const a of data.assets || []) {
    const blob = await (await fetch(a.blob)).blob();
    await putAsset({ ...a, blob });
  }
  for (const d of data.designs || []) await putDesign(d);
}
