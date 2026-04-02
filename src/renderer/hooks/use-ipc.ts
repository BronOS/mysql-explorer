import type { ElectronAPI } from '../../preload/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function useIpc(): ElectronAPI {
  return window.electronAPI;
}
