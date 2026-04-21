import { ElectronAPI } from '@electron-toolkit/preload';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  source: string;
  level: string;
  msg: string;
  meta?: unknown;
}

interface MercApi {
  log: (level: LogLevel, msg: string, meta?: unknown) => void;
  recentErrors: () => Promise<LogEntry[]>;
  logPath: () => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: MercApi;
  }
}
