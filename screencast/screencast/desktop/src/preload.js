const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onServerReady: (cb) => ipcRenderer.on('server-ready', (_, data) => cb(data)),
  onPhoneConnected: (cb) => ipcRenderer.on('phone-connected', () => cb()),
  onPhoneDisconnected: (cb) => ipcRenderer.on('phone-disconnected', () => cb()),
  onServerError: (cb) => ipcRenderer.on('server-error', (_, msg) => cb(msg)),
  rendererReady: () => ipcRenderer.send('renderer-ready'),
});
