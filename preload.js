const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cyberCow", {
  quitAndClearApp: () => ipcRenderer.send("app:quit-and-clear"),
  hideToBackground: () => ipcRenderer.send("app:hide-background"),
  beginWindowDrag: () => ipcRenderer.send("window:drag-begin"),
  moveWindowDrag: () => ipcRenderer.send("window:drag-move"),
  stopWindowDrag: () => ipcRenderer.send("window:drag-stop"),
  lockSystem: () => ipcRenderer.send("system:lock"),
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("desktop-shell");
});
