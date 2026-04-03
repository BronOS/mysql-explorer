// In-memory cache of ui-state, synced to disk via IPC
let cache: Record<string, any> | null = null;
let loadPromise: Promise<Record<string, any>> | null = null;

function ensureLoaded(): Promise<Record<string, any>> {
  if (cache !== null) return Promise.resolve(cache);
  if (!loadPromise) {
    if (typeof window === 'undefined' || !window.electronAPI?.uiLoadState) {
      cache = {};
      return Promise.resolve(cache);
    }
    loadPromise = window.electronAPI.uiLoadState().then((data: any) => {
      cache = data || {};
      return cache;
    }).catch(() => { cache = {}; return cache!; });
  }
  return loadPromise;
}

function saveToIpc(): void {
  if (cache && typeof window !== 'undefined' && window.electronAPI?.uiSaveState) {
    window.electronAPI.uiSaveState(cache);
  }
}

export function getUiState(key: string): any {
  return cache?.[key];
}

export async function setUiState(key: string, value: any): Promise<void> {
  const state = await ensureLoaded();
  state[key] = value;
  saveToIpc();
}

export async function loadUiStateAsync(): Promise<Record<string, any>> {
  return ensureLoaded();
}
