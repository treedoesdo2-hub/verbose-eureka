// Wrapper around `electron-vite dev` that tees every line of stdout +
// stderr to a rolling log file. Solves the "terminal window closed, no
// log trail" debugging problem — the file survives crashes, window
// closures, and Windows console buffer limits.
//
// Output lives next to the app's userData session logs so both are in
// one directory when diagnosing a crash. Previous run is preserved as
// dev-prev.log for the same reason merc-session-prev.log exists.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(__dirname);

// Match the Electron app's userData dir so session.log + dev.log sit
// side-by-side. Windows: %APPDATA%/merc-autobattler.
const userData =
  process.platform === 'win32'
    ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'merc-autobattler')
    : process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'merc-autobattler')
      : join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'merc-autobattler');

if (!existsSync(userData)) mkdirSync(userData, { recursive: true });

const logPath = join(userData, 'dev.log');
const prevPath = join(userData, 'dev-prev.log');

if (existsSync(logPath)) {
  try {
    renameSync(logPath, prevPath);
  } catch {
    // If rename fails (locked file), just overwrite — the stream below
    // opens with 'w' flag.
  }
}

const logStream = createWriteStream(logPath, { flags: 'w' });
const header = [
  '='.repeat(64),
  `electron-vite dev — wrapper log`,
  `started: ${new Date().toISOString()}`,
  `node: ${process.version}  platform: ${process.platform} ${process.arch}`,
  `cwd: ${appRoot}`,
  `prev log: ${prevPath}`,
  '='.repeat(64),
  '',
].join('\n');
logStream.write(header);
process.stdout.write(header);

// Windows spawn of .cmd/.bat requires shell:true; otherwise Node 20+
// refuses with EINVAL. Cross-platform: pass the invocation as a string
// + shell:true so the platform's shell resolves the PATH lookup.
const child = spawn('npx electron-vite dev', {
  cwd: appRoot,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

function tee(stream, label) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    process[label === 'stderr' ? 'stderr' : 'stdout'].write(text);
    logStream.write(text);
  });
}

tee(child.stdout, 'stdout');
tee(child.stderr, 'stderr');

child.on('exit', (code, signal) => {
  const footer = `\n${'='.repeat(64)}\nexit: code=${code} signal=${signal} at ${new Date().toISOString()}\n${'='.repeat(64)}\n`;
  logStream.write(footer);
  process.stdout.write(footer);
  logStream.end(() => process.exit(code ?? (signal ? 1 : 0)));
});

// Propagate Ctrl+C so the tree shuts down cleanly.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
