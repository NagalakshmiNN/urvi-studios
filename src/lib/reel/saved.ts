// Per-product reel settings, kept in this browser (IndexedDB) so a product's
// shots, texts and hand touch-ups survive a page reload. Nothing is uploaded.

import type { Shot } from "./plan";

export type SavedReel = {
  shots: Shot[];
  title: string;
  tagline: string;
  details: string;
  caption: string;
  contact: string;
  bgHex: string;
  backdropId?: string;
  removeBg: boolean;
  /** Hand touch-up layer, with the photo size it belongs to. */
  manual: Uint8Array | null;
  w: number;
  h: number;
  savedAt: number;
};

const DB = "urvi-reels";
const STORE = "settings";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSaved(productId: string): Promise<SavedReel | null> {
  try {
    return ((await tx("readonly", (s) => s.get(productId))) as SavedReel | undefined) ?? null;
  } catch {
    return null; // private window, blocked storage — just behave as if nothing is saved
  }
}

export async function saveSaved(productId: string, data: SavedReel): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(data, productId));
  } catch {
    /* best effort */
  }
}
