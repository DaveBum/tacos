import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  publishChanges: (repoPath: string, commitMessage: string) => ipcRenderer.invoke('git-publish', { repoPath, commitMessage }),
  getTacosNganasPath: () => ipcRenderer.invoke('get-tacosnganas-path'),
  getAdminUIPath: () => ipcRenderer.invoke('get-admin-ui-path'),
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // For general IPC communication
  on: (channel: string, func: (...args: any[]) => void) => {
    const listener = (event: IpcRendererEvent, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, listener);
    // Return a function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  invoke: (channel: string, ...args: any[]): Promise<any> => {
    return ipcRenderer.invoke(channel, ...args);
  }
});

console.log('Preload script loaded successfully.');
