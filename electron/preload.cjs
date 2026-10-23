// Runs in a sandbox: the only bridge between the window and the app.
// Each function triggers one named, validated action in the main process.
const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('deskflow', {
  chooseFolder: () => call('folder:choose'),
  review: () => call('folder:review'),
  openFolder: () => call('folder:open'),
  apply: (planId) => call('plan:apply', planId),
  cancel: () => call('plan:cancel'),
  history: () => call('history:list'),
  undo: (opId) => call('history:undo', opId),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('apply:progress', listener);
    return () => ipcRenderer.removeListener('apply:progress', listener);
  },
});