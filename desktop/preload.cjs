const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopGame',Object.freeze({
  onUpdateReady(callback) {
    if(typeof callback!=='function')return;
    ipcRenderer.on('game-update-ready',()=>callback());
    ipcRenderer.invoke('game-update-status').then(pending=>{if(pending)callback();}).catch(()=>{});
  },
  applyUpdate() {ipcRenderer.send('game-apply-update');},
}));
