/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, ipcMain, nativeTheme } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater')

const path = require('path');
const fs = require('fs');
const pkg = require('../package.json');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let dev = process.env.NODE_ENV === 'dev';

// IMPORTANT: Définir le nom de l'application AVANT toute utilisation des chemins
// Cela évite que les fichiers se sauvegardent dans .undefined
const appName = (pkg.productName || pkg.name || 'EarthKingdoms-Launcher').replace(/\s+/g, '-');
app.setName(appName);
console.log(`[App] Nom de l'application défini: ${app.getName()}`);

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    // En production, toujours créer la fenêtre de mise à jour d'abord
    // En dev, créer directement la fenêtre principale
    if (dev) return MainWindow.createWindow()
    UpdateWindow.createWindow()
}).catch(err => {
    console.error('[App] ❌ Erreur lors du démarrage:', err);
    // En cas d'erreur, essayer de créer directement la fenêtre principale
    MainWindow.createWindow();
});

ipcMain.on('main-window-open', () => MainWindow.createWindow())
ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }))
ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools())
ipcMain.on('main-window-close', () => MainWindow.destroyWindow())
ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload())
ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size))
ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1))
ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2))
ipcMain.on('main-window-minimize', () => MainWindow.getWindow().minimize())

ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow())
ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }))
ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size))
ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1))
ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2))

ipcMain.on('restart-app', () => { app.relaunch(); app.exit(0); });

ipcMain.handle('path-user-data', () => app.getPath('userData'))
ipcMain.handle('appData', e => app.getPath('appData'))
ipcMain.handle('app-data-path', () => app.getPath('appData'))

ipcMain.on('main-window-maximize', () => {
    if (MainWindow.getWindow().isMaximized()) {
        MainWindow.getWindow().unmaximize();
    } else {
        MainWindow.getWindow().maximize();
    }
})

ipcMain.on('main-window-hide', () => MainWindow.getWindow().hide())
ipcMain.on('main-window-show', () => MainWindow.getWindow().show())

ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
})

ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return nativeTheme.shouldUseDarkColors;
})

app.on('window-all-closed', () => app.quit());

autoUpdater.autoDownload = false;

ipcMain.handle('update-app', async () => {
    // Désactiver la vérification de mise à jour en mode dev
    if (dev) {
        console.log('[Update] Mode dev - Vérification de mise à jour désactivée');
        return { updateInfo: null };
    }

    // Désactiver aussi si SKIP_UPDATE_CHECK est défini (pour les builds de test)
    if (process.env.SKIP_UPDATE_CHECK === 'true') {
        console.log('[Update] SKIP_UPDATE_CHECK activé - Vérification désactivée pour les tests');
        return { updateInfo: null };
    }

    // Désactiver aussi si on n'est pas dans un build packagé (dev local)
    if (!app.isPackaged) {
        console.log('[Update] Build non packagé détecté - Vérification désactivée');
        return { updateInfo: null };
    }

    return await new Promise(async (resolve, reject) => {
        autoUpdater.checkForUpdates().then(res => {
            resolve(res);
        }).catch(error => {
            // En cas d'erreur, ne pas bloquer le launcher, retourner null pour continuer
            console.warn('[Update] Erreur ignorée, continuation du démarrage');
            resolve({ updateInfo: null });
        })
    })
})

autoUpdater.on('update-available', (info) => {
    console.log('[Update] ✅ Mise à jour disponible:', info.version);
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('updateAvailable');
});

ipcMain.on('start-update', () => {
    console.log('[Update] 📥 Démarrage du téléchargement...');
    autoUpdater.downloadUpdate();
})

autoUpdater.on('update-not-available', (info) => {
    console.log('[Update] ❌ Pas de mise à jour disponible (Version actuelle:', pkg.version, ')');
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('[Update] 🚀 Mise à jour téléchargée, installation...');
    autoUpdater.quitAndInstall();
});

autoUpdater.on('download-progress', (progress) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('download-progress', progress);
})

autoUpdater.on('error', (err) => {
    console.error('[Update] ❌ Erreur auto-updater:', err);
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow) updateWindow.webContents.send('error', err);
});