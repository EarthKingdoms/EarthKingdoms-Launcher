/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'
import authAPI from '../utils/auth-api.js';

//const crypto = require('crypto');

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')
const nodeFetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const os = require('os')

// S'assurer que fetch est disponible globalement pour minecraft-java-core
if (typeof globalThis.fetch === 'undefined') {
    globalThis.fetch = nodeFetch;
}

class Home {
    static id = "home";

    async init(config) {
        this.config = config;
        this.db = new database();
        await this.news();
        this.socialLick();
        await this.instancesSelect();
        await this.displayUsername();
        this.startUsernameUpdateInterval();
        this.settingsButton();
    }

    startUsernameUpdateInterval() {
        this.usernameUpdateInterval = setInterval(async () => {
            await this.displayUsername();
        }, 100);
    }

    async displayUsername() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);

        if (auth && auth.name) {
            document.querySelector('.username-display').textContent = auth.name;
        } else {
            document.querySelector('.username-display').textContent = "";
        }
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        if (!newsElement) {
            console.warn('[Home] Élément .news-list introuvable');
            return;
        }

        let news = await config.getNews().then(res => {
            console.log('[Home] News récupérées:', res);
            return res;
        }).catch(err => {
            console.error('[Home] Erreur lors de la récupération des news:', err);
            return false;
        });

        if (news) {
            if (!news.length) {
                let blockNews = document.createElement('div');
                blockNews.classList.add('news-block');
                blockNews.innerHTML = `
                    <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Aucune news n'est actuellement disponible.</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Janvier</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Vous pourrez suivre ici toutes les news relatives au serveur.</p>
                        </div>
                    </div>`
                newsElement.appendChild(blockNews);
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date)
                    let blockNews = document.createElement('div');
                    blockNews.classList.add('news-block');
                    blockNews.innerHTML = `
                        <div class="news-header">
                            <img class="server-status-icon" src="assets/images/icon.png">
                            <div class="header-text">
                                <div class="title">${News.title}</div>
                            </div>
                            <div class="date">
                                <div class="day">${date.day}</div>
                                <div class="month">${date.month}</div>
                            </div>
                        </div>
                        <div class="news-content">
                            <div class="bbWrapper">
                                <p>${News.content.replace(/\n/g, '</br>')}</p>
                                <p class="news-author">Auteur - <span>${News.author}</span></p>
                            </div>
                        </div>`
                    newsElement.appendChild(blockNews);
                }
            }
        } else {
            let blockNews = document.createElement('div');
            blockNews.classList.add('news-block');
            blockNews.innerHTML = `
                <div class="news-header">
                        <img class="server-status-icon" src="assets/images/icon.png">
                        <div class="header-text">
                            <div class="title">Erreur</div>
                        </div>
                        <div class="date">
                            <div class="day">1</div>
                            <div class="month">Janvier</div>
                        </div>
                    </div>
                    <div class="news-content">
                        <div class="bbWrapper">
                            <p>Connexion impossible avec le serveur des news.</br>Merci de vérifier votre configuration.</p>
                        </div>
                    </div>`
            newsElement.appendChild(blockNews);
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let instancesList = await config.getInstanceList()

        // Vérifier si des instances sont disponibles
        if (!instancesList || instancesList.length === 0) {
            console.warn('[Home] Aucune instance disponible');
            // Désactiver le bouton de lancement si aucune instance
            let instanceBTN = document.querySelector('.play-instance');
            if (instanceBTN) {
                instanceBTN.style.opacity = '0.5';
                instanceBTN.style.pointerEvents = 'none';
                instanceBTN.title = 'Aucune instance disponible';
            }

            // Afficher un message à l'utilisateur
            let popupInfo = new popup();
            popupInfo.openPopup({
                title: 'Aucune instance',
                content: 'Aucune instance Minecraft n\'est disponible pour le moment. Veuillez réessayer plus tard.',
                color: 'orange',
                options: true
            });
            return;
        }

        let instanceSelect = instancesList.find(i => i.name === configClient?.instance_select) ? configClient?.instance_select : null

        let instanceBTN = document.querySelector('.play-instance')
        let instancePopup = document.querySelector('.instance-popup')
        let instancesListPopup = document.querySelector('.instances-List')
        let instanceCloseBTN = document.querySelector('.close-popup')

        if (instancesList.length === 1) {
            document.querySelector('.instance-select').style.display = 'none'
            instanceBTN.style.paddingRight = '0'
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive === false) || instancesList[0];
            if (newInstanceSelect) {
                let configClient = await this.db.readData('configClient')
                configClient.instance_select = newInstanceSelect.name
                instanceSelect = newInstanceSelect.name
                await this.db.updateData('configClient', configClient)
            }
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist === auth?.name)
                if (whitelist !== auth?.name) {
                    if (instance.name === instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive === false)
                        let configClient = await this.db.readData('configClient')
                        configClient.instance_select = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        // Surcharger l'IP/port si nécessaire
                        const statusConfig = newInstanceSelect.status || {};
                        if (!statusConfig.ip || statusConfig.ip.includes('192.168') || statusConfig.ip === 'localhost') {
                            statusConfig.ip = 'earthkingdoms-mc.fr';
                            statusConfig.port = 25565;
                        }
                        // S'assurer que nameServer est défini
                        if (!statusConfig.nameServer) {
                            statusConfig.nameServer = newInstanceSelect.name || 'EarthKingdoms';
                        }
                        setStatus(statusConfig)
                        await this.db.updateData('configClient', configClient)
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`)
            if (instance.name === instanceSelect) {
                // Surcharger l'IP/port si nécessaire
                const statusConfig = instance.status || {};
                if (!statusConfig.ip || statusConfig.ip.includes('192.168') || statusConfig.ip === 'localhost') {
                    statusConfig.ip = 'earthkingdoms-mc.fr';
                    statusConfig.port = 25565;
                }
                // S'assurer que nameServer est défini
                if (!statusConfig.nameServer) {
                    statusConfig.nameServer = instance.name || 'EarthKingdoms';
                }
                await setStatus(statusConfig);
            }
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id
                let activeInstanceSelect = document.querySelector('.active-instance')

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_select = newInstanceSelect
                await this.db.updateData('configClient', configClient)
                instanceSelect = instancesList.filter(i => i.name === newInstanceSelect)
                instancePopup.style.display = 'none'
                let instance = await config.getInstanceList()
                let options = instance.find(i => i.name === configClient.instance_select)
                // Surcharger l'IP/port si nécessaire
                const statusConfig = options.status || {};
                if (!statusConfig.ip || statusConfig.ip.includes('192.168') || statusConfig.ip === 'localhost') {
                    statusConfig.ip = 'earthkingdoms-mc.fr';
                    statusConfig.port = 25565;
                }
                // S'assurer que nameServer est défini
                if (!statusConfig.nameServer) {
                    statusConfig.nameServer = options.name || 'EarthKingdoms';
                }
                await setStatus(statusConfig)
            }
        })

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')
            let instanceSelect = configClient.instance_select
            let auth = await this.db.readData('accounts', configClient.account_selected)

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = ''
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                            if (whitelist === auth?.name) {
                                if (instance.name === instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                                }
                            }
                        })
                    } else {
                        if (instance.name === instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                        }
                    }
                }

                instancePopup.style.display = 'flex'
            }

            if (!e.target.classList.contains('instance-select')) {
                // Feedback visuel immédiat
                let playBtn = document.querySelector('.play-instance box-icon-element');
                if (playBtn) playBtn.innerHTML = 'Vérification...';

                await this.startGame();

                // Reset si ça fail (optionnel, startGame gère généralement le succès par changement de vue ou erreur)
                if (playBtn) playBtn.innerHTML = 'Jouer';
            }
        })

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')
    }

    async startGame() {
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instance = await config.getInstanceList()

        // Vérifier qu'il y a des instances disponibles
        if (!instance || instance.length === 0) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'Aucune instance disponible. Veuillez vérifier votre connexion au serveur.',
                color: 'red',
                options: true
            });
            return;
        }

        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name === configClient.instance_select)

        // Logs réduits - seulement en cas d'erreur
        if (!options || !options.name) {
            console.error('[Home] ❌ Instance invalide ou manquante');
            return;
        }

        // Vérifier que l'instance sélectionnée existe
        if (!options) {
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'Instance introuvable. Veuillez sélectionner une instance valide.',
                color: 'red',
                options: true
            });
            return;
        }

        // Récupérer et formater les fichiers de l'instance depuis l'API
        // S'assurer que l'URL pointe vers l'instance spécifique
        let filesUrl = options.url;
        if (!filesUrl || filesUrl.includes('instance=null')) {
            const pkg = require('../package.json');
            const baseUrl = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url;
            filesUrl = `${baseUrl}/launcher/files/?instance=${options.name}`;
        }
        try {
            const filesResponse = await nodeFetch(filesUrl);
            if (!filesResponse.ok) {
                console.error(`[Home] ❌ Erreur HTTP ${filesResponse.status} lors de la récupération des fichiers`);
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur',
                    content: `Impossible de récupérer les fichiers de l'instance (HTTP ${filesResponse.status}). Veuillez vérifier votre connexion.`,
                    color: 'red',
                    options: true
                });
                return;
            }

            const contentType = filesResponse.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.error(`[Home] ❌ La réponse n'est pas du JSON (Content-Type: ${contentType})`);
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur',
                    content: 'L\'API a retourné un format de données invalide. Veuillez contacter le support.',
                    color: 'red',
                    options: true
                });
                return;
            }

            const filesList = await filesResponse.json();
            console.log(`[Home] ${Array.isArray(filesList) ? filesList.length : '?'} fichier(s) récupéré(s) de l'API`);

            // Vérifier que filesList est un tableau (requis par minecraft-java-core)
            if (!Array.isArray(filesList)) {
                console.error('[Home] ❌ La réponse de l\'API n\'est pas un tableau:', typeof filesList);
                console.error('[Home] Type de données reçu:', filesList);
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur de format',
                    content: 'L\'API a retourné des données dans un format invalide (attendu: tableau). Veuillez contacter le support.',
                    color: 'red',
                    options: true
                });
                return;
            }

            // Filtrer les fichiers invalides
            const validFiles = filesList.filter(file => file && typeof file === 'object' && file.path);

            if (validFiles.length === 0) {
                console.error('[Home] ❌ Aucun fichier valide dans la liste !');
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur',
                    content: 'Aucun fichier valide trouvé dans la liste de l\'instance. Veuillez vérifier la configuration de l\'instance.',
                    color: 'red',
                    options: true
                });
                return;
            }

            // Logs réduits - seulement les statistiques essentielles
            const modsCount = validFiles.filter(file => file.path && typeof file.path === 'string' && file.path.startsWith('mods/')).length;
            console.log(`[Home] ${validFiles.length} fichiers (${modsCount} mods) prêts pour téléchargement`);

            // Stocker la liste des mods du serveur pour comparaison ultérieure
            // (extrait le nom du fichier depuis le chemin, ex: "mods/kubejs-1.20.1.jar" -> "kubejs-1.20.1.jar")
            const serverMods = validFiles
                .filter(file => file.path && typeof file.path === 'string' && file.path.startsWith('mods/'))
                .map(file => {
                    const pathParts = file.path.split('/');
                    return pathParts[pathParts.length - 1]; // Dernier élément = nom du fichier
                })
                .filter(name => name.endsWith('.jar'));

            // Vérifier si "mods" est ignoré (important)
            if (options.ignored && Array.isArray(options.ignored) && options.ignored.includes('mods')) {
                console.warn('[Home] ⚠️ ATTENTION: "mods" est dans ignored - les mods ne seront PAS téléchargés !');
            }
        } catch (error) {
            console.error('[Home] ❌ Erreur lors de la vérification des fichiers:', error);
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: `Erreur lors de la récupération des fichiers: ${error.message || 'Erreur inconnue'}. Veuillez vérifier votre connexion.`,
                color: 'red',
                options: true
            });
            return;
        }

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

        // Vérifier et injecter le token launcher pour les comptes EarthKingdoms
        let jvmArgs = options.jvm_args ? [...options.jvm_args] : [];

        if (authenticator?.meta?.type === 'EarthKingdoms') {
            try {
                // Utiliser la méthode centralisée pour obtenir un token valide
                // Gère automatiquement l'expiration, la fenêtre de grâce et le rafraîchissement
                console.log('[Home] Vérification de la session EarthKingdoms...');
                const { token, account: updatedAccount, updated } = await authAPI.getValidToken(authenticator);

                // Si le compte a été mis à jour (refresh token), sauvegarder en BDD
                if (updated) {
                    await this.db.updateData('accounts', updatedAccount);
                    console.log('[Home] ✅ Session mise à jour et sauvegardée.');
                } else {
                    console.log('[Home] ✅ Session valide.');
                }

                // Injecter le token validé dans les arguments Java
                jvmArgs.push(`-Dearthkingdoms.token=${token}`);
                jvmArgs.push(`-Dearthkingdoms.api.url=${authAPI.apiBaseUrl}/auth/launcher`);

            } catch (err) {
                console.error('[Home] ❌ Erreur Auth:', err.message);
                let popupError = new popup();
                popupError.openPopup({
                    title: 'Erreur d\'authentification',
                    content: err.message,
                    color: 'red',
                    options: true
                });

                // Si c'est une erreur critique (session expirée etc.), on déconnecte
                if (err.message.includes("trop longtemps") || err.message.includes("reconnecter")) {
                    await this.db.deleteData('accounts', authenticator.ID);
                    if (configClient.account_selected === authenticator.ID) {
                        configClient.account_selected = null;
                        await this.db.updateData('configClient', configClient);
                    }
                    changePanel('login');
                }

                // Arrêter le lancement
                return;
            }
        }

        // Vérifier et formater les données pour minecraft-java-core
        let ignoredList = [];
        if (options.ignored) {
            if (Array.isArray(options.ignored)) {
                ignoredList = [...options.ignored];
                if (ignoredList.includes('mods')) {
                    console.warn('[Home] ⚠️ "mods" est dans ignored - les mods ne seront PAS téléchargés !');
                }
            } else {
                ignoredList = [];
            }
        }

        let gameArgs = [];
        if (options.game_args) {
            if (Array.isArray(options.game_args)) {
                gameArgs = [...options.game_args];
            } else {
                console.warn('[Home] ⚠️ options.game_args n\'est pas un tableau, conversion...');
                gameArgs = [];
            }
        }

        // Vérifier que jvmArgs est un tableau
        if (!Array.isArray(jvmArgs)) {
            console.warn('[Home] ⚠️ jvmArgs n\'est pas un tableau, conversion...');
            jvmArgs = [];
        }

        // Vérifications silencieuses (logs réduits)

        // Vérifier que les propriétés critiques existent
        if (!options.url) {
            console.error('[Home] ❌ options.url est manquant');
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'L\'URL de l\'instance est manquante. Veuillez vérifier la configuration.',
                color: 'red',
                options: true
            });
            return;
        }

        if (!options.loadder || !options.loadder.minecraft_version) {
            console.error('[Home] ❌ Version Minecraft manquante');
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'La version Minecraft est manquante. Veuillez vérifier la configuration.',
                color: 'red',
                options: true
            });
            return;
        }

        // Calculer le chemin de base pour l'instance
        const basePath = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`;
        const instancePath = `${basePath}/instances/${options.name}`;

        // Ajouter des options Java pour les logs de crash (utile pour diagnostiquer les crashes)
        // Ces options permettent de générer des logs détaillés si Java crash
        // Doit être fait après la définition de instancePath
        jvmArgs.push('-XX:+HeapDumpOnOutOfMemoryError');
        jvmArgs.push(`-XX:HeapDumpPath=${path.join(instancePath, 'heap_dump.hprof')}`);
        jvmArgs.push('-XX:+ExitOnOutOfMemoryError');
        jvmArgs.push('-XX:+ShowCodeDetailsInExceptionMessages');

        // Résoudre le problème Kotlin Native avec Java 17
        // Java 17 bloque les packages avec "native" dans le nom (mot réservé)
        // Ces arguments permettent l'accès aux packages nécessaires pour Forge 1.20.1
        jvmArgs.push('--add-opens=java.base/java.lang=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.lang.reflect=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.util=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.util.concurrent=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.io=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.nio=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/sun.nio.ch=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.net=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.base/java.text=ALL-UNNAMED');
        jvmArgs.push('--add-opens=java.desktop/java.awt.font=ALL-UNNAMED');

        // Solution spécifique pour Kotlin Native avec Java 17
        // Le problème vient d'un mod qui utilise kotlin.native.concurrent
        // Java 17 refuse "native" comme nom de package (mot réservé)
        // Note: --illegal-access=permit a été supprimé dans Java 17.0
        // Les --add-opens ci-dessus devraient suffire pour Forge 1.20.1
        // Si l'erreur Kotlin Native persiste, il faudra identifier et mettre à jour le mod problématique

        // Utiliser l'URL corrigée pour les fichiers de l'instance
        let filesUrlForLaunch = options.url;
        if (!filesUrlForLaunch || filesUrlForLaunch.includes('instance=null')) {
            const pkg = require('../package.json');
            const baseUrl = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url;
            filesUrlForLaunch = `${baseUrl}/launcher/files/?instance=${options.name}`;
        }

        // Vérifier et logger la version utilisée AVANT de construire le loader
        // Logs réduits - seulement en cas d'erreur
        if (!options.loadder) {
            console.warn('[Home] ⚠️ options.loadder est manquant');
        }

        const minecraftVersion = options.loadder?.minecraft_version;
        const loadderVersion = options.loadder?.loadder_version;
        const loaderType = (options.loadder?.loadder_type || 'none').toLowerCase();

        // Logs de configuration réduits - seulement si manquant
        if (!minecraftVersion || !loadderVersion) {
            console.warn('[Home] ⚠️ Configuration loader incomplète:', { minecraftVersion, loadderVersion, loaderType });
        }

        // Vérifier aussi les variantes possibles de noms de propriétés
        if (!minecraftVersion) {
            console.warn('[Home] ⚠️ minecraft_version non trouvé, vérification des variantes...');
            console.log('[Home] options.loadder:', options.loadder);
            console.log('[Home] options.loadder.minecraft_version:', options.loadder?.minecraft_version);
            console.log('[Home] options.loadder.loadder:', options.loadder?.loadder);
            console.log('[Home] options.loader:', options.loader);
            console.log('[Home] Clés de options:', Object.keys(options));
            if (options.loadder) {
                console.log('[Home] Clés de options.loadder:', Object.keys(options.loadder));
            }
        }

        if (!minecraftVersion) {
            console.error('[Home] ❌ Version Minecraft manquante dans la configuration de l\'instance');
            console.error('[Home] Configuration complète de l\'instance:', JSON.stringify(options, null, 2));
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'La version Minecraft est manquante dans la configuration de l\'instance. Vérifiez la configuration sur le serveur.',
                color: 'red',
                options: true
            });
            return;
        }

        // Vérifier que ce n'est pas l'ancienne version 1.12.2
        if (minecraftVersion === '1.12.2' || minecraftVersion.includes('1.12')) {
            console.error('[Home] ❌ ATTENTION: Version 1.12.2 détectée ! La version attendue est 1.20.1');
            let popupError = new popup();
            popupError.openPopup({
                title: 'Version incorrecte',
                content: `La version configurée est ${minecraftVersion} au lieu de 1.20.1. Veuillez vérifier la configuration de l'instance sur le serveur.`,
                color: 'red',
                options: true
            });
            return;
        }

        // Construire la version du loader selon le type
        // Pour Forge, le format doit être: minecraft_version-loadder_version (ex: 1.20.1-47.4.10)
        // Pour Fabric/Quilt, utiliser directement loadder_version
        let loaderBuild = loadderVersion || 'latest';

        if (loaderType === 'forge' && minecraftVersion && loadderVersion) {
            // Combiner minecraft_version et loadder_version pour Forge
            loaderBuild = `${minecraftVersion}-${loadderVersion}`;
        }

        let opt = {
            url: filesUrlForLaunch,
            authenticator: authenticator,
            timeout: 10000,
            path: basePath,
            instance: options.name,
            version: minecraftVersion,
            // detached: true = le processus Minecraft est détaché du launcher (reste ouvert même si le launcher se ferme)
            // detached: false = le processus est attaché au launcher (se ferme si le launcher se ferme)
            // Pour que Minecraft reste ouvert, on doit mettre detached: true
            detached: true, // Toujours détacher pour que Minecraft reste ouvert indépendamment du launcher
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type || 'none',
                build: loaderBuild,
                enable: options.loadder.loadder_type == 'none' ? false : true
            },

            verify: options.verify !== undefined ? options.verify : false,

            ignored: ignoredList,

            java: {
                path: configClient.java_config.java_path,
                autoDownload: true,
            },

            JVM_ARGS: jvmArgs,
            GAME_ARGS: gameArgs,

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                // La mémoire est stockée en Go dans la config, convertir en Mo pour Java
                // Si max est 16, cela signifie 16 Go = 16384 Mo
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        // Logger la mémoire configurée pour vérification
        const memoryMax = configClient.java_config?.java_memory?.max || 0;
        const memoryMaxMo = memoryMax * 1024;
        const memoryMin = configClient.java_config?.java_memory?.min || 0;
        const memoryMinMo = memoryMin * 1024;
        console.log(`[Home] 💾 Mémoire configurée: ${memoryMin} Go (${memoryMinMo} Mo) min, ${memoryMax} Go (${memoryMaxMo} Mo) max`);
        console.log(`[Home] 💾 Arguments Java: -Xms${memoryMinMo}M -Xmx${memoryMaxMo}M`);

        // Vérifier que l'URL est valide
        if (!opt.url || typeof opt.url !== 'string') {
            console.error('[Home] ❌ URL invalide');
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur',
                content: 'L\'URL de l\'instance est invalide. Veuillez vérifier la configuration.',
                color: 'red',
                options: true
            });
            return;
        }

        // Logs de configuration pour debug
        console.log('[Home] Configuration de lancement:', {
            detached: opt.detached,
            closeLauncher: configClient.launcher_config.closeLauncher,
            instance: opt.instance,
            version: opt.version,
            loader: opt.loader
        });

        // Capturer les sorties stdout/stderr du processus Minecraft pour debug
        let minecraftOutput = [];
        let minecraftErrors = [];

        // Enregistrer l'heure de lancement pour mesurer la durée
        window.gameLaunchTime = Date.now();

        try {
            launch.Launch(opt);
            console.log("[Home] ✅ Lancement initié avec succès");
            // Logs réduits pour les arguments JVM (peuvent être longs)
            if (opt.JVM_ARGS && opt.JVM_ARGS.length > 0) {
                console.log(`[Home] Arguments JVM: ${opt.JVM_ARGS.length} argument(s) configuré(s)`);
                // Afficher seulement les arguments importants
                const importantArgs = opt.JVM_ARGS.filter(arg =>
                    arg.includes('earthkingdoms') ||
                    arg.includes('Xmx') ||
                    arg.includes('Xms')
                );
                if (importantArgs.length > 0) {
                    console.log('[Home] Arguments JVM importants:', importantArgs);
                }
            }

            // Écouter les sorties du processus si disponible
            if (launch.process) {
                if (launch.process.stdout) {
                    launch.process.stdout.on('data', (data) => {
                        const output = data.toString();
                        minecraftOutput.push(output);
                        // Logger les erreurs importantes
                        if (output.toLowerCase().includes('error') ||
                            output.toLowerCase().includes('exception') ||
                            output.toLowerCase().includes('crash') ||
                            output.toLowerCase().includes('fatal')) {
                            console.error('[Minecraft] ⚠️ Erreur détectée:', output.substring(0, 500));
                        }
                    });
                }
                if (launch.process.stderr) {
                    launch.process.stderr.on('data', (data) => {
                        const error = data.toString();
                        minecraftErrors.push(error);
                        console.error('[Minecraft] ⚠️ Erreur stderr:', error.substring(0, 500));
                    });
                }
            }
        } catch (error) {
            console.error('[Home] ❌ Erreur lors du lancement:', error);
            console.error('[Home] Stack:', error.stack);
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur de lancement',
                content: `Erreur lors du lancement du jeu: ${error.message || 'Erreur inconnue'}. Veuillez vérifier la configuration de l'instance.`,
                color: 'red',
                options: true
            });

            // Réafficher le bouton de lancement
            playInstanceBTN.style.display = "flex";
            infoStartingBOX.style.display = "none";
            progressBar.style.display = "none";
            ipcRenderer.send('main-window-progress-reset');
            return;
        }

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load')

        let lastSpeed = null;

        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            console.log(extract);
        });

        launch.on('progress', (progress, size, element) => {
            let progressPercent = ((progress / size) * 100).toFixed(0);
            infoStarting.innerHTML = `Téléchargement ${progressPercent}%`;

            if (lastSpeed !== null) {
                infoStarting.innerHTML += ` ( ${lastSpeed} Mo/s )`;
            }

            // Logs réduits - seulement pour les fichiers importants
            if (element && element.path && progressPercent % 25 === 0) {
                const fileName = element.path.split('/').pop();
                if (fileName.endsWith('.jar') && fileName.includes('mods')) {
                    console.log(`[Home] 📥 ${fileName} (${progressPercent}%)`);
                }
            }

            progressBar.value = progress;
            progressBar.max = size;

            if (progressPercent == 100) {
                lastSpeed = null;
            }
        });

        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Vérification ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('estimated', (time) => {
            let hours = Math.floor(time / 3600);
            let minutes = Math.floor((time - hours * 3600) / 60);
            let seconds = Math.floor(time - hours * 3600 - minutes * 60);
            console.log(`${hours}h ${minutes}m ${seconds}s`);
        });

        launch.on('speed', (speed) => {
            if (speed) {
                let speedInMo = (speed / 1024 / 1024).toFixed(2);

                if (lastSpeed !== speedInMo) {
                    lastSpeed = speedInMo;
                }
            }
        });

        launch.on('patch', patch => {
            console.log(patch);
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Mise à jour en cours...`
        });

        let modsChecked = false; // Flag pour éviter les vérifications répétées
        let dataEventCount = 0; // Compteur pour éviter les logs répétitifs

        launch.on('data', (e) => {
            dataEventCount++;

            // Capturer toutes les sorties pour diagnostic
            const dataStr = String(e);
            minecraftOutput.push(dataStr);

            // TOUJOURS logger le contenu brut pour voir ce qui se passe réellement
            // (même si ça fait beaucoup de logs, c'est nécessaire pour diagnostiquer)
            if (dataStr.length > 0) {
                // Logger toutes les sorties non-vides pour voir ce qui se passe
                const trimmed = dataStr.trim();
                if (trimmed.length > 0) {
                    console.log(`[Minecraft] [RAW] ${trimmed.substring(0, 200)}`);
                } else {
                    // Chaîne avec caractères invisibles
                    console.log(`[Minecraft] [RAW] (invisible, longueur: ${dataStr.length})`, JSON.stringify(dataStr.substring(0, 50)));
                }
            }

            // Vérifier les problèmes d'authentification dans les sorties
            const dataLower = dataStr.toLowerCase();
            if (dataLower.includes('invalid session') ||
                dataLower.includes('authentication') ||
                dataLower.includes('token') ||
                dataLower.includes('access denied') ||
                dataLower.includes('unauthorized')) {
                // Afficher le contenu complet même s'il semble vide
                if (dataStr.trim().length === 0) {
                    // Si la chaîne est vide, afficher la représentation complète
                    console.error('[Minecraft] ⚠️ Problème d\'authentification détecté (message vide)');
                    console.error('[Minecraft] ⚠️ Longueur:', dataStr.length, 'caractères');
                    if (dataStr.length > 0) {
                        console.error('[Minecraft] ⚠️ Représentation JSON:', JSON.stringify(dataStr));
                        console.error('[Minecraft] ⚠️ Caractères (hex):', Array.from(dataStr).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
                    } else {
                        console.error('[Minecraft] ⚠️ Chaîne complètement vide (0 caractères)');
                    }
                } else {
                    console.error('[Minecraft] ⚠️ Problème d\'authentification détecté:', dataStr.substring(0, 500));
                    console.error('[Minecraft] ⚠️ Longueur:', dataStr.length, 'caractères');
                }
            }

            // Détection spécifique de l'erreur Kotlin Native avec Java 17
            if (dataLower.includes('kotlin.native.concurrent') ||
                (dataLower.includes('invalid package name') && dataLower.includes('native'))) {
                console.error('[Minecraft] ❌ ERREUR KOTLIN NATIVE DÉTECTÉE');
                console.error('[Minecraft] ❌ Un mod utilise kotlin.native.concurrent qui est incompatible avec Java 17');
                console.error('[Minecraft] ❌ Message complet:', dataStr.substring(0, 1000));

                // Afficher un popup d'erreur explicite
                if (!window.kotlinNativeErrorShown) {
                    window.kotlinNativeErrorShown = true;
                    console.log('[Minecraft] 🔔 Affichage du popup d\'erreur Kotlin Native dans 2 secondes...');
                    // Capturer les variables nécessaires pour éviter les problèmes de contexte
                    const configDataDir = this.config.dataDirectory;
                    const instanceName = options.name;
                    // Capturer la liste des mods du serveur pour comparaison
                    const serverModsList = serverMods || [];
                    setTimeout(async () => {
                        console.log('[Minecraft] 🔔 Affichage du popup d\'erreur Kotlin Native...');
                        // Obtenir le chemin des mods pour aider l'utilisateur
                        // Recalculer le chemin pour être sûr qu'il est accessible
                        const basePath = `${await appdata()}/${process.platform == 'darwin' ? configDataDir : `.${configDataDir}`}`;
                        const currentInstancePath = `${basePath}/instances/${instanceName}`;
                        const modsPath = path.join(currentInstancePath, 'mods');
                        const modsExist = fs.existsSync(modsPath);
                        let modsInfo = '';
                        let suspectMods = [];

                        if (modsExist) {
                            try {
                                const modsFiles = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar'));

                                // Analyser chaque mod pour identifier les suspects
                                // MAIS seulement ceux qui sont présents sur le serveur
                                for (const modFile of modsFiles) {
                                    // Vérifier si le mod est présent sur le serveur
                                    // (comparaison flexible pour gérer les variations de nom)
                                    const isOnServer = serverModsList.some(serverMod => {
                                        const serverModLower = serverMod.toLowerCase();
                                        const localModLower = modFile.toLowerCase();
                                        // Correspondance exacte ou partielle (pour gérer les versions)
                                        return serverModLower === localModLower ||
                                            serverModLower.includes(localModLower.split('-')[0]) ||
                                            localModLower.includes(serverModLower.split('-')[0]);
                                    });

                                    // Ne considérer que les mods présents sur le serveur
                                    if (!isOnServer) {
                                        console.log(`[Minecraft] ⚠️ Mod local ignoré (pas sur serveur): ${modFile}`);
                                        continue; // Ignorer les mods locaux qui ne sont plus sur le serveur
                                    }

                                    const modPath = path.join(modsPath, modFile);
                                    const modNameLower = modFile.toLowerCase();

                                    // Critères pour identifier les mods suspects :
                                    // 1. Nom contient "kotlin" (suspect évident)
                                    // 2. KubeJS (utilise JavaScript/Kotlin, très probable cause)
                                    // 3. Rhino (moteur JavaScript qui peut utiliser Kotlin Native)
                                    // 4. Autres mods de script/JS
                                    const isSuspect = modNameLower.includes('kotlin') ||
                                        modNameLower.includes('kubejs') || // KubeJS utilise JavaScript/Kotlin
                                        modNameLower.includes('rhino') || // Rhino peut utiliser Kotlin Native
                                        (modNameLower.includes('script') && modNameLower.includes('forge')) ||
                                        (modNameLower.includes('js') && modNameLower.includes('forge'));

                                    // Log pour debug
                                    if (isSuspect) {
                                        console.log(`[Minecraft] 🔍 Mod suspect identifié (présent sur serveur): ${modFile}`);
                                    }

                                    if (isSuspect) {
                                        try {
                                            const stats = fs.statSync(modPath);
                                            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                                            suspectMods.push({
                                                name: modFile,
                                                size: sizeMB,
                                                path: modPath
                                            });
                                        } catch (e) {
                                            suspectMods.push({
                                                name: modFile,
                                                size: '?',
                                                path: modPath
                                            });
                                        }
                                    }
                                }

                                // Construire le message avec les mods suspects
                                let suspectList = '';
                                const hasKubeJS = suspectMods.some(m => m.name.toLowerCase().includes('kubejs'));

                                if (suspectMods.length > 0) {
                                    suspectList = `\n\n🔍 Mods suspects identifiés (${suspectMods.length}) :\n`;
                                    suspectMods.forEach((mod, idx) => {
                                        const isKubeJS = mod.name.toLowerCase().includes('kubejs');
                                        const marker = isKubeJS ? ' ⚠️ (TRÈS PROBABLE)' : '';
                                        suspectList += `   ${idx + 1}. ${mod.name} (${mod.size} MB)${marker}\n`;
                                    });

                                    if (hasKubeJS) {
                                        suspectList += `\n⚠️ KubeJS détecté : Ce mod est TRÈS PROBABLEMENT la cause du problème.\n` +
                                            `   KubeJS utilise Kotlin Native et peut être incompatible avec Java 17.\n` +
                                            `   Solution : Mettez KubeJS à jour à la dernière version compatible avec 1.20.1.\n` +
                                            `   Ou retirez-le temporairement pour confirmer.`;
                                    } else {
                                        suspectList += `\n💡 Commencez par retirer ou mettre à jour ces mods un par un.`;
                                    }
                                } else {
                                    suspectList = `\n\n⚠️ Aucun mod évident identifié, mais l'erreur persiste.\n` +
                                        `💡 Le mod problématique peut être une dépendance d'un autre mod.\n` +
                                        `   Vérifiez aussi les mods qui utilisent JavaScript ou des scripts.`;
                                }

                                modsInfo = `\n\n📁 Mods installés (${modsFiles.length} fichiers) :\n${modsPath}` +
                                    suspectList +
                                    `\n\n💡 Instructions :\n` +
                                    `1. Ouvrez le dossier des mods ci-dessus\n` +
                                    `2. Retirez temporairement les mods suspects listés\n` +
                                    `3. Testez le lancement après chaque retrait\n` +
                                    `4. Si le problème persiste, vérifiez les dépendances des mods`;
                            } catch (e) {
                                console.error('[Minecraft] ❌ Erreur lors de l\'analyse des mods:', e);
                                modsInfo = `\n\n📁 Dossier des mods : ${modsPath}\n\n⚠️ Erreur lors de l'analyse des mods: ${e.message}`;
                            }
                        } else {
                            modsInfo = `\n\n📁 Dossier des mods : ${modsPath} (non trouvé)`;
                        }

                        try {
                            let popupError = new popup();
                            popupError.openPopup({
                                title: '❌ Erreur de compatibilité Kotlin Native',
                                content: 'Un mod dans votre pack utilise Kotlin Native avec un package nommé "kotlin.native.concurrent", qui est incompatible avec Java 17.\n\n' +
                                    '🔧 Solutions possibles :\n\n' +
                                    '1. Identifier et mettre à jour le mod problématique :\n' +
                                    '   - Recherchez les mods avec "kotlin" dans le nom\n' +
                                    '   - Vérifiez leurs versions et mettez-les à jour\n' +
                                    '   - Les mods non mis à jour depuis longtemps sont souvent la cause\n\n' +
                                    '2. Retirer temporairement le mod incompatible :\n' +
                                    '   - Retirez les mods suspects un par un pour identifier le problème\n' +
                                    '   - Testez après chaque retrait\n\n' +
                                    '3. Utiliser Java 8 ou 11 (NON RECOMMANDÉ) :\n' +
                                    '   - Minecraft 1.20.1 nécessite Java 17\n' +
                                    '   - Cette solution peut causer d\'autres problèmes\n\n' +
                                    modsInfo + '\n\n' +
                                    '📋 L\'erreur complète est affichée dans la console (F12).',
                                color: 'red',
                                options: true
                            });
                            console.log('[Minecraft] ✅ Popup d\'erreur Kotlin Native affiché avec succès');
                        } catch (popupError) {
                            console.error('[Minecraft] ❌ Erreur lors de l\'affichage du popup:', popupError);
                        }
                    }, 2000);
                }
            }

            // Logger les erreurs importantes (en excluant les warnings OpenGL non critiques)
            // Les erreurs OpenGL sont souvent des warnings de rendu qui n'empêchent pas le jeu de fonctionner
            const isOpenGLWarning = dataLower.includes('opengl') ||
                dataLower.includes('gl_invalid') ||
                dataLower.includes('gl error') ||
                (dataLower.includes('invalid') && dataLower.includes('gl_'));

            if (!isOpenGLWarning && (dataLower.includes('error') ||
                dataLower.includes('exception') ||
                dataLower.includes('crash') ||
                dataLower.includes('fatal') ||
                dataLower.includes('failed') ||
                dataLower.includes('cannot') ||
                dataLower.includes('invalid'))) {
                // Afficher le contenu complet même s'il semble vide
                if (dataStr.trim().length === 0) {
                    // Si la chaîne est vide, afficher la représentation complète
                    console.error('[Minecraft] ⚠️ Erreur détectée (message vide)');
                    console.error('[Minecraft] ⚠️ Longueur:', dataStr.length, 'caractères');
                    if (dataStr.length > 0) {
                        console.error('[Minecraft] ⚠️ Représentation JSON:', JSON.stringify(dataStr));
                        console.error('[Minecraft] ⚠️ Caractères (hex):', Array.from(dataStr).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
                    } else {
                        console.error('[Minecraft] ⚠️ Chaîne complètement vide (0 caractères)');
                    }
                } else {
                    console.error('[Minecraft] ⚠️ Erreur détectée:', dataStr.substring(0, 500));
                    console.error('[Minecraft] ⚠️ Longueur:', dataStr.length, 'caractères');
                }
            } else if (isOpenGLWarning) {
                // Logger les warnings OpenGL à un niveau moins critique (info au lieu d'error)
                console.log('[Minecraft] ℹ️ Avertissement OpenGL (non critique):', dataStr.substring(0, 200));
            }

            // Ne traiter que la première fois
            if (dataEventCount === 1) {
                progressBar.style.display = "none"
                if (configClient.launcher_config.closeLauncher === 'close-launcher') {
                    ipcRenderer.send("main-window-hide")
                }
                new logger('Minecraft', '#36b030');
                ipcRenderer.send('main-window-progress-load')
                infoStarting.innerHTML = `Lancement en cours...`

                console.log('[Home] ✅ Données de lancement reçues, Minecraft devrait démarrer...');
                console.log('[Home] Processus détaché:', opt.detached ? 'Oui (reste ouvert)' : 'Non (attaché au launcher)');

                // Vérifier que les mods sont présents après téléchargement
                const modsPath = path.join(instancePath, 'mods');
                try {
                    if (fs.existsSync(modsPath)) {
                        const modsFiles = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar'));
                        if (modsFiles.length === 0) {
                            console.warn('[Home] ⚠️ Dossier mods vide ! Aucun mod .jar trouvé.');
                            console.warn(`[Home] 📁 Vérifiez le dossier: ${modsPath}`);
                        } else {
                            console.log(`[Home] ✅ ${modsFiles.length} mod(s) .jar installé(s)`);
                            console.log(`[Home] 📁 Emplacement: ${modsPath}`);
                            // Lister les mods si peu nombreux
                            if (modsFiles.length <= 10) {
                                console.log('[Home] Mods installés:', modsFiles.join(', '));
                            }
                        }
                    } else {
                        console.warn('[Home] ⚠️ Le dossier mods n\'existe pas !');
                        console.warn(`[Home] 📁 Chemin attendu: ${modsPath}`);
                    }
                } catch (error) {
                    console.error('[Home] Erreur lors de la vérification des mods:', error);
                }
            } else {
                // Si l'événement se déclenche plusieurs fois, c'est suspect
                if (dataEventCount === 2) {
                    console.warn('[Home] ⚠️ L\'événement "data" se déclenche plusieurs fois - peut indiquer un problème');
                }
            }
        });

        launch.on('close', code => {
            // Le code peut être un nombre ou une string
            const codeStr = String(code);
            const codeNum = typeof code === 'number' ? code : (isNaN(parseInt(code)) ? null : parseInt(code));

            console.log(`[Home] Jeu fermé - Code: ${codeStr} (type: ${typeof code})`);

            // Afficher les sorties capturées si disponibles
            if (minecraftOutput.length > 0) {
                console.log(`[Home] 📤 stdout capturé (${minecraftOutput.length} lignes, dernières 20):`);
                minecraftOutput.slice(-20).forEach((line, idx) => {
                    const lineStr = String(line);
                    const trimmed = lineStr.trim();
                    // Afficher même si vide, avec représentation JSON pour voir les caractères invisibles
                    if (trimmed) {
                        console.log(`[Home] [stdout ${idx + 1}]`, trimmed.substring(0, 300));
                    } else {
                        console.log(`[Home] [stdout ${idx + 1}] (vide ou espaces)`);
                        console.log(`[Home] [stdout ${idx + 1}] Longueur: ${lineStr.length} caractères`);
                        if (lineStr.length > 0) {
                            console.log(`[Home] [stdout ${idx + 1}] JSON:`, JSON.stringify(lineStr.substring(0, 200)));
                            console.log(`[Home] [stdout ${idx + 1}] Hex (premiers 50):`, Array.from(lineStr.substring(0, 50)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
                        } else {
                            console.log(`[Home] [stdout ${idx + 1}] Chaîne complètement vide (0 caractères)`);
                        }
                    }
                });
            }

            // Afficher les dernières erreurs capturées si le jeu s'est fermé rapidement
            if (minecraftErrors.length > 0) {
                console.error(`[Home] ⚠️ stderr capturé (${minecraftErrors.length} lignes):`);
                minecraftErrors.forEach((err, idx) => {
                    const trimmed = String(err).trim();
                    if (trimmed) console.error(`[Home] [stderr ${idx + 1}]`, trimmed.substring(0, 500));
                });
            }

            // Vérifier si c'est une fermeture normale ou une erreur
            // Code 0 ou "Minecraft closed" = fermeture normale
            // Code non-0 = erreur
            const isNormalClose = codeNum === 0 ||
                (typeof code === 'string' && code.toLowerCase().includes('closed'));

            const isError = codeNum !== null && codeNum !== 0 && !isNaN(codeNum);

            if (isError) {
                console.warn(`[Home] ⚠️ Le jeu s'est fermé avec une erreur (code: ${codeNum})`);
                let errorMessage = `Le jeu s'est fermé avec le code d'erreur ${codeNum}.`;
                if (minecraftErrors.length > 0) {
                    const lastError = minecraftErrors[minecraftErrors.length - 1];
                    errorMessage += `\n\nDernière erreur: ${lastError.substring(0, 200)}`;
                }
                errorMessage += `\n\nVérifiez les logs Minecraft dans:\n${instancePath}\\logs\\latest.log`;

                let popupError = new popup();
                popupError.openPopup({
                    title: 'Jeu fermé',
                    content: errorMessage,
                    color: 'orange',
                    options: true
                });
            } else if (isNormalClose) {
                // Vérifier si le jeu s'est fermé trop rapidement (suspect)
                // Pour un jeu avec beaucoup de mods, le chargement prend normalement 30-60 secondes minimum
                const timeSinceLaunch = Date.now() - (window.gameLaunchTime || Date.now());
                const timeInSeconds = Math.round(timeSinceLaunch / 1000);

                // Seuil suspect : moins de 30 secondes pour un jeu avec mods
                if (timeInSeconds < 30) {
                    console.warn(`[Home] ⚠️ Le jeu s'est fermé rapidement (${timeInSeconds}s) - suspect pour un jeu avec mods`);
                    // Lire le dernier log pour voir ce qui s'est passé
                    const logsPath = path.join(instancePath, 'logs', 'latest.log');
                    try {
                        if (fs.existsSync(logsPath)) {
                            const logContent = fs.readFileSync(logsPath, 'utf8');
                            console.log(`[Home] 📄 Fichier latest.log trouvé (${logContent.length} caractères)`);

                            if (logContent.trim().length === 0) {
                                console.warn('[Home] ⚠️ Le fichier latest.log est vide - le jeu n\'a peut-être pas eu le temps d\'écrire les logs');

                                // Vérifier s'il y a d'autres fichiers de log
                                const logsDir = path.join(instancePath, 'logs');
                                if (fs.existsSync(logsDir)) {
                                    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
                                    console.log(`[Home] Fichiers de log disponibles: ${logFiles.join(', ')}`);

                                    // Essayer de lire le dernier fichier de log (par date)
                                    if (logFiles.length > 0) {
                                        const logFilesWithStats = logFiles.map(f => {
                                            const filePath = path.join(logsDir, f);
                                            const stats = fs.statSync(filePath);
                                            return { name: f, path: filePath, mtime: stats.mtime };
                                        });
                                        logFilesWithStats.sort((a, b) => b.mtime - a.mtime);
                                        const latestLogFile = logFilesWithStats[0];

                                        if (latestLogFile.name !== 'latest.log') {
                                            console.log(`[Home] Lecture du fichier de log le plus récent: ${latestLogFile.name}`);
                                            const altLogContent = fs.readFileSync(latestLogFile.path, 'utf8');
                                            const altLines = altLogContent.split('\n').filter(l => l.trim());
                                            console.log(`[Home] ${altLines.length} lignes dans ${latestLogFile.name}`);
                                            if (altLines.length > 0) {
                                                altLines.slice(-20).forEach((line, idx) => {
                                                    console.log(`[Home] [${idx + 1}]`, line.substring(0, 200));
                                                });
                                            }
                                        }
                                    }
                                }

                                // Afficher la mémoire correctement
                                const memoryMax = configClient.java_config?.java_memory?.max || 0;
                                const memoryMaxMo = memoryMax * 1024;
                                const memoryDisplay = memoryMaxMo >= 1024 ? `${memoryMax} Go (${memoryMaxMo} Mo)` : `${memoryMaxMo} Mo`;

                                let popupError = new popup();
                                popupError.openPopup({
                                    title: 'Jeu fermé rapidement',
                                    content: `Le jeu s'est fermé après ${timeInSeconds} seconde(s) et le fichier latest.log est vide.\n\nCauses possibles:\n- Crash avant l'écriture des logs\n- Problème de mémoire Java (${memoryDisplay})\n- Mod incompatible qui crash au démarrage\n- Problème avec l'accessToken\n\nVérifiez:\n- La mémoire allouée dans les paramètres\n- Les logs dans: ${logsPath}`,
                                    color: 'orange',
                                    options: true
                                });
                            } else {
                                const lines = logContent.split('\n').filter(l => l.trim());
                                console.log(`[Home] 📄 ${lines.length} lignes dans latest.log`);
                                const lastLines = lines.slice(-50); // Dernières 50 lignes non-vides
                                const errorLines = lastLines.filter(line =>
                                    line.toLowerCase().includes('error') ||
                                    line.toLowerCase().includes('exception') ||
                                    line.toLowerCase().includes('fatal') ||
                                    line.toLowerCase().includes('crash') ||
                                    line.toLowerCase().includes('failed') ||
                                    line.toLowerCase().includes('outofmemory') ||
                                    line.toLowerCase().includes('out of memory')
                                );

                                if (errorLines.length > 0) {
                                    console.error('[Home] ⚠️ Erreurs trouvées dans latest.log:');
                                    errorLines.slice(-5).forEach(err => {
                                        const cleanErr = err.trim();
                                        if (cleanErr) console.error('[Home]', cleanErr.substring(0, 300));
                                    });

                                    // Afficher un popup avec les erreurs
                                    const lastError = errorLines[errorLines.length - 1].trim();
                                    let popupError = new popup();
                                    popupError.openPopup({
                                        title: 'Jeu fermé rapidement',
                                        content: `Le jeu s'est fermé après ${timeInSeconds} seconde(s).\n\nDernière erreur:\n${lastError.substring(0, 200)}\n\nLogs complets: ${logsPath}`,
                                        color: 'orange',
                                        options: true
                                    });
                                } else {
                                    console.warn('[Home] ⚠️ Aucune erreur trouvée dans latest.log, mais le jeu s\'est fermé rapidement');
                                    // Afficher TOUTES les lignes du log (même si peu nombreuses)
                                    console.log('[Home] 📄 Contenu complet de latest.log:');
                                    console.log('[Home] 📄 Taille du fichier:', logContent.length, 'caractères');
                                    console.log('[Home] 📄 Nombre de lignes (avec vides):', logContent.split('\n').length);
                                    console.log('[Home] 📄 Nombre de lignes (sans vides):', lines.length);

                                    if (lines.length > 0) {
                                        lines.forEach((line, idx) => {
                                            const trimmed = line.trim();
                                            if (trimmed) {
                                                console.log(`[Home] [${idx + 1}] "${trimmed}"`);
                                            } else {
                                                console.log(`[Home] [${idx + 1}] (ligne vide ou seulement espaces)`);
                                            }
                                        });

                                        // Analyser les lignes pour voir si ModLauncher a commencé à charger les mods
                                        const modLoadingLines = lines.filter(line =>
                                            line.toLowerCase().includes('mod') ||
                                            line.toLowerCase().includes('loading') ||
                                            line.toLowerCase().includes('scanning') ||
                                            line.toLowerCase().includes('preparing')
                                        );

                                        if (modLoadingLines.length === 0 && lines.length <= 2) {
                                            console.error('[Home] ❌ ModLauncher a démarré mais n\'a pas commencé à charger les mods - crash très précoce');
                                            console.error('[Home] ❌ Causes possibles:');
                                            console.error('[Home] ❌   - Problème avec l\'accessToken (vérifiez qu\'il est valide côté serveur)');
                                            console.error('[Home] ❌   - Crash au démarrage de ModLauncher (vérifiez les crash reports)');
                                            console.error('[Home] ❌   - Problème de configuration Java/JVM');

                                            // Afficher la mémoire configurée
                                            const memoryMax = configClient.java_config?.java_memory?.max || 0;
                                            const memoryMaxMo = memoryMax * 1024;
                                            const memoryDisplay = memoryMaxMo >= 1024 ? `${memoryMax} Go (${memoryMaxMo} Mo)` : `${memoryMaxMo} Mo`;
                                            console.error(`[Home] ❌   - Mémoire configurée: ${memoryDisplay}`);

                                            // Vérifier si la mémoire est trop faible
                                            if (memoryMaxMo < 4096) {
                                                console.error('[Home] ❌   - ATTENTION: Mémoire très faible pour 106 mods ! Minimum recommandé: 4-6 Go');
                                            }
                                        }
                                    } else {
                                        console.warn('[Home] ⚠️ Le fichier latest.log ne contient aucune ligne non-vide');
                                        // Afficher le contenu brut avec tous les caractères visibles
                                        console.log('[Home] Contenu brut complet:');
                                        console.log('[Home]', JSON.stringify(logContent));
                                        console.log('[Home] Premiers 1000 caractères:', logContent.substring(0, 1000));
                                    }

                                    // Vérifier s'il y a d'autres fichiers de log (crash reports, logs Java, etc.)
                                    const logsDir = path.join(instancePath, 'logs');
                                    const crashReportsDir = path.join(instancePath, 'crash-reports');

                                    // Vérifier les logs Java (hs_err_pid*.log) - créés quand Java crash
                                    try {
                                        // Chercher dans le répertoire de l'instance
                                        const instanceFiles = fs.existsSync(instancePath) ? fs.readdirSync(instancePath) : [];
                                        const javaCrashLogs = instanceFiles.filter(f => f.startsWith('hs_err_pid') && f.endsWith('.log'));

                                        // Chercher aussi dans le répertoire de travail (où le processus a été lancé)
                                        const workingDir = process.cwd();
                                        let workingDirFiles = [];
                                        try {
                                            workingDirFiles = fs.existsSync(workingDir) ? fs.readdirSync(workingDir) : [];
                                        } catch (e) {
                                            // Ignorer les erreurs
                                        }
                                        const javaCrashLogsWorking = workingDirFiles.filter(f => f.startsWith('hs_err_pid') && f.endsWith('.log'));

                                        // Chercher aussi dans le répertoire temporaire Windows (où Java peut écrire les logs)
                                        const tempDir = os.tmpdir();
                                        let tempDirFiles = [];
                                        try {
                                            tempDirFiles = fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [];
                                        } catch (e) {
                                            // Ignorer les erreurs
                                        }
                                        const javaCrashLogsTemp = tempDirFiles.filter(f => f.startsWith('hs_err_pid') && f.endsWith('.log'));

                                        const allJavaCrashLogs = [...javaCrashLogs, ...javaCrashLogsWorking, ...javaCrashLogsTemp];

                                        console.log(`[Home] 🔍 Recherche logs Java: ${javaCrashLogs.length} dans instance, ${javaCrashLogsWorking.length} dans workingDir, ${javaCrashLogsTemp.length} dans tempDir`);

                                        if (allJavaCrashLogs.length > 0) {
                                            console.error(`[Home] ⚠️ ${allJavaCrashLogs.length} log(s) de crash Java trouvé(s) !`);
                                            const latestJavaCrash = allJavaCrashLogs.sort().reverse()[0];
                                            // Essayer de trouver le fichier dans l'instance d'abord, puis dans le répertoire de travail, puis dans temp
                                            let javaCrashPath = path.join(instancePath, latestJavaCrash);
                                            if (!fs.existsSync(javaCrashPath)) {
                                                javaCrashPath = path.join(workingDir, latestJavaCrash);
                                            }
                                            if (!fs.existsSync(javaCrashPath)) {
                                                javaCrashPath = path.join(tempDir, latestJavaCrash);
                                            }

                                            if (fs.existsSync(javaCrashPath)) {
                                                console.error(`[Home] 📄 Dernier log de crash Java: ${latestJavaCrash}`);
                                                console.error(`[Home] 📄 Chemin: ${javaCrashPath}`);
                                                const javaCrashContent = fs.readFileSync(javaCrashPath, 'utf8');
                                                const javaCrashLines = javaCrashContent.split('\n').filter(l => l.trim());

                                                // Chercher la cause du crash dans les premières lignes
                                                console.error('[Home] Premières lignes du log de crash Java:');
                                                javaCrashLines.slice(0, 50).forEach((line, idx) => {
                                                    console.error(`[Home] [${idx + 1}]`, line.substring(0, 300));
                                                });

                                                // Chercher des indices sur la cause du crash
                                                const javaCrashText = javaCrashContent.toLowerCase();
                                                if (javaCrashText.includes('outofmemory') || javaCrashText.includes('java.lang.outofmemoryerror')) {
                                                    console.error('[Home] ❌ CRASH JAVA DÉTECTÉ: OutOfMemoryError - Problème de mémoire Java');
                                                }
                                                if (javaCrashText.includes('sigsegv') || javaCrashText.includes('segmentation fault')) {
                                                    console.error('[Home] ❌ CRASH JAVA DÉTECTÉ: Segmentation fault - Crash système');
                                                }
                                                if (javaCrashText.includes('unsatisfiedlinkerror') || javaCrashText.includes('native library')) {
                                                    console.error('[Home] ❌ CRASH JAVA DÉTECTÉ: Problème avec une bibliothèque native');
                                                }
                                                if (javaCrashText.includes('classnotfound') || javaCrashText.includes('noclassdeffounderror')) {
                                                    console.error('[Home] ❌ CRASH JAVA DÉTECTÉ: Classe Java introuvable - Problème de mod ou version');
                                                }
                                            }
                                        } else {
                                            console.warn('[Home] ⚠️ Aucun log de crash Java trouvé (hs_err_pid*.log)');
                                            console.warn('[Home] ⚠️ Cela peut signifier que Java crash avant de pouvoir écrire le log');
                                        }
                                    } catch (err) {
                                        console.error('[Home] ❌ Erreur lors de la recherche des logs Java:', err.message);
                                        console.error('[Home] ❌ Stack:', err.stack);
                                    }

                                    // Vérifier les crash reports Minecraft
                                    try {
                                        if (fs.existsSync(crashReportsDir)) {
                                            const crashReports = fs.readdirSync(crashReportsDir).filter(f => f.endsWith('.txt'));
                                            if (crashReports.length > 0) {
                                                console.error(`[Home] ⚠️ ${crashReports.length} crash report(s) Minecraft trouvé(s) !`);
                                                const latestCrash = crashReports.sort().reverse()[0];
                                                const crashPath = path.join(crashReportsDir, latestCrash);
                                                console.error(`[Home] 📄 Dernier crash report: ${latestCrash}`);
                                                const crashContent = fs.readFileSync(crashPath, 'utf8');
                                                const crashLines = crashContent.split('\n').filter(l => l.trim());
                                                console.error('[Home] Premières lignes du crash report:');
                                                crashLines.slice(0, 50).forEach((line, idx) => {
                                                    console.error(`[Home] [${idx + 1}]`, line.substring(0, 300));
                                                });

                                                // Chercher des indices sur la cause du crash
                                                const crashText = crashContent.toLowerCase();
                                                if (crashText.includes('outofmemory') || crashText.includes('java.lang.outofmemoryerror')) {
                                                    console.error('[Home] ❌ CRASH DÉTECTÉ: OutOfMemoryError - Problème de mémoire Java');
                                                }
                                                if (crashText.includes('invalid session') || crashText.includes('authentication')) {
                                                    console.error('[Home] ❌ CRASH DÉTECTÉ: Problème d\'authentification/token');
                                                }
                                                if (crashText.includes('modlauncher') && crashText.includes('failed')) {
                                                    console.error('[Home] ❌ CRASH DÉTECTÉ: Échec de ModLauncher');
                                                }
                                            } else {
                                                console.warn('[Home] ⚠️ Aucun crash report Minecraft trouvé - crash peut-être trop précoce pour générer un rapport');
                                            }
                                        } else {
                                            console.warn('[Home] ⚠️ Le dossier crash-reports n\'existe pas encore');
                                        }
                                    } catch (err) {
                                        console.error('[Home] ❌ Erreur lors de la lecture des crash reports:', err.message);
                                    }

                                    // Diagnostic spécifique pour la migration 1.12.2 → 1.20.1
                                    console.error('[Home] 🔍 Diagnostic migration 1.12.2 → 1.20.1:');
                                    console.error('[Home] 🔍   - Version Java: Java 17 requise pour 1.20.1 (vs Java 8 pour 1.12.2)');
                                    console.error('[Home] 🔍   - Forge: Nouveau système ModLauncher (vs ancien système)');
                                    console.error('[Home] 🔍   - Mods: Vérifiez que tous les mods sont compatibles avec 1.20.1');
                                    console.error('[Home] 🔍   - Mémoire: 1.20.1 nécessite plus de mémoire que 1.12.2');

                                    // Afficher la mémoire correctement (en Go si > 1024 Mo)
                                    const memoryMax = configClient.java_config?.java_memory?.max || 0;
                                    const memoryMaxMo = memoryMax * 1024; // Convertir Go en Mo
                                    const memoryDisplay = memoryMaxMo >= 1024 ? `${memoryMax} Go (${memoryMaxMo} Mo)` : `${memoryMaxMo} Mo`;

                                    let popupError = new popup();
                                    popupError.openPopup({
                                        title: 'Jeu fermé rapidement',
                                        content: `Le jeu s'est fermé après ${timeInSeconds} seconde(s) sans erreur visible.\n\nCauses possibles:\n- Crash silencieux\n- Problème de mémoire (${memoryDisplay} alloués)\n- Mod incompatible\n- Problème avec l'accessToken\n\nVérifiez les logs: ${logsPath}`,
                                        color: 'orange',
                                        options: true
                                    });
                                }
                            }
                        } else {
                            console.warn('[Home] ⚠️ Le fichier latest.log n\'existe pas encore');
                            let popupError = new popup();
                            popupError.openPopup({
                                title: 'Jeu fermé rapidement',
                                content: `Le jeu s'est fermé après ${timeInSeconds} seconde(s) et aucun log n'a été créé.\n\nLe jeu a probablement crashé avant de pouvoir écrire les logs.\n\nVérifiez:\n- La mémoire allouée\n- La version Java\n- Les mods installés`,
                                color: 'orange',
                                options: true
                            });
                        }
                    } catch (logError) {
                        console.error('[Home] Impossible de lire latest.log:', logError);
                    }
                } else {
                    console.log(`[Home] ✅ Jeu fermé normalement après ${Math.round(timeSinceLaunch / 1000)}s`);
                }
            } else {
                console.log(`[Home] Jeu fermé (code: ${codeStr})`);
                // Si le jeu se ferme rapidement sans code d'erreur, c'est suspect
                if (minecraftErrors.length > 0) {
                    console.warn('[Home] ⚠️ Le jeu s\'est fermé rapidement avec des erreurs. Vérifiez les logs.');
                    let popupError = new popup();
                    popupError.openPopup({
                        title: 'Jeu fermé rapidement',
                        content: `Le jeu s'est fermé immédiatement après le lancement. Vérifiez les logs Minecraft dans:\n${instancePath}\\logs\\latest.log\n\nErreurs capturées: ${minecraftErrors.length}`,
                        color: 'orange',
                        options: true
                    });
                }
            }

            if (configClient.launcher_config.closeLauncher === 'close-launcher') {
                ipcRenderer.send("main-window-show")
            }
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
        });

        launch.on('error', err => {
            console.error('[Home] ❌ Erreur minecraft-java-core:', err);

            // Vérifier si c'est l'erreur "data is not iterable"
            const errorMessage = err.error || err.message || String(err);
            let userMessage = errorMessage;

            // Ignorer les erreurs 404 pour les fichiers optionnels (comme example.js de KubeJS)
            if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                // Les erreurs 404 sont normales pour les fichiers optionnels qui n'existent pas
                // Ne pas afficher de popup, juste logger
                console.warn('[Home] ⚠️ Fichier non trouvé (404) - probablement un fichier optionnel:', errorMessage);
                return; // Ne pas bloquer le lancement pour une erreur 404
            }

            if (errorMessage.includes('not iterable') || errorMessage.includes('is not iterable')) {
                userMessage = 'Erreur de format des données de l\'instance. L\'API a retourné des données dans un format invalide. Veuillez contacter le support ou vérifier la configuration de l\'instance.';
                console.error('[Home] ❌ Erreur de format de données détectée - probablement assets/libraries mal formatés');
            }

            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur de lancement',
                content: userMessage,
                color: 'red',
                options: true
            })

            if (configClient.launcher_config.closeLauncher === 'close-launcher') {
                ipcRenderer.send("main-window-show")
            }
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
            console.log(err);
        });
    }

    settingsButton() {
        document.querySelector('.settings-btn').addEventListener('click', e => {
            const activeSettingsBTN = document.querySelector('.active-settings-BTN');
            if (activeSettingsBTN) activeSettingsBTN.classList.toggle('active-settings-BTN');
            document.querySelector('#account').classList.add('active-settings-BTN');

            const activeContainerSettings = document.querySelector('.active-container-settings');
            if (activeContainerSettings) activeContainerSettings.classList.toggle('active-container-settings');
            document.querySelector('#account-tab').classList.add('active-container-settings');

            changePanel('settings');
        });
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}

export default Home;