import { join } from 'node:path';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, crashReporter, ipcMain, shell } from 'electron';
import icon from '../../resources/icon.png?asset';
import { initLogger, logMain } from './logger';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    title: 'PAYROLL',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// Native crash dumps via Chromium's crashpad — captures SIGSEGV / V8 OOM
// / GPU process hangs that our JS-level logger can't see. Dumps land in
// userData/Crashpad/reports/ and survive across process death. Start
// before app.whenReady so early crashes are caught too.
crashReporter.start({ uploadToServer: false });

app.whenReady().then(() => {
  initLogger();

  // Renderer + child-process death events fire in the main process
  // *before* the dead process is reaped, giving us a chance to write the
  // reason to the session log. Without these handlers, a native crash in
  // the renderer leaves zero forensic trail.
  app.on('render-process-gone', (_event, webContents, details) => {
    logMain('error', `render-process-gone: ${details.reason}`, {
      exitCode: details.exitCode,
      url: webContents.getURL(),
    });
  });

  app.on('child-process-gone', (_event, details) => {
    logMain('error', `child-process-gone: ${details.type} / ${details.reason}`, {
      exitCode: details.exitCode,
      name: details.name ?? '',
      serviceName: details.serviceName ?? '',
    });
  });

  app.on('before-quit', () => {
    logMain('info', 'app before-quit');
  });

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
