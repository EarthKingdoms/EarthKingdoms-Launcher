/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import Login from './panels/login.js';
import Home from './panels/home.js';
import Settings from './panels/settings.js';

import { logger, config, changePanel, database, popup, setBackground, accountSelect, addAccount, pkg } from './utils.js';
import authAPI from './utils/auth-api.js';

const { ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');


// Polyfill fetch pour minecraft-java-core si nécessaire
if (typeof globalThis.fetch === 'undefined') {
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch;
}

class Launcher {
    async init() {
        this.initLog();
        console.log('Initializing Launcher...');
        this.shortcut()
        await setBackground()
        this.initFrame();
        // Récupérer la configuration avec gestion d'erreur améliorée
        this.config = await config.GetConfig().then(res => res).catch(err => {
            // Si erreur, utiliser une config par défaut
            console.warn('[Launcher] Erreur lors du chargement de la config, utilisation de la config par défaut');
            return {
                online: false,
                client_id: null,
                maintenance: false,
                maintenance_message: null,
                dataDirectory: 'EarthKingdoms-Launcher'
            };
        });

        // Vérifier si c'est une erreur (ancien format)
        if (this.config && this.config.error) {
            console.warn('[Launcher] Erreur de configuration détectée, utilisation de la config par défaut');
            this.config = {
                online: false,
                client_id: null,
                maintenance: false,
                maintenance_message: null,
                dataDirectory: 'EarthKingdoms-Launcher'
            };
        }
        this.db = new database();
        await this.initConfigClient();
        this.createPanels(Login, Home, Settings);
        await this.startLauncher();
    }

    initLog() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.shiftKey && e.keyCode === 73 || e.keyCode === 123) {
                ipcRenderer.send('main-window-dev-tools-close');
                ipcRenderer.send('main-window-dev-tools');
            }
        })
        new logger(pkg.name, '#7289da')
    }

    shortcut() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.keyCode === 87) {
                ipcRenderer.send('main-window-close');
            }
        })
    }

    errorConnect() {
        new popup().openPopup({
            title: this.config.error.code,
            content: this.config.error.message,
            color: 'red',
            exit: true,
            options: true
        });
    }

    initFrame() {
        console.log('Initializing Frame...')
        const platform = os.platform() === 'darwin' ? "darwin" : "other";

        document.querySelector(`.${platform} .frame`).classList.toggle('hide')

        document.querySelector(`.${platform} .frame #minimize`).addEventListener('click', () => {
            ipcRenderer.send('main-window-minimize');
        });

        let maximized = false;
        let maximize = document.querySelector(`.${platform} .frame #maximize`);
        maximize.addEventListener('click', () => {
            if (maximized) ipcRenderer.send('main-window-maximize')
            else ipcRenderer.send('main-window-maximize');
            maximized = !maximized
            maximize.classList.toggle('icon-maximize')
            maximize.classList.toggle('icon-restore-down')
        });

        document.querySelector(`.${platform} .frame #close`).addEventListener('click', () => {
            ipcRenderer.send('main-window-close');
        })
    }

    async initConfigClient() {
        console.log('[Launcher] Initializing Config Client...')
        let configClient = await this.db.readData('configClient')

        if (!configClient) {
            console.log('[Launcher] ⚠️ Aucune config client trouvée, création d\'une nouvelle config par défaut');
            await this.db.createData('configClient', {
                account_selected: null,
                instance_select: null,
                java_config: {
                    java_path: null,
                    java_memory: {
                        min: 4,
                        max: 6
                    }
                },
                game_config: {
                    screen_size: {
                        width: 1280,
                        height: 720
                    }
                },
                launcher_config: {
                    download_multi: 5,
                    theme: 'sombre',
                    closeLauncher: 'close-launcher',
                    intelEnabledMac: true,
                    gpu_preference: 'auto'
                }
            })
        }
    }

    createPanels(...panels) {
        let panelsElem = document.querySelector('.panels')
        for (let panel of panels) {
            console.log(`Initializing ${panel.name} Panel...`);
            let div = document.createElement('div');
            div.classList.add('panel', panel.id)
            div.innerHTML = fs.readFileSync(`${__dirname}/panels/${panel.id}.html`, 'utf8');
            panelsElem.appendChild(div);
            new panel().init(this.config);
        }
    }

    async startLauncher() {
        console.log('[Launcher] 🔍 Lecture des comptes...');
        let accounts = await this.db.readAllData('accounts')
        let configClient = await this.db.readData('configClient')
        let account_selected = configClient ? configClient.account_selected : null
        
        if (accounts.length === 0) {
            console.log('[Launcher] ⚠️ Aucun compte trouvé');
        } else {
            console.log(`[Launcher] ✅ ${accounts.length} compte(s) trouvé(s)`);
        }
        
        let popupRefresh = new popup();

        if (accounts?.length) {
            for (let account of accounts) {
                let account_ID = account.ID
                if (account.error) {
                    await this.db.deleteData('accounts', account_ID)
                    continue
                }

                // Gérer uniquement les comptes EarthKingdoms (via API)
                if (account.meta && account.meta.type === 'EarthKingdoms') {

                    // Vérifier si le token launcher est expiré
                    const token = account.access_token;
                    const tokenExpires = account.token_expires;

                    if (token && token !== 'offline' && !authAPI.isTokenExpired(tokenExpires)) {
                        // Token valide (non expiré) - vérifier avec l'API pour obtenir les infos utilisateur
                        // Note: La route /api/auth/launcher/verify est principalement pour le mod serveur,
                        // mais on peut l'utiliser ici pour vérifier et obtenir les infos
                        popupRefresh.openPopup({
                            title: 'Vérification',
                            content: `Vérification du compte ${account.name}...`,
                            color: 'var(--dark)',
                            background: false
                        });

                        try {
                            const verifyResult = await authAPI.verifyToken(token);

                            if (!verifyResult.error && verifyResult.valid) {
                                // Token valide - mettre à jour les données utilisateur
                                const updatedAccount = account;
                                updatedAccount.meta.username = verifyResult.username;
                                updatedAccount.meta.is_admin = verifyResult.is_admin || 0;
                                updatedAccount.name = verifyResult.username; // Utiliser le pseudo de l'API (source de vérité)

                                updatedAccount.ID = account_ID;
                                await this.db.updateData('accounts', updatedAccount, account_ID);
                                await addAccount(updatedAccount);
                                if (account_ID === account_selected) await accountSelect(updatedAccount);
                            } else {
                                // Token invalide - garder le compte quand même
                                account.ID = account_ID;
                                await addAccount(account);
                                if (account_ID === account_selected) await accountSelect(account);
                            }
                        } catch (error) {
                            console.error(`[Account] Erreur vérification:`, error);
                            account.ID = account_ID;
                            await addAccount(account);
                            if (account_ID === account_selected) await accountSelect(account);
                        } finally {
                            popupRefresh.closePopup();
                        }
                    } else {
                        // Token expiré ou absent - garder le compte sans vérification API
                        account.ID = account_ID;
                        try {
                            await addAccount(account);
                        } catch (error) {
                            console.error(`[Account] Erreur ajout compte:`, error);
                        }
                        if (account_ID === account_selected) {
                            try {
                                await accountSelect(account);
                            } catch (error) {
                                console.error(`[Account] Erreur sélection:`, error);
                            }
                        }
                    }
                } else if (account.meta && (account.meta.type === 'Xbox' || account.meta.type === 'Mojang' || account.meta.type === 'AZauth')) {
                    // COMPTES PREMIUM/CRACK BLOQUÉS - Supprimer les anciens comptes
                    console.warn(`[Account] ${account.name}: Type de compte bloqué (${account.meta.type}). Suppression...`);
                    await this.db.deleteData('accounts', account_ID);
                    if (account_ID === account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData('configClient', configClient);
                    }
                } else {
                    console.error(`[Account] ${account.name}: Account Type Not Found`);
                    await this.db.deleteData('accounts', account_ID);
                    if (account_ID === account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData('configClient', configClient);
                    }
                }
            }

            accounts = await this.db.readAllData('accounts')
            configClient = await this.db.readData('configClient')
            account_selected = configClient ? configClient.account_selected : null

            if (!account_selected && accounts.length > 0) {
                let firstAccount = accounts[0];
                if (firstAccount && firstAccount.ID) {
                    configClient.account_selected = firstAccount.ID
                    await this.db.updateData('configClient', configClient)
                    try {
                        await accountSelect(firstAccount);
                    } catch (error) {
                        console.error('[Launcher] Erreur sélection:', error);
                    }
                }
            } else if (account_selected) {
                let selectedAccount = accounts.find(acc => acc.ID === account_selected);
                if (selectedAccount) {
                    try {
                        await accountSelect(selectedAccount);
                    } catch (error) {
                        console.error('[Launcher] Erreur sélection:', error);
                    }
                }
            }

            if (!accounts.length) {
                config.account_selected = null
                await this.db.updateData('configClient', config);
                popupRefresh.closePopup()
                return changePanel("login");
            }

            popupRefresh.closePopup()
            await changePanel("home");
        } else {
            popupRefresh.closePopup()
            await changePanel('login');
        }
    }
}

new Launcher().init();