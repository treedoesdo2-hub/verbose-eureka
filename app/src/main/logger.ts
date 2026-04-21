import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, ipcMain } from 'electron';

type Level = 'info' | 'warn' | 'error';
type Source = 'main' | 'renderer' | 'worker';
// Categories are the grep dimension I actually care about when diagnosing.
// Sim lives in the worker; the UI lives in the renderer; main is its own
// thing. New code can opt into a category explicitly; otherwise we fall
// back to a sensible default from the source.
export type Category = 'main' | 'sim' | 'render' | 'ui' | 'worker';

export type LogEntry = {
  ts: string;
  source: Source;
  category: Category;
  level: Level;
  msg: string;
  meta?: unknown;
};

const RING_CAPACITY = 32;
const errorRing: LogEntry[] = [];

let humanPath = '';
let jsonlPath = '';
const categoryPaths = new Map<Category, string>();
let prevHumanPath = '';
let writing = false;

function defaultCategory(source: Source): Category {
  if (source === 'worker') return 'sim';
  if (source === 'renderer') return 'render';
  return 'main';
}

function fmt(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function write(
  level: Level,
  source: Source,
  msg: string,
  meta?: unknown,
  category?: Category,
): void {
  if (!humanPath || writing) return;
  writing = true;
  try {
    const ts = new Date().toISOString();
    const cat = category ?? defaultCategory(source);
    const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
    appendFileSync(humanPath, `${ts} [${source}:${cat}:${level}] ${msg}${metaStr}\n`);

    const entry: LogEntry = { ts, source, category: cat, level, msg, meta };
    const jsonLine = `${JSON.stringify(entry)}\n`;
    appendFileSync(jsonlPath, jsonLine);
    const catPath = categoryPaths.get(cat);
    if (catPath) appendFileSync(catPath, jsonLine);

    if (level === 'error' || level === 'warn') {
      errorRing.push(entry);
      if (errorRing.length > RING_CAPACITY) errorRing.shift();
    }
  } catch {
    // swallow: if disk I/O is bad there's nothing useful to do here
  } finally {
    writing = false;
  }
}

export function recentErrors(): LogEntry[] {
  return [...errorRing];
}

export function currentLogPath(): string {
  return humanPath;
}

export function logPaths(): { human: string; jsonl: string; byCategory: Record<string, string> } {
  return {
    human: humanPath,
    jsonl: jsonlPath,
    byCategory: Object.fromEntries(categoryPaths),
  };
}

export function initLogger(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  humanPath = join(dir, 'merc-session.log');
  jsonlPath = join(dir, 'merc-session.jsonl');
  prevHumanPath = join(dir, 'merc-session-prev.log');

  for (const c of ['main', 'sim', 'render', 'ui', 'worker'] as Category[]) {
    categoryPaths.set(c, join(dir, `merc-${c}.jsonl`));
  }

  try {
    if (existsSync(humanPath)) renameSync(humanPath, prevHumanPath);
  } catch {
    // if rename fails we just overwrite
  }
  // Truncate all JSONL outputs at session start — append-only within a
  // session, replaced next session. Prior data lives in merc-session-prev.log.
  writeFileSync(jsonlPath, '');
  for (const p of categoryPaths.values()) writeFileSync(p, '');

  const header = [
    '='.repeat(64),
    'merc-autobattler session log',
    `started: ${new Date().toISOString()}`,
    `version: ${app.getVersion()}`,
    `platform: ${process.platform} ${process.arch}`,
    `node: ${process.versions.node}  electron: ${process.versions.electron}`,
    `chrome: ${process.versions.chrome}`,
    `prev log: ${prevHumanPath}`,
    `jsonl (all): ${jsonlPath}`,
    `jsonl (category): ${[...categoryPaths.values()].join(', ')}`,
    '='.repeat(64),
    '',
  ].join('\n');
  writeFileSync(humanPath, header);

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
    write(
      'error',
      'main',
      `unhandledRejection: ${typeof r === 'string' ? r : (r?.message ?? 'unknown')}`,
      {
        stack: typeof r === 'object' ? r?.stack : undefined,
      },
    );
  });

  ipcMain.on(
    'log:write',
    (
      _event,
      payload: { level: Level; msg: string; meta?: unknown; category?: Category; source?: Source },
    ) => {
      if (!payload || typeof payload.msg !== 'string') return;
      const lvl: Level =
        payload.level === 'warn' || payload.level === 'error' ? payload.level : 'info';
      const src: Source =
        payload.source === 'worker' || payload.source === 'main' ? payload.source : 'renderer';
      write(lvl, src, payload.msg, payload.meta, payload.category);
    },
  );

  ipcMain.handle('log:recentErrors', () => recentErrors());
  ipcMain.handle('log:path', () => humanPath);
  ipcMain.handle('log:paths', () => logPaths());

  origLog(`[log] session log: ${humanPath}`);
  origLog(`[log] session jsonl: ${jsonlPath}`);
  return humanPath;
}

export function logMain(
  level: Level,
  msg: string,
  meta?: unknown,
  category: Category = 'main',
): void {
  write(level, 'main', msg, meta, category);
}
