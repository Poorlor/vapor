const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vaporAPI', {
  platform: process.platform,
  version: '1.0.0',
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
});
