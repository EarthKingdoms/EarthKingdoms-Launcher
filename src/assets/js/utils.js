/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { ipcRenderer } = require('electron')
const { Status } = require('minecraft-java-core')
const fs = require('fs');
const pkg = require('../package.json');

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto"
        theme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
    }
    let background
    let body = document.body;
    body.className = theme ? 'dark global' : 'light global';
    if (fs.existsSync(`${__dirname}/assets/images/background/easterEgg`) && Math.random() < 0.005) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/easterEgg`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `url(./assets/images/background/easterEgg/${Background})`;
    } else if (fs.existsSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`)) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${theme ? 'dark' : 'light'}/${Background})`;
    }
    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

async function changePanel(id) {
    console.log(`[changePanel] Changement vers le panneau: ${id}`);
    let panel = document.querySelector(`.${id}`);
    if (!panel) {
        console.error(`[changePanel] Panneau .${id} introuvable dans le DOM`);
        return;
    }
    
    let active = document.querySelector(`.active`);

    if (active && active !== panel) {
        const activeContainer = active.querySelector('.container');
        if (activeContainer) {
            activeContainer.style.opacity = 0;
            activeContainer.style.transform = "scale(0.95)";
            await new Promise(resolve => setTimeout(resolve, 400));
            activeContainer.style.visibility = "hidden";
        }
        active.classList.remove("active");
    }

    const panelContainer = panel.querySelector('.container');
    if (!panelContainer) {
        console.error(`[changePanel] Container introuvable dans le panneau .${id}`);
        return;
    }
    
    panel.classList.add("active");
    panelContainer.style.visibility = "visible";
    panelContainer.style.opacity = 1;
    setTimeout(() => {
        panelContainer.style.transform = "scale(1)";
    }, 100);
    console.log(`[changePanel] Panneau ${id} affiché avec succès`);
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path)
}

async function addAccount(data) {
    // Vérifier si l'élément .accounts-list existe dans le DOM
    const accountsList = document.querySelector('.accounts-list');
    if (!accountsList) {
        return { id: data.ID, skip: true };
    }
    
    // Vérifier si le compte est déjà affiché dans la liste
    let existingElement = document.getElementById(data.ID);
    if(existingElement) {
        return existingElement; // Le compte est déjà affiché
    }
    
    let skin = false;
    
    // Gérer les skins pour les comptes EarthKingdoms (via API)
    if (data?.meta?.type === 'EarthKingdoms') {
        let skinUrl = null;
        let fallbackUrl = `https://earthkingdoms-mc.fr/skins/${data.name}.png`;
        
        // Utiliser skin_url si disponible, sinon utiliser l'URL par pseudo
        if (data?.meta?.skin_url) {
            skinUrl = data.meta.skin_url;
            if (skinUrl.startsWith('/skins/')) {
                skinUrl = `https://earthkingdoms-mc.fr${skinUrl}`;
            } else if (!skinUrl.startsWith('http')) {
                // Si c'est juste un nom de fichier, utiliser le format par pseudo
                skinUrl = fallbackUrl;
            }
        } else {
            // Fallback : utiliser l'URL par pseudo (format SkinRestorer)
            skinUrl = fallbackUrl;
        }
        
        // Charger le skin avec un timeout pour éviter les blocages
        try {
            const skinPromise = new skin2D().creatHeadTexture(skinUrl);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            );
            skin = await Promise.race([skinPromise, timeoutPromise]);
        } catch (error) {
            // Si l'URL spécifique échoue, essayer le fallback
            if (data?.meta?.skin_url && skinUrl !== fallbackUrl) {
                try {
                    const fallbackPromise = new skin2D().creatHeadTexture(fallbackUrl);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 3000)
                    );
                    skin = await Promise.race([fallbackPromise, timeoutPromise]);
                } catch (fallbackError) {
                    skin = false;
                }
            } else {
                skin = false;
            }
        }
    } 
    // Gérer les skins pour les comptes Microsoft/Mojang (ancien système)
    else if (data?.profile?.skins[0]?.base64) {
        skin = await new skin2D().creatHeadTexture(data.profile.skins[0].base64);
    }
    
    let div = document.createElement("div");
    div.classList.add("account");
    div.id = data.ID;
    div.innerHTML = `
        <div class="profile-image" ${skin ? 'style="background-image: url(' + skin + ');"' : ''}></div>
        <div class="profile-infos">
            <div class="profile-pseudo">${data.name}</div>
            <div class="profile-uuid">${data.uuid}</div>
        </div>
        <div class="delete-profile" id="${data.ID}">
            <div class="icon-account-delete delete-profile-icon"></div>
        </div>
    `
    
    return accountsList.appendChild(div);
}

async function accountSelect(data) {
    if (!data || !data.ID) {
        console.error('[accountSelect] Données invalides');
        return;
    }
    
    let account = document.getElementById(`${data.ID}`);
    if (!account) {
        return;
    }
    
    let activeAccount = document.querySelector('.account-select')
    if (activeAccount) activeAccount.classList.toggle('account-select');
    account.classList.add('account-select');
    
    // Gérer les skins pour les comptes EarthKingdoms (via API)
    if (data?.meta?.type === 'EarthKingdoms') {
        let skinUrl = null;
        let fallbackUrl = `https://earthkingdoms-mc.fr/skins/${data.name}.png`;
        
        // Utiliser skin_url si disponible, sinon utiliser l'URL par pseudo
        if (data?.meta?.skin_url) {
            skinUrl = data.meta.skin_url;
            if (skinUrl.startsWith('/skins/')) {
                skinUrl = `https://earthkingdoms-mc.fr${skinUrl}`;
            } else if (!skinUrl.startsWith('http')) {
                // Si c'est juste un nom de fichier, utiliser le format par pseudo
                skinUrl = fallbackUrl;
            }
        } else {
            // Fallback : utiliser l'URL par pseudo (format SkinRestorer)
            skinUrl = fallbackUrl;
        }
        
        try {
            const headPromise = headplayer(skinUrl);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 3000)
            );
            await Promise.race([headPromise, timeoutPromise]);
        } catch (error) {
            // Si l'URL spécifique échoue, essayer le fallback
            if (data?.meta?.skin_url && skinUrl !== fallbackUrl) {
                try {
                    const fallbackPromise = headplayer(fallbackUrl);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 3000)
                    );
                    await Promise.race([fallbackPromise, timeoutPromise]);
                } catch (fallbackError) {
                    // Utiliser le skin par défaut
                    const defaultSkin = document.querySelector(".player-head");
                    if (defaultSkin) {
                        defaultSkin.style.backgroundImage = `url(./assets/images/default/steve.png)`;
                    }
                }
            } else {
                // Utiliser le skin par défaut
                const defaultSkin = document.querySelector(".player-head");
                if (defaultSkin) {
                    defaultSkin.style.backgroundImage = `url(./assets/images/default/steve.png)`;
                }
            }
        }
    }
    // Gérer les skins pour les comptes Microsoft/Mojang (ancien système)
    else if (data?.profile?.skins[0]?.base64) {
        try {
            await headplayer(data.profile.skins[0].base64);
        } catch (error) {
            // Erreur silencieuse
        }
    } else {
        // Skin par défaut si aucun skin disponible
        const defaultSkin = document.querySelector(".player-head");
        if (defaultSkin) {
            defaultSkin.style.backgroundImage = `url(./assets/images/default/steve.png)`;
        }
    }
}

async function headplayer(skinData) {
    // skinData peut être une URL HTTP ou un base64
    let skin = await new skin2D().creatHeadTexture(skinData);
    const playerHead = document.querySelector(".player-head");
    if (playerHead) {
        playerHead.style.backgroundImage = `url(${skin})`;
    }
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name');
    let statusServerElement = document.querySelector('.server-status-text');
    let playersOnline = document.querySelector('.status-player-count .player-count');
    // Log réduit pour éviter le spam

    async function updateStatus() {
        if(!opt) {
            statusServerElement.innerHTML = `Hors ligne - 0 ms`;
            playersOnline.innerHTML = '0';
            return;
        }

        let { ip, port, nameServer } = opt;
        nameServerElement.innerHTML = nameServer;
        
        // FORCER l'utilisation de earthkingdoms-mc.fr:25565 (ignorer l'IP/port de l'instance)
        const serverIp = 'earthkingdoms-mc.fr';
        const serverPort = 25565;
        
        console.log(`[Status] Vérification serveur: ${serverIp}:${serverPort} (forcé, ignoré: ${ip}:${port})`);
        
        let status = new Status(serverIp, serverPort);
        let statusServer = await status.getStatus().then(res => res).catch(err => {
            console.error(`[Status] Erreur détaillée:`, err);
            console.error(`[Status] Type d'erreur:`, typeof err);
            console.error(`[Status] Stack:`, err?.stack);
            return { error: true, message: err?.message || err?.toString() || 'Erreur de connexion' };
        });

        if(!statusServer.error) {
            statusServerElement.classList.remove('red');
            statusServerElement.classList.add('green');
            document.querySelector('.status-player-count').classList.remove('red');
            document.querySelector('.status-player-count').classList.add('green');
            statusServerElement.innerHTML = `En ligne - ${statusServer.ms} ms`;
            playersOnline.innerHTML = statusServer.playersConnect || 0;
        } else {
            console.warn(`[Status] Serveur hors ligne: ${statusServer.message || 'Erreur inconnue'}`);
            statusServerElement.classList.remove('green');
            statusServerElement.classList.add('red');
            document.querySelector('.status-player-count')?.classList.remove('green');
            document.querySelector('.status-player-count')?.classList.add('red');
            statusServerElement.innerHTML = `Hors ligne - 0 ms`;
            playersOnline.innerHTML = '0';
        }
    }
    await updateStatus();

    setInterval(() => {
        updateStatus();
    }, 15000);
}


/**
 * Génère un UUID déterministe basé sur le pseudo
 * Utilise exactement la même méthode que Java UUID.nameUUIDFromBytes()
 * Format: OfflinePlayer:<username>
 */
function generateDeterministicUUID(username) {
    const crypto = require('crypto');
    
    // Utilise MD5 avec le préfixe "OfflinePlayer:" comme Java
    const data = Buffer.from('OfflinePlayer:' + username, 'utf8');
    const hash = crypto.createHash('md5').update(data).digest();
    
    // Format en UUID v3 (même format que Java UUID.nameUUIDFromBytes)
    hash[6] = (hash[6] & 0x0f) | 0x30; // Version 3
    hash[8] = (hash[8] & 0x3f) | 0x80; // Variant
    
    // Convertir en string UUID
    const hex = hash.toString('hex');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus,
    generateDeterministicUUID as generateDeterministicUUID
}