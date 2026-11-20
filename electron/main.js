const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
if (app.isPackaged && !process.env.VAPOR_DATA_DIR) {
  process.env.VAPOR_DATA_DIR = path.join(app.getPath('userData'), 'data');
}
const { readSettings, saveSettings } = require('./settings');

let mainWindow = null;
let serverProcess = null;
let tray = null;
let quitting = false;
let serverStopped = false;
let settings = readSettings();
const serverUrl = 'http://127.0.0.1:48721';
const devUrl = process.env.VAPOR_DEV_URL;
if (!settings.gpuAcceleration) app.disableHardwareAcceleration();

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = fork(path.join(__dirname, '../server/index.js'), [], {
      env: { ...process.env, PORT: '48721', ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    const timeout = setTimeout(() => reject(new Error('Сервер Vapor не ответил за 30 секунд')), 30000);
    serverProcess.once('error', (err) => { clearTimeout(timeout); reject(err); });
    serverProcess.once('exit', (code) => {
      clearTimeout(timeout);
      serverStopped = true;
      if (!quitting) {
        reject(new Error(`Сервер Vapor завершился (код ${code}). Проверьте, свободен ли порт 48721.`));
        if (mainWindow) {
          dialog.showErrorBox('Vapor', 'Сервер остановлен. Перезапустите приложение.');
          app.quit();
        }
      }
    });
    serverProcess.on('message', (message) => {
      if (message?.type === 'ready') {
        clearTimeout(timeout);
        resolve();
      } else if (message?.type === 'window' && mainWindow) {
        if (message.action === 'minimize') mainWindow.minimize();
        if (message.action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        if (message.action === 'close') mainWindow.close();
      }
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 800,
    minWidth: 980,
    minHeight: 680,
    title: 'Vapor — Steam & Discord',
    show: false,
    backgroundColor: '#0b0c10',
    icon: path.join(__dirname, '../dist/vapor.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  const appUrl = devUrl || serverUrl;
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(appUrl).origin) {
      event.preventDefault();
      openExternal(url);
    }
  });
  mainWindow.on('close', (event) => {
    if (!quitting && settings.minimizeToTray && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(appUrl);
  if (!settings.startMinimized && !process.argv.includes('--hidden')) mainWindow.show();
}

function openExternal(url) {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(console.error);
}

function showWindow() {
  if (!mainWindow) return createWindow().catch(console.error);
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../dist/vapor.png')).resize({ width: 32, height: 32 }));
  tray.setToolTip('Vapor — Steam & Discord');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Открыть Vapor', click: showWindow },
    { type: 'separator' },
    { label: 'Завершить работу', click: () => app.quit() },
  ]));
  tray.on('double-click', showWindow);
}

function applyAutostart() {
  if (process.platform !== 'win32') return;
  const args = app.isPackaged ? ['--hidden'] : [path.join(__dirname, 'main.js'), '--hidden'];
  app.setLoginItemSettings({ openAtLogin: settings.autostart, path: process.execPath, args });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    if (!devUrl && !fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
      throw new Error('Интерфейс не собран. Выполните npm run build перед npm run app.');
    }
    ipcMain.handle('settings:get', () => settings);
    ipcMain.handle('settings:save', (event, next) => {
      const old = settings;
      settings = saveSettings(next);
      applyAutostart();
      return { settings, restartRequired: old.gpuAcceleration !== settings.gpuAcceleration };
    });
    await startServer();
    createTray();
    applyAutostart();
    await createWindow();
    app.on('activate', showWindow);
  }).catch((err) => {
    dialog.showErrorBox('Ошибка запуска Vapor', err.message);
    app.quit();
  });
}

app.on('before-quit', (event) => {
  quitting = true;
  if (serverProcess && !serverStopped) {
    event.preventDefault();
    if (serverProcess.connected) serverProcess.send({ type: 'shutdown' });
    const force = setTimeout(() => serverProcess?.kill(), 5000);
    serverProcess.once('exit', () => { clearTimeout(force); app.quit(); });
  }
});

app.on('window-all-closed', () => {
  if (!settings.minimizeToTray || !tray) app.quit();
});
