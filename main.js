const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const { execFile } = require("child_process");
const path = require("path");

const MIN_WINDOW_SIZE = { width: 340, height: 248 };
const MAX_WINDOW_SIZE = { width: 760, height: 760 };
const APP_ICON_ICO = path.join(__dirname, "assets", "app-icon.ico");
const APP_ICON_PNG = path.join(__dirname, "assets", "app-icon.png");

let dragState = null;
let mainWindow = null;
let tray = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.setAppUserModelId("com.cybercow.worker");

function createWindow() {
  const window = new BrowserWindow({
    width: 430,
    height: 270,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    maxWidth: MAX_WINDOW_SIZE.width,
    maxHeight: MAX_WINDOW_SIZE.height,
    resizable: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    title: "Cyber Cow Salary Calculator",
    icon: APP_ICON_ICO,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = window;
  window.loadFile(path.join(__dirname, "index.html"));
  window.setAlwaysOnTop(true, "floating");

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("second-instance", () => {
  showMainWindow();
});

ipcMain.on("app:quit-and-clear", () => {
  dragState = null;
  destroyTray();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  app.exit(0);
});

ipcMain.on("app:hide-background", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  dragState = null;
  ensureTray();
  window.setSkipTaskbar(true);
  window.hide();
});

ipcMain.on("window:drag-begin", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  dragState = {
    window,
    startBounds: window.getBounds(),
    startPoint: screen.getCursorScreenPoint(),
  };
});

ipcMain.on("window:drag-move", () => {
  if (!dragState || dragState.window.isDestroyed()) return;

  const point = screen.getCursorScreenPoint();
  const deltaX = point.x - dragState.startPoint.x;
  const deltaY = point.y - dragState.startPoint.y;

  dragState.window.setBounds(
    {
      x: Math.round(dragState.startBounds.x + deltaX),
      y: Math.round(dragState.startBounds.y + deltaY),
      width: dragState.startBounds.width,
      height: dragState.startBounds.height,
    },
    false,
  );
});

ipcMain.on("window:drag-stop", () => {
  dragState = null;
});

ipcMain.on("system:lock", () => {
  if (process.platform !== "win32") return;

  execFile("rundll32.exe", ["user32.dll,LockWorkStation"], (error) => {
    if (error) {
      console.error("Failed to lock workstation:", error);
    }
  });
});

app.on("window-all-closed", () => {
  dragState = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function showMainWindow() {
  const window = mainWindow || BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) return;

  window.setSkipTaskbar(false);
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

function ensureTray() {
  if (tray) return;

  tray = new Tray(createTrayImage());
  tray.setToolTip("赛博牛马薪资计算器");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示窗口", click: showMainWindow },
      { type: "separator" },
      { label: "退出并清除进程", click: quitAndClear },
    ]),
  );
  tray.on("click", showMainWindow);
  tray.on("double-click", showMainWindow);
}

function destroyTray() {
  if (!tray) return;

  tray.destroy();
  tray = null;
}

function quitAndClear() {
  dragState = null;
  destroyTray();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }
  app.exit(0);
}

function createTrayImage() {
  const icon = nativeImage.createFromPath(APP_ICON_ICO);
  if (!icon.isEmpty()) {
    return icon.resize({ width: 16, height: 16 });
  }

  const pngIcon = nativeImage.createFromPath(APP_ICON_PNG);
  if (!pngIcon.isEmpty()) {
    return pngIcon.resize({ width: 16, height: 16 });
  }

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">',
    '<rect width="32" height="32" rx="7" fill="#1f8a70"/>',
    '<circle cx="11" cy="13" r="3" fill="#ffffff"/>',
    '<path d="M8 19c4 4 12 4 16-2-4-6-12-6-16-2l-4-4v12z" fill="#ffffff"/>',
    '<circle cx="12" cy="13" r="1.2" fill="#17201c"/>',
    '</svg>',
  ].join("");

  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  return image.resize({ width: 16, height: 16 });
}
