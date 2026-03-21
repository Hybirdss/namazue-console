/**
 * Shared IndexedDB cache for large static JSON payloads.
 *
 * Single database "namazue-cache" with one object store per key.
 * Each entry stores { data, ts } and expires after a configurable TTL.
 */

const DB_NAME = 'namazue-cache';
const DB_VERSION = 1;
const STORE = 'kv';

// ── Low-level IDB helpers ────────────────────────────────────

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API ───────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  ts: number;
}

/**
 * Read from IDB cache. Returns null if missing, expired, or IDB unavailable.
 */
export async function cacheRead<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const db = await open();
    const entry = await idbGet<CacheEntry<T>>(db, key);
    db.close();
    if (entry && Date.now() - entry.ts < maxAgeMs) return entry.data;
  } catch { /* IDB unavailable */ }
  return null;
}

/**
 * Write to IDB cache. Fire-and-forget — errors are silently ignored.
 */
export async function cacheWrite<T>(key: string, data: T): Promise<void> {
  try {
    const db = await open();
    await idbPut(db, key, { data, ts: Date.now() } satisfies CacheEntry<T>);
    db.close();
  } catch { /* IDB unavailable */ }
}
