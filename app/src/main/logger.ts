import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';

type Level = 'info' | 'warn' | 'error';
type Source = 'main' | 'renderer' | 'worker';

let logPath = '';
let prevPath = '';
let writing = false;

function fmt(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function write(level: Level, source: Source, msg: string, meta?: unknown): void {
  if (!logPath || writing) return;
  writing = true;
  try {
    const ts = new Date().toISOString();
    const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
    appendFileSync(logPath, `${ts} [${source}:${level}] ${msg}${metaStr}\n`);
  } catch {
    // swallow: if disk I/O is bad there's nothing useful to do here
  } finally {
    writing = false;
  }
}

export function initLogger(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  logPath = join(dir, 'merc-session.log');
  prevPath = join(dir, 'merc-session-prev.log');

  try {
    if (existsSync(logPath)) renameSync(logPath, prevPath);
  } catch {
    // if rename fails we just overwrite
  }

  const header = [
    '='.repeat(64),
    'merc-autobattler session log',
    `started: ${new Date().toISOString()}`,
    `version: ${app.getVersion()}`,
    `platform: ${process.platform} ${process.arch}`,
    `node: ${process.versions.node}  electron: ${process.versions.electron}`,
    `chrome: ${process.versions.chrome}`,
    `prev log: ${prevPath}`,
    '='.repeat(64),
    '',
  ].join('\n');
  writeFileSync(logPath, header);

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args: unknown[]): void => {
    write('info', 'main', args.map(fmt).join(' '));
    origLog(...args);
  };
  console.warn = (...args: unknown[]): void => {
    write('warn', 'main', args.map(fmt).join(' '));
    origWarn(...args);
  };
  console.error = (...args: unknown[]): void => {
    write('error', 'main', args.map(fmt).join(' '));
    origError(...args);
  };

  process.on('uncaughtException', (err) => {
    write('error', 'main', `uncaughtException: ${err.message}`, { stack: err.stack });
  });
  process.on('unhandledRejection', (reason) => {
    const r = reason as { message?: string; stack?: string } | string | undefined;
    write('error', 'main', `unhandledRejection: ${typeof r === 'string' ? r : r?.message ?? 'unknown'}`, {
      stack: typeof r === 'object' ? r?.stack : undefined,
    });
  });

  ipcMain.on('log:write', (_event, payload: { level: Level; msg: string; meta?: unknown }) => {
    if (!payload || typeof payload.msg !== 'string') return;
    const lvl: Level = payload.level === 'warn' || payload.level === 'error' ? payload.level : 'info';
    write(lvl, 'renderer', payload.msg, payload.meta);
  });

  origLog(`[log] session log: ${logPath}`);
  return logPath;
}

export function logMain(level: Level, msg: string, meta?: unknown): void {
  write(level, 'main', msg, meta);
}
