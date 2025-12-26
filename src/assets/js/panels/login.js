/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 * Modifié pour EarthKingdoms - Authentification via API backend uniquement
 */

const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus, generateDeterministicUUID } from '../utils.js';
import authAPI from '../utils/auth-api.js';

class Login {
    static id = "login";

    async init(config) {
        this.config = config;
        this.db = new database();

        // Vérifier si on vient des paramètres (bouton annuler visible)
        let cancelBtn = document.querySelector('.cancel-home');

        // FORCER l'utilisation de l'API backend uniquement
        // Bloquer Microsoft, Mojang, Crack et AZauth
        await this.getEarthKingdomsAuth();

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                cancelBtn.style.display = 'none'
                changePanel('settings')
            })
        }
    }

    /**
     * Authentification via l'API EarthKingdoms (remplace Microsoft/Mojang/Crack)
     */
    async getEarthKingdomsAuth() {
        console.log('Initializing EarthKingdoms API authentication...');
        let popupLogin = new popup();

        // Utiliser l'interface AZauth existante mais pour notre API
        let loginAPI = document.querySelector('.login-AZauth');
        let loginHome = document.querySelector('.login-home');
        let loginOffline = document.querySelector('.login-offline');

        // Masquer les autres interfaces
        if (loginHome) loginHome.style.display = 'none';
        if (loginOffline) loginOffline.style.display = 'none';

        // Afficher l'interface de connexion API
        if (loginAPI) {
            loginAPI.style.display = 'block';

            // Modifier les placeholders pour notre système
            let emailInput = document.querySelector('.email-AZauth');
            let passwordInput = document.querySelector('.password-AZauth');
            let connectBtn = document.querySelector('.connect-AZauth');

            if (emailInput) emailInput.placeholder = 'Pseudo ou Email';
            if (emailInput) emailInput.placeholder = 'Pseudo ou Email';
            if (passwordInput) passwordInput.placeholder = 'Mot de passe';

            // Gestion du lien d'inscription
            const registerLink = document.querySelector('.login-register a');
            if (registerLink) {
                registerLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    const { shell } = require('electron');
                    shell.openExternal('https://earthkingdoms-mc.fr/auth.php');
                });
            }

            if (connectBtn) {
                connectBtn.addEventListener('click', async () => {
                    if (!emailInput || !passwordInput) return;

                    if (emailInput.value === '' || passwordInput.value === '') {
                        popupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez remplir tous les champs !',
                            options: true
                        });
                        return;
                    }

                    popupLogin.openPopup({
                        title: 'Connexion en cours',
                        content: 'Veuillez patienter...',
                        color: 'var(--dark)'
                    });

                    const result = await authAPI.login(emailInput.value, passwordInput.value);

                    if (result.error) {
                        // Gérer spécifiquement le rate limiting
                        if (result.rateLimited) {
                            popupLogin.openPopup({
                                title: 'Trop de tentatives',
                                content: result.errorMessage || result.message || 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.',
                                color: 'orange',
                                options: true
                            });
                            // Désactiver le bouton temporairement
                            if (connectBtn) {
                                connectBtn.disabled = true;
                                connectBtn.textContent = 'Trop de tentatives...';
                                const waitTime = result.waitTime || 15;
                                setTimeout(() => {
                                    connectBtn.disabled = false;
                                    connectBtn.textContent = 'Connexion';
                                }, waitTime * 60 * 1000); // Attendre le temps spécifié
                            }
                        } else {
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: result.errorMessage || result.message || 'Erreur de connexion',
                                options: true
                            });
                        }
                    } else {
                        // Vérifier que le token existe dans la réponse
                        if (!result.token || result.token.trim() === '') {
                            console.error('[Login] ❌ Token manquant dans la réponse API');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de token. Veuillez réessayer ou contacter le support.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Vérifier que expires existe
                        if (!result.expires) {
                            console.error('[Login] ❌ Date d\'expiration manquante dans la réponse API');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de date d\'expiration. Veuillez réessayer ou contacter le support.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Vérifier que le token existe
                        if (!result.token || result.token.trim() === '') {
                            console.error('[Login] ❌ Token manquant dans la réponse');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de token. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Convertir les données en format compatible
                        const accountData = authAPI.convertToAccountFormat(result);

                        // Vérifier que le token a bien été stocké
                        if (!accountData.access_token || accountData.access_token.trim() === '') {
                            console.error('[Login] ❌ Token non stocké');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'Erreur lors du stockage du token. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        console.log('[Login] ✅ Connexion réussie pour:', result.username);
                        console.log('[Login] 📦 Données du compte préparées:', {
                            name: accountData.name,
                            uuid: accountData.uuid,
                            hasToken: !!accountData.access_token,
                            tokenLength: accountData.access_token?.length || 0
                        });

                        // Sauvegarder le token launcher (valable 12 heures)
                        console.log('[Login] 💾 Appel de saveData...');
                        try {
                            await this.saveData(accountData);
                            console.log('[Login] ✅ saveData terminé avec succès');
                        } catch (saveError) {
                            console.error('[Login] ❌ ERREUR lors de saveData:', saveError);
                            console.error('[Login] ❌ Stack trace:', saveError.stack);
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'Erreur lors de la sauvegarde du compte. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }
                        popupLogin.closePopup();
                        console.log('[Login] ✅ Processus de connexion terminé');
                    }
                });
            }
        } else {
            // Si l'interface n'existe pas, créer une interface simple
            await this.createSimpleLoginInterface();
        }
    }

    /**
     * Créer une interface de connexion simple si nécessaire
     */
    async createSimpleLoginInterface() {
        let popupLogin = new popup();
        let loginContainer = document.querySelector('.login-home');

        if (loginContainer) {
            loginContainer.innerHTML = `
                <div class="login-text">Connexion EarthKingdoms</div>
                <div class="input-login">
                    <input type="text" class="email email-api" placeholder="Pseudo ou Email" />
                    <input type="password" class="password password-api" placeholder="Mot de passe" />
                </div>
                <div class="login-options">
                    <button class="connect connect-api">Connexion</button>
                </div>
            `;
            loginContainer.style.display = 'block';

            let emailInput = document.querySelector('.email-api');
            let passwordInput = document.querySelector('.password-api');
            let connectBtn = document.querySelector('.connect-api');

            if (connectBtn) {
                connectBtn.addEventListener('click', async () => {
                    if (!emailInput || !passwordInput) return;

                    if (emailInput.value === '' || passwordInput.value === '') {
                        popupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez remplir tous les champs !',
                            options: true
                        });
                        return;
                    }

                    popupLogin.openPopup({
                        title: 'Connexion en cours',
                        content: 'Veuillez patienter...',
                        color: 'var(--dark)'
                    });

                    const result = await authAPI.login(emailInput.value, passwordInput.value);

                    if (result.error) {
                        // Gérer spécifiquement le rate limiting
                        if (result.rateLimited) {
                            popupLogin.openPopup({
                                title: 'Trop de tentatives',
                                content: result.errorMessage || result.message || 'Trop de tentatives de connexion. Veuillez réessayer dans quelques minutes.',
                                color: 'orange',
                                options: true
                            });
                            // Désactiver le bouton temporairement
                            if (connectBtn) {
                                connectBtn.disabled = true;
                                connectBtn.textContent = 'Trop de tentatives...';
                                const waitTime = result.waitTime || 15;
                                setTimeout(() => {
                                    connectBtn.disabled = false;
                                    connectBtn.textContent = 'Connexion';
                                }, waitTime * 60 * 1000); // Attendre le temps spécifié
                            }
                        } else {
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: result.errorMessage || result.message || 'Erreur de connexion',
                                options: true
                            });
                        }
                    } else {
                        // Vérifier que le token existe dans la réponse
                        if (!result.token || result.token.trim() === '') {
                            console.error('[Login] ❌ Token manquant dans la réponse API');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de token. Veuillez réessayer ou contacter le support.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Vérifier que expires existe
                        if (!result.expires) {
                            console.error('[Login] ❌ Date d\'expiration manquante dans la réponse API');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de date d\'expiration. Veuillez réessayer ou contacter le support.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Vérifier que le token existe
                        if (!result.token || result.token.trim() === '') {
                            console.error('[Login] ❌ Token manquant dans la réponse');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'La réponse du serveur ne contient pas de token. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        // Convertir les données en format compatible
                        const accountData = authAPI.convertToAccountFormat(result);

                        // Vérifier que le token a bien été stocké
                        if (!accountData.access_token || accountData.access_token.trim() === '') {
                            console.error('[Login] ❌ Token non stocké');
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'Erreur lors du stockage du token. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }

                        console.log('[Login] ✅ Connexion réussie pour:', result.username);
                        console.log('[Login] 📦 Données du compte préparées:', {
                            name: accountData.name,
                            uuid: accountData.uuid,
                            hasToken: !!accountData.access_token,
                            tokenLength: accountData.access_token?.length || 0
                        });

                        // Sauvegarder le token launcher (valable 12 heures)
                        console.log('[Login] 💾 Appel de saveData...');
                        try {
                            await this.saveData(accountData);
                            console.log('[Login] ✅ saveData terminé avec succès');
                        } catch (saveError) {
                            console.error('[Login] ❌ ERREUR lors de saveData:', saveError);
                            console.error('[Login] ❌ Stack trace:', saveError.stack);
                            popupLogin.openPopup({
                                title: 'Erreur',
                                content: 'Erreur lors de la sauvegarde du compte. Veuillez réessayer.',
                                color: 'red',
                                options: true
                            });
                            return;
                        }
                        popupLogin.closePopup();
                        console.log('[Login] ✅ Processus de connexion terminé');
                    }
                });
            }
        }
    }

    // Méthodes Microsoft, Crack et AZauth désactivées - Utilisation de l'API uniquement
    // Ces méthodes sont bloquées pour forcer l'authentification via la base de données

    async saveData(connectionData) {
        console.log('[Login] 💾 Sauvegarde compte:', connectionData.name);
        let configClient = await this.db.readData('configClient');
        let existingAccounts = await this.db.readAllData('accounts');
        let existingAccount = existingAccounts.find(acc => acc.name === connectionData.name);

        if (existingAccount) {
            console.log('[Login] ✅ Compte existant (ID:', existingAccount.ID, ')');
            configClient.account_selected = existingAccount.ID;
            await this.db.updateData('configClient', configClient);
            await addAccount(existingAccount);
            await accountSelect(existingAccount);
            await changePanel('home');
            return;
        }

        console.log('[Login] ➕ Nouveau compte');
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_select
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist === account.name)
                if (whitelist !== account.name) {
                    if (instance.name === instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive === false)
                        configClient.instance_select = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);
        await changePanel('home');
        console.log('[Login] ✅ Compte sauvegardé');
    }
}

export default Login;