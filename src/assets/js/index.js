/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer, shell } = require('electron');
const pkg = require('../package.json');
const os = require('os');
import { config, database } from './utils.js';
const nodeFetch = require("node-fetch");



class Splash {
    constructor() {
        this.splash = document.querySelector(".splash");
        this.splashMessage = document.querySelector(".splash-message");
        this.splashAuthor = document.querySelector(".splash-author");
        this.message = document.querySelector(".message");
        this.progress = document.querySelector(".progress");
        this.version = document.querySelector(".version");
        document.addEventListener('DOMContentLoaded', async () => {
            let databaseLauncher = new database();
            let configClient = await databaseLauncher.readData('configClient');
            let theme = configClient?.launcher_config?.theme || "auto"
            let isDarkTheme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
            document.body.className = isDarkTheme ? 'dark global' : 'light global';
            if (process.platform === 'win32') ipcRenderer.send('update-window-progress-load')
            await this.startAnimation()
        });
    }

    async startAnimation() {
        let splashes = [
            { "message": "Bienvenue sur EarthKingdoms !", "author": "OrgeAlexj06" }
        ];
        let splash = splashes[Math.floor(Math.random() * splashes.length)];
        this.splashMessage.textContent = splash.message;
        this.splashAuthor.children[0].textContent = "@" + splash.author;
        await sleep(100);
        document.querySelector("#splash").style.display = "block";
        await sleep(500);
        this.splash.classList.add("opacity");
        await sleep(500);
        this.splash.classList.add("translate");
        this.splashMessage.classList.add("opacity");
        this.splashAuthor.classList.add("opacity");
        this.message.classList.add("opacity");
        this.version.classList.add("opacity");
        await sleep(1000);
        await this.checkUpdate();
    }

    async checkUpdate() {
        // En mode dev, passer directement à la vérification de maintenance
        if (process.env.NODE_ENV === 'dev') {
            console.log('[Update] Mode dev - Ignorer la vérification de mise à jour');
            return this.maintenanceCheck();
        }

        // Variable pour éviter les appels multiples à maintenanceCheck
        let maintenanceCalled = false;
        const callMaintenanceOnce = () => {
            if (!maintenanceCalled) {
                maintenanceCalled = true;
                this.maintenanceCheck();
            }
        };

        this.setStatus(`Recherche de mise à jour...`);

        ipcRenderer.invoke('update-app').then((result) => {
            console.log('[Update] Résultat du check:', result);
            // Si updateInfo est null, c'est que la vérification a été désactivée (build local/test)
            if (result && result.updateInfo === null) {
                console.log('[Update] Vérification désactivée par le processus principal - Passage à la maintenance');
                callMaintenanceOnce();
                return;
            }

            // Si on a un résultat mais pas d'updateInfo (cas rare)
            if (result && !result.updateInfo) {
                console.log('[Update] Aucune information de mise à jour reçue - Passage à la maintenance');
                callMaintenanceOnce();
                return;
            }
        }).catch(err => {
            // En cas d'erreur, continuer quand même (ne pas bloquer le launcher)
            console.warn('[Update] Erreur lors de l\'invocation de update-app:', err);
            callMaintenanceOnce();
        });
        ipcRenderer.on('updateAvailable', () => {
            this.setStatus(`Mise à jour disponible !`);
            if (os.platform() === 'win32') {
                this.toggleProgress();
                ipcRenderer.send('start-update');
            } else {
                return this.dowloadUpdate();
            }
        });

        ipcRenderer.on('error', (event, err) => {
            if (err) return this.shutdown(`${err.message}`);
        })

        ipcRenderer.on('download-progress', (event, progress) => {
            ipcRenderer.send('update-window-progress', { progress: progress.transferred, size: progress.total })
            this.setProgress(progress.transferred, progress.total);
        })

        ipcRenderer.on('update-not-available', () => {
            console.log('[Update] Le serveur indique qu\'aucune mise à jour n\'est disponible');
            callMaintenanceOnce();
        })
    }

    getLatestReleaseForOS(os, preferredFormat, asset) {
        return asset.filter(asset => {
            const name = asset.name.toLowerCase();
            const isOSMatch = name.includes(os);
            const isFormatMatch = name.endsWith(preferredFormat);
            return isOSMatch && isFormatMatch;
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    }

    async dowloadUpdate() {
        const repoURL = pkg.repository.url.replace("git+", "").replace(".git", "").replace("https://github.com/", "").split("/");
        const githubAPI = await nodeFetch('https://api.github.com').then(res => res.json()).catch(err => err);

        const githubAPIRepoURL = githubAPI.repository_url.replace("{owner}", repoURL[0]).replace("{repo}", repoURL[1]);
        const githubAPIRepo = await nodeFetch(githubAPIRepoURL).then(res => res.json()).catch(err => err);

        const releases_url = await nodeFetch(githubAPIRepo.releases_url.replace("{/id}", '')).then(res => res.json()).catch(err => err);
        const latestRelease = releases_url[0].assets;
        let latest;

        if (os.platform() === 'darwin') latest = this.getLatestReleaseForOS('mac', '.dmg', latestRelease);
        else if (os.platform() === 'linux') latest = this.getLatestReleaseForOS('linux', '.appimage', latestRelease);


        this.setStatus(`Mise à jour disponible !<br><div class="download-update">Télécharger</div>`);
        document.querySelector(".download-update").addEventListener("click", () => {
            shell.openExternal(latest.browser_download_url);
            return this.shutdown("Téléchargement en cours...");
        });
    }


    async maintenanceCheck() {
        // Ajouter un timeout pour éviter que le launcher reste bloqué
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 8000);
        });

        Promise.race([
            config.GetConfig(),
            timeoutPromise
        ]).then(res => {
            if (res.maintenance) return this.shutdown(res.maintenance_message);
            this.startLauncher();
        }).catch(e => {
            // En cas d'erreur ou timeout, continuer quand même (ne pas bloquer le launcher)
            console.warn('[Maintenance] Erreur ou timeout lors de la vérification de maintenance:', e.message || e.error?.message || 'Erreur inconnue');
            console.log('[Maintenance] Continuation du démarrage malgré l\'erreur');
            this.startLauncher();
        })
    }

    startLauncher() {
        this.setStatus(`Démarrage du launcher`);
        ipcRenderer.send('main-window-open');
        ipcRenderer.send('update-window-close');
    }

    shutdown(text) {
        this.setStatus(`${text}<br>Arrêt dans 5s`);
        let i = 4;
        setInterval(() => {
            this.setStatus(`${text}<br>Arrêt dans ${i--}s`);
            if (i < 0) ipcRenderer.send('update-window-close');
        }, 1000);
    }

    setStatus(text) {
        this.message.innerHTML = text;
    }

    toggleProgress() {
        if (this.progress.classList.toggle("show")) this.setProgress(0, 1);
    }

    setProgress(value, max) {
        this.progress.value = value;
        this.progress.max = max;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    ipcRenderer.on('app-version', (event, version) => {
        document.querySelector('.version').innerText = `Version : ${version}`;
    });
});

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73 || e.keyCode === 123) {
        ipcRenderer.send("update-window-dev-tools");
    }
})

new Splash();