import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File as FSFile, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { uid } from './format';

/**
 * Local-first media store.
 *
 * Native: captures are copied out of the cache into the app documents folder so
 * they survive restarts. Web: captures are chunked into IndexedDB.
 * Nothing here ever talks to a network — there is no upload path in the app.
 */

export type MediaKind = 'photo' | 'video' | 'motion';

export type MediaItem = {
  id: string;
  kind: MediaKind;
  uri: string;
  createdAt: number;
  width?: number;
  height?: number;
  bytes?: number;
  durationMs?: number;
  filterId?: string | null;
  effectId?: string | null;
  sceneId?: string | null;
  lookName?: string;
  /** motion captures keep a small flipbook of frames */
  frames?: string[];
};

const META_KEY = '@aura/gallery/v1';
const DB_NAME = 'aura-media';
const STORE = 'frames';

/* ----------------------------------------------------------- web blob store */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('idb open failed'));
    });
  }
  return dbPromise;
}

async function idbPut(key: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('idb put failed'));
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error ?? new Error('idb get failed'));
  });
}

async function idbDelete(key: string) {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/* -------------------------------------------------------------- native store */

function mediaDir() {
  const dir = new Directory(Paths.document, 'aura-media');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extFor(kind: MediaKind) {
  return kind === 'photo' ? 'jpg' : kind === 'video' ? 'mp4' : 'jpg';
}

/* ------------------------------------------------------------------ public */

/** Persists a capture and returns the durable uri + size. */
export async function persistCapture(params: {
  sourceUri: string;
  kind: MediaKind;
  id?: string;
}): Promise<{ id: string; uri: string; bytes: number }> {
  const id = params.id ?? uid('cap');

  if (Platform.OS === 'web') {
    const blob = await uriToBlob(params.sourceUri);
    await idbPut(`${id}.${extFor(params.kind)}`, blob);
    return { id, uri: URL.createObjectURL(blob), bytes: blob.size };
  }

  const ext = extFor(params.kind);
  const src = new FSFile(params.sourceUri);
  const dst = new FSFile(mediaDir(), `${id}.${ext}`);
  if (dst.exists) dst.delete();
  await src.copy(dst);
  return { id, uri: dst.uri, bytes: dst.size ?? 0 };
}

export async function persistFrames(frames: string[], id: string): Promise<string[]> {
  if (Platform.OS === 'web') return frames;
  const out: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const src = new FSFile(frames[i]);
    const dst = new FSFile(mediaDir(), `${id}_f${i}.jpg`);
    if (dst.exists) dst.delete();
    await src.copy(dst);
    out.push(dst.uri);
  }
  return out;
}

export async function removeMedia(item: MediaItem) {
  try {
    if (item.frames?.length) {
      for (const f of item.frames) await removeUri(f);
    }
    await removeUri(item.uri);
  } catch {
    // best effort — metadata is still cleared by the caller
  }
}

async function removeUri(uri: string) {
  if (!uri) return;
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
    await idbDelete(uri.split('/').pop() ?? uri);
    return;
  }
  const f = new FSFile(uri);
  if (f.exists) f.delete();
}

/** Rebuilds blob urls after a web reload. */
export async function materializeWeb(items: MediaItem[]): Promise<MediaItem[]> {
  if (Platform.OS !== 'web') return items;
  const out: MediaItem[] = [];
  for (const item of items) {
    try {
      const blob = await idbGet(`${item.id}.${extFor(item.kind)}`);
      out.push({ ...item, uri: blob ? URL.createObjectURL(blob) : '' });
    } catch {
      out.push({ ...item, uri: '' });
    }
  }
  return out;
}

export async function loadGalleryMeta(): Promise<MediaItem[]> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MediaItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGalleryMeta(items: MediaItem[]) {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(items));
  } catch {
    // quota — drop the oldest entries and retry once
    try {
      await AsyncStorage.setItem(META_KEY, JSON.stringify(items.slice(0, 40)));
    } catch {
      /* give up silently */
    }
  }
}

/* --------------------------------------------------------------- exporting */

/** Saves a capture into the device camera roll (explicit user action only). */
export async function saveToCameraRoll(uri: string): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS === 'web') return { ok: false, reason: 'Downloads are used instead on web.' };
  try {
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) return { ok: false, reason: 'Photo library access was denied.' };
    await MediaLibrary.Asset.create(uri);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Could not save to library.' };
  }
}

/** Share sheet (native) or Web Share / download fallback. */
export async function shareMedia(uri: string, kind: MediaKind): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      const file = new File([blob], `aura-${Date.now()}.${kind === 'video' ? 'mp4' : 'jpg'}`, {
        type: blob.type || 'image/jpeg',
      });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: 'AURA capture' });
        return { ok: true };
      }
      if (nav.share) {
        await nav.share({ title: 'AURA capture' });
        return { ok: true };
      }
      downloadUri(uri);
      return { ok: true };
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { dialogTitle: 'Share capture' });
      return { ok: true };
    }
    return { ok: false, reason: 'Sharing is unavailable on this device.' };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, reason: 'Cancelled' };
    return { ok: false, reason: e instanceof Error ? e.message : 'Share failed.' };
  }
}

export async function downloadUri(uri: string) {
  if (Platform.OS !== 'web') return;
  const a = document.createElement('a');
  a.href = uri;
  a.download = `aura-${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('data:')) {
    const res = await fetch(uri);
    return res.blob();
  }
  const res = await fetch(uri);
  return res.blob();
}

export function storageUsed(items: MediaItem[]) {
  return items.reduce((acc, i) => acc + (i.bytes ?? 0), 0);
}
