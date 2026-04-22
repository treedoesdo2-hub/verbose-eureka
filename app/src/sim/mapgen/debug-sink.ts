// COA-3 task #50 — buffered per-pipeline-run debug logger.
//
// Pipeline stages call sink.info / sink.warn / sink.error to record
// diagnostics (cluster counts, validator rejections, prune sweeps).
// A DebugSink is created per-runPipeline invocation and captured in the
// returned MapGenResult.diagnosticsLog for inspection by tests,
// integration shakedowns, and dev-tooling overlays.
//
// Kept dependency-free on purpose — the sink must be safe to instantiate
// in any test context without pulling in DOM / Node / Electron globals.

export type DebugLevel = 'info' | 'warn' | 'error';

export type DebugEntry = {
  readonly level: DebugLevel;
  readonly stage: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, number | string | boolean>>;
};

export class DebugSink {
  private entries: DebugEntry[] = [];
  private errorCount = 0;
  private warnCount = 0;

  info(stage: string, message: string, data?: DebugEntry['data']): void {
    this.entries.push({ level: 'info', stage, message, data });
  }

  warn(stage: string, message: string, data?: DebugEntry['data']): void {
    this.entries.push({ level: 'warn', stage, message, data });
    this.warnCount++;
  }

  error(stage: string, message: string, data?: DebugEntry['data']): void {
    this.entries.push({ level: 'error', stage, message, data });
    this.errorCount++;
  }

  get count(): number {
    return this.entries.length;
  }

  get warnings(): number {
    return this.warnCount;
  }

  get errors(): number {
    return this.errorCount;
  }

  snapshot(): readonly DebugEntry[] {
    return this.entries.slice();
  }

  // Summarize by stage — returns { stageName: countsByLevel }. Useful for
  // quickly seeing which stage emitted the most noise.
  byStage(): Record<string, { info: number; warn: number; error: number }> {
    const out: Record<string, { info: number; warn: number; error: number }> = {};
    for (const e of this.entries) {
      const bucket = out[e.stage] ?? { info: 0, warn: 0, error: 0 };
      bucket[e.level]++;
      out[e.stage] = bucket;
    }
    return out;
  }

  // Flatten every entry to a single human-readable line. Preserves insertion
  // order. Used by the reachability validator when the post-mortem dump is
  // routed into a Linear issue / console log.
  format(): string {
    return this.entries
      .map((e) => {
        const dataStr = e.data
          ? ' ' +
            Object.entries(e.data)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '';
        return `[${e.level.toUpperCase()}] ${e.stage}: ${e.message}${dataStr}`;
      })
      .join('\n');
  }
}

export function makeDebugSink(): DebugSink {
  return new DebugSink();
}
