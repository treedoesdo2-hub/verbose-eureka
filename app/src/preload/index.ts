import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'main' | 'sim' | 'render' | 'ui' | 'worker';

const api = {
  log: (level: LogLevel, msg: string, meta?: unknown, category?: LogCategory): void => {
    ipcRenderer.send('log:write', { level, msg, meta, category });
  },
  recentErrors: (): Promise<
    Array<{
      ts: string;
      source: string;
      category: string;
      level: string;
      msg: string;
      meta?: unknown;
    }>
  > => ipcRenderer.invoke('log:recentErrors'),
  logPath: (): Promise<string> => ipcRenderer.invoke('log:path'),
  logPaths: (): Promise<{ human: string; jsonl: string; byCategory: Record<string, string> }> =>
    ipcRenderer.invoke('log:paths'),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
}
