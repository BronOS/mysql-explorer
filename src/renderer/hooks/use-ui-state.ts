// In-memory cache of ui-state, synced to disk via IPC
let cache: Record<string, any> | null = null;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<Record<string, any>> {
  if (cache !== null) return cache;
  if (!loadPromise) {
    loadPromise = window.electronAPI.uiLoadState().then((data: any) => {
      cache = data || {};
    }).catch(() => { cache = {}; });
  }
  await loadPromise;
  return cache!;
}

function saveToIpc(): void {
  if (cache) {
    window.electronAPI?.uiSaveState(cache);
  }
}

export function getUiState(key: string): any {
  return cache?.[key];
}

export function setUiState(key: string, value: any): void {
  if (!cache) cache = {};
  cache[key] = value;
  saveToIpc();
}

export async function loadUiStateAsync(): Promise<Record<string, any>> {
  return ensureLoaded();
}
