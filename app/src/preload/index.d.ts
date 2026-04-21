import { ElectronAPI } from '@electron-toolkit/preload';

type LogLevel = 'info' | 'warn' | 'error';

interface MercApi {
  log: (level: LogLevel, msg: string, meta?: unknown) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: MercApi;
  }
}
