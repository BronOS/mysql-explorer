import type { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function useIpc(): ElectronAPI {
  return window.electronAPI;
}
