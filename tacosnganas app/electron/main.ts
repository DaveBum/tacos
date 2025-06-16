import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { startServer } from '../backend/server'; // Ensure this path is correct
import NodeGit from 'nodegit';

let mainWindow: BrowserWindow | null;
const IS_DEV = process.env.NODE_ENV !== 'production';
// PORT is defined in backend/server.ts, Electron main doesn't need to know it directly for loading URL
// as server.ts will resolve the port it starts on.

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, // Increased width for better admin UI experience
    height: 900, // Increased height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Path to preload script
      contextIsolation: true,
      nodeIntegration: false,
      devTools: IS_DEV,
    },
    icon: path.join(getProjectRootPath(), 'tacosnganas', 'images', 'ui', 'taco_Logo.png')
  });

  startServer(app).then((serverPort) => {
    console.log(`Backend server started on port ${serverPort}`);
    if (mainWindow) {
        // Always serve admin UI from the Express server
        const adminLoginUrl = `http://localhost:${serverPort}/admin-ui/login.html`;
        console.log(`Loading Admin UI from: ${adminLoginUrl}`);
        mainWindow.loadURL(adminLoginUrl).catch(err => {
            console.error(`Failed to load URL ${adminLoginUrl}: `, err);
            dialog.showErrorBox('Failed to load Admin UI', `Could not load ${adminLoginUrl}.\n${err.message}`);
            if (mainWindow) {
                 mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<h1>Error loading Admin UI</h1><p>Could not load ${adminLoginUrl}. Details: ${err.message}</p>`)}`);
            }
        });
        if (IS_DEV) {
            mainWindow.webContents.openDevTools();
        }
    }
  }).catch(err => {
    console.error('Failed to start backend server:', err);
    dialog.showErrorBox('Backend Server Error', `Failed to start backend server:\n${err.message}`);
    if (mainWindow) {
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<h1>Error starting backend server</h1><p>${err.message}</p>`)}`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { 
            label: 'Go to Dashboard', 
            click: () => {
                if(mainWindow && mainWindow.webContents) {
                    const currentURL = new URL(mainWindow.webContents.getURL());
                    mainWindow.webContents.loadURL(`${currentURL.protocol}//${currentURL.host}/admin-ui/index.html`);
                }
            }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
        label: 'Help',
        submenu: [
            {
                label: 'Learn More about Electron',
                click: async () => {
                    await shell.openExternal('https://electronjs.org')
                }
            },
            {
                label: 'View TACOnganas Site (Live - Placeholder)',
                click: async () => {
                    await shell.openExternal('https://davebum.github.io/tacos/')
                }
            }
        ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('git-publish', async (event, { repoPath, commitMessage }: { repoPath: string, commitMessage: string }) => {
  try {
    console.log(`Attempting to publish from repo: ${repoPath} with message: "${commitMessage}"`);
    const repo = await NodeGit.Repository.open(repoPath);
    console.log('Repository opened.');
    const index = await repo.refreshIndex();
    console.log('Index refreshed.');
    
    // Check for changes
    const statuses = await repo.getStatus();
    if (statuses.length === 0) {
        console.log('No changes to commit.');
        return { success: true, message: 'No changes to commit. Repository is up to date.' };
    }
    
    await index.addAll(); 
    console.log('All changes added to index.');
    await index.write(); 
    console.log('Index written.');
    const oid = await index.writeTree(); 
    console.log(`Tree written with OID: ${oid}`);
    
    const head = await NodeGit.Reference.nameToId(repo, 'HEAD');
    console.log(`HEAD OID: ${head}`);
    const parentCommit = await repo.getCommit(head);
    console.log('Parent commit retrieved.');

    const author = NodeGit.Signature.now('TACOnganas Admin App', 'admin@tacosnganas.com');
    const committer = NodeGit.Signature.now('TACOnganas Admin App', 'admin@tacosnganas.com');
    console.log('Signatures created.');

    const commitId = await repo.createCommit('HEAD', author, committer, commitMessage, oid, [parentCommit]);
    console.log(`Commit created: ${commitId}`);

    const remoteName = 'origin'; 
    const remote = await repo.getRemote(remoteName);
    console.log(`Remote '${remoteName}' retrieved.`);
    
    const currentBranchRef = await repo.getCurrentBranch();
    const currentBranchName = currentBranchRef.shorthand();
    console.log(`Current branch: ${currentBranchName}`);

    const refSpecs = [`refs/heads/${currentBranchName}:refs/heads/${currentBranchName}`];
    
    await remote.push(refSpecs, {
      callbacks: {
        credentials: function(urlRequested, userName) {
          console.warn(`Git credentials requested for ${urlRequested} with username ${userName}. Trying default credential helpers.`);
          return NodeGit.Cred.defaultNew(); 
        },
        transferProgress: (progress) => {
          console.log(`Push progress: ${progress.receivedObjects()} of ${progress.totalObjects()} objects, ${progress.receivedBytes()} bytes`);
          return 0; 
        }
      }
    });
    console.log('Push successful.');

    return { success: true, message: 'Changes published successfully!' };
  } catch (error: any) {
    console.error('Git publish error:', error, error.stack);
    return { success: false, message: `Failed to publish changes: ${error.message}` };
  }
});

function getProjectRootPath(): string {
    // If running in development (e.g., `electron .` from project root)
    // app.getAppPath() is typically the project root.
    // If packaged, app.getAppPath() is often `..../YourApp.app/Contents/Resources/app.asar` on macOS
    // or `....\resources\app.asar` on Windows.
    // We need the directory *containing* the asar file or the project root in dev.
    let appPath = app.getAppPath();
    if (appPath.endsWith('.asar')) {
        return path.dirname(appPath); // This should be the `Resources` folder or similar
    } 
    // For development, or if not in asar, appPath is usually correct
    return appPath; 
}


ipcMain.handle('get-tacosnganas-path', () => {
    const projectRoot = getProjectRootPath();
    // In a packaged app, 'tacosnganas' should be at the root of the packaged contents (e.g. alongside app.asar)
    // or inside a specific resources directory. For electron-builder, files listed in 'files' in package.json
    // are copied to the app root (e.g., next to the .exe on Windows, or inside Contents/Resources on Mac).
    // So, path.join(projectRoot, 'tacosnganas') should work if 'tacosnganas' is included in 'files'.
    const tacosNganasPath = path.resolve(projectRoot, 'tacosnganas');
    console.log(`[IPC get-tacosnganas-path] Project Root: ${projectRoot}, Resolved to: ${tacosNganasPath}`);
    return tacosNganasPath;
});

ipcMain.handle('get-admin-ui-path', () => {
    const projectRoot = getProjectRootPath();
    const adminUIPath = path.resolve(projectRoot, 'admin-ui');
    console.log(`[IPC get-admin-ui-path] Project Root: ${projectRoot}, Resolved to: ${adminUIPath}`);
    return adminUIPath;
});

ipcMain.handle('get-app-data-path', () => {
    const appDataPath = app.getPath('userData');
    console.log(`[IPC get-app-data-path] Resolved to: ${appDataPath}`);
    return appDataPath;
});

// Handle opening external links securely
if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Ensure only expected URLs are opened, or open all external links in the default browser
        shell.openExternal(url);
        return { action: 'deny' }; // Prevent Electron from opening a new window
    });
}
