const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");

const { startLocalServer } = require("./local-server.cjs");

let appOrigin = "";
let localServer;
let mainWindow;
let startupError;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.earthworm.desktop");
  }

  try {
    const standaloneRoot = app.isPackaged
      ? path.join(process.resourcesPath, "standalone")
      : path.join(__dirname, "../standalone");
    localServer = await startLocalServer({
      dataFile: path.join(standaloneRoot, "data/course-data.json.gz"),
      stateFile: path.join(app.getPath("userData"), "standalone-state.json"),
      webRoot: path.join(standaloneRoot, "web"),
    });
    appOrigin = localServer.origin;
  } catch (error) {
    startupError = error;
    console.error("Unable to start standalone Earthworm", error);
  }

  createMenu();
  createWindow();
  await loadEarthworm();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      await loadEarthworm();
    }
  });
});

app.on("before-quit", () => {
  void localServer?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("earthworm:retry", async () => {
  await loadEarthworm();
  return mainWindow?.webContents.getURL();
});

ipcMain.handle("earthworm:open-browser", async () => {
  if (appOrigin) await shell.openExternal(`${appOrigin}/course-pack`);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "Earthworm",
    backgroundColor: "#f8fafc",
    icon: path.join(__dirname, "../build/icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isStandaloneUrl(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isStandaloneUrl(url) || url.startsWith("file:")) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, _description, url, isMainFrame) => {
      if (!isMainFrame || errorCode === -3 || !isStandaloneUrl(url)) return;
      void showOfflinePage();
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

async function loadEarthworm() {
  if (!mainWindow) return;
  if (!appOrigin || startupError) {
    await showOfflinePage();
    return;
  }
  await mainWindow.loadURL(`${appOrigin}/course-pack`);
}

async function showOfflinePage() {
  if (!mainWindow) return;
  await mainWindow.loadFile(path.join(__dirname, "offline.html"));
}

function isStandaloneUrl(value) {
  try {
    return Boolean(appOrigin) && new URL(value).origin === appOrigin;
  } catch {
    return false;
  }
}

function createMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        {
          label: "打开课程列表",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => void loadEarthworm(),
        },
        { role: "reload", label: "刷新" },
        { role: "forceReload", label: "强制刷新" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "切换全屏" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "在浏览器中打开本地应用",
          click: () => appOrigin && void shell.openExternal(`${appOrigin}/course-pack`),
        },
        {
          label: "重新载入本地应用",
          click: () => void loadEarthworm(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
