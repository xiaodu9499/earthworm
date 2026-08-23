const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("earthwormDesktop", {
  retry: () => ipcRenderer.invoke("earthworm:retry"),
  openBrowser: () => ipcRenderer.invoke("earthworm:open-browser"),
  platform: process.platform,
});
