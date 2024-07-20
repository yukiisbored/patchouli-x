import { app, BrowserWindow, shell, utilityProcess } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { loadSettings } from './settings'
import server from './server/main?modulePath'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    minWidth: 900,
    width: 900,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.setMinimumSize(768, 600)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.patchouli.patchouli-x')

  app.on('browser-window-created', (_, window) => {
    // Open DevTools with F12 and Ignore Ctrl+R on production
    optimizer.watchWindowShortcuts(window)
  })

  const settings = await loadSettings()
  const child = utilityProcess.fork(server, [JSON.stringify(settings)])

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', async () => {
    child.kill()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
