import { ElectronAPI } from '@electron-toolkit/preload';

type LogLevel = 'info' | 'warn' | 'error';
type LogCategory = 'main' | 'sim' | 'render' | 'ui' | 'worker';

interface LogEntry {
  ts: string;
  source: string;
  category: string;
  level: string;
  msg: string;
  meta?: unknown;
}

interface LogPaths {
  human: string;
  jsonl: string;
  byCategory: Record<string, string>;
}

interface MercApi {
  log: (level: LogLevel, msg: string, meta?: unknown, category?: LogCategory) => void;
  recentErrors: () => Promise<LogEntry[]>;
  logPath: () => Promise<string>;
  logPaths: () => Promise<LogPaths>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: MercApi;
  }
}
