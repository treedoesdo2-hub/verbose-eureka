type Level = 'info' | 'warn' | 'error';

function fmt(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function send(level: Level, msg: string, meta?: unknown): void {
  try {
    window.api?.log?.(level, msg, meta);
  } catch {
    // preload missing / bridge down — fall back to console only
  }
}

export function initDiagnostics(): void {
  window.addEventListener('error', (e) => {
    send('error', `[window.onerror] ${e.message}`, {
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error instanceof Error ? e.error.stack : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string; stack?: string } | string | undefined;
    const msg = typeof reason === 'string' ? reason : (reason?.message ?? 'unknown');
    send('error', `unhandledRejection: ${msg}`, {
      stack: typeof reason === 'object' ? reason?.stack : undefined,
    });
  });

  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: unknown[]): void => {
    send('error', args.map(fmt).join(' '));
    origError(...args);
  };
  console.warn = (...args: unknown[]): void => {
    send('warn', args.map(fmt).join(' '));
    origWarn(...args);
  };

  send('info', 'renderer diagnostics initialized', {
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
}

export function log(level: Level, msg: string, meta?: unknown): void {
  send(level, msg, meta);
}
