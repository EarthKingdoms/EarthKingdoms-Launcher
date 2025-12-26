/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

"use strict";
const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");

const packageJson = require(path.join(app.getAppPath(), 'package.json'));

let dev = process.env.DEV_TOOL === 'open';
let updateWindow = undefined;

function getWindow() {
    return updateWindow;
}

function destroyWindow() {
    if(!updateWindow) return;
    updateWindow.close();
    updateWindow = undefined;
}

function createWindow() {
    destroyWindow();
    updateWindow = new BrowserWindow({
        title: "Mise à jour",
        width: 400,
        height: 500,
        resizable: false,
        icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
        frame: false,
        show: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    updateWindow.setMenuBarVisibility(false);
    
    // Détecter le bon chemin pour le fichier HTML
    const appPath = app.getAppPath();
    const fs = require("fs");
    const isDev = process.env.NODE_ENV === 'dev' || appPath.includes('node_modules');
    
    // Essayer plusieurs chemins possibles
    const possiblePaths = [
        path.join(appPath, 'app', 'index.html'),      // Production (build)
        path.join(appPath, 'src', 'index.html'),      // Dev
        path.join(__dirname, '..', '..', '..', 'index.html'), // Relatif depuis le fichier JS
        path.join(appPath, 'resources', 'app', 'app', 'index.html'), // ASAR unpacked
        path.join(appPath, 'resources', 'app', 'src', 'index.html'), // ASAR unpacked dev
    ];
    
    console.log('[UpdateWindow] AppPath:', appPath);
    console.log('[UpdateWindow] IsDev:', isDev);
    
    let htmlPath = null;
    for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
            htmlPath = testPath;
            console.log('[UpdateWindow] Fichier HTML trouvé:', htmlPath);
            break;
        }
    }
    
    if (!htmlPath) {
        console.error('[UpdateWindow] ❌ Aucun fichier index.html trouvé dans les chemins suivants:');
        possiblePaths.forEach(p => console.error('  -', p));
        // Utiliser le premier chemin par défaut
        htmlPath = possiblePaths[0];
    }
    
    updateWindow.loadFile(htmlPath).catch(err => {
        console.error('[UpdateWindow] ❌ Erreur lors du chargement:', err);
        console.error('[UpdateWindow] Chemin tenté:', htmlPath);
    });

    updateWindow.once('ready-to-show', () => {
        if(updateWindow) {
            if(dev) updateWindow.webContents.openDevTools({ mode: 'detach' });
            updateWindow.show();

            updateWindow.webContents.send('app-version', packageJson.version);
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};