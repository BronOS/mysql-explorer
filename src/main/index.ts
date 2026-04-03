import { app, BrowserWindow, globalShortcut, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { FileManager } from './file-manager';
import { ConnectionManager } from './connection-manager';
import { SchemaBrowser } from './schema-browser';
import { QueryExecutor } from './query-executor';
import { registerIpcHandlers } from './ipc-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const fileManager = new FileManager(app.getPath('userData'));
const connectionManager = new ConnectionManager(fileManager);
const schemaBrowser = new SchemaBrowser();
const queryExecutor = new QueryExecutor();

registerIpcHandlers(connectionManager, schemaBrowser, queryExecutor, fileManager);

// Window state persistence
const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState(): { x?: number; y?: number; width: number; height: number; maximized?: boolean } {
  try {
    const data = fs.readFileSync(windowStatePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { width: 1400, height: 900 };
  }
}

function saveWindowState(win: BrowserWindow): void {
  const maximized = win.isMaximized();
  const bounds = win.getNormalBounds();
  fs.writeFileSync(windowStatePath, JSON.stringify({ ...bounds, maximized }));
}

const createWindow = () => {
  const state = loadWindowState();

  const mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (state.maximized) mainWindow.maximize();

  mainWindow.on('close', () => saveWindowState(mainWindow));

  // Intercept Cmd+R / Ctrl+R / F5 — send refresh to renderer instead of reloading
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key === 'r' && (input.meta || input.control) && !input.shift) || input.key === 'F5') {
      event.preventDefault();
      mainWindow.webContents.send('app:refresh');
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  connectionManager.disconnectAll().finally(() => app.quit());
});

app.on('before-quit', () => {
  connectionManager.disconnectAll().catch(() => {});
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
