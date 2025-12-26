/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const pkg = require("../../../../package.json");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
}

function createWindow() {
    destroyWindow();
    mainWindow = new BrowserWindow({
        title: pkg.productName,
        width: 1280,
        height: 720,
        minWidth: 1280,
        minHeight: 720,
        resizable: true,
        icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    
    // Détecter le bon chemin pour le fichier HTML
    const appPath = app.getAppPath();
    const isDev = process.env.NODE_ENV === 'dev' || appPath.includes('node_modules');
    
    // Essayer plusieurs chemins possibles
    const possiblePaths = [
        path.join(appPath, 'app', 'launcher.html'),      // Production (build)
        path.join(appPath, 'src', 'launcher.html'),      // Dev
        path.join(__dirname, '..', '..', '..', 'launcher.html'), // Relatif depuis le fichier JS
        path.join(appPath, 'resources', 'app', 'app', 'launcher.html'), // ASAR unpacked
        path.join(appPath, 'resources', 'app', 'src', 'launcher.html'), // ASAR unpacked dev
    ];
    
    console.log('[MainWindow] AppPath:', appPath);
    console.log('[MainWindow] IsDev:', isDev);
    
    let htmlPath = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            htmlPath = testPath;
            console.log('[MainWindow] Fichier HTML trouvé:', htmlPath);
            break;
        }
    }
    
    if (!htmlPath) {
        console.error('[MainWindow] ❌ Aucun fichier launcher.html trouvé dans les chemins suivants:');
        possiblePaths.forEach(p => console.error('  -', p));
        // Utiliser le premier chemin par défaut
        htmlPath = possiblePaths[0];
    }
    
    mainWindow.loadFile(htmlPath).catch(err => {
        console.error('[MainWindow] ❌ Erreur lors du chargement:', err);
        console.error('[MainWindow] Chemin tenté:', htmlPath);
    });
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: 'detach' })
            mainWindow.show()
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};