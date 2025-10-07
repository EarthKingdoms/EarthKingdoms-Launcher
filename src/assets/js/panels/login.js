/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus, generateDeterministicUUID } from '../utils.js';

class Login {
    static id = "login";

    async init(config) {
        this.config = config;
        this.db = new database();

        // Vérifier si on vient des paramètres (bouton annuler visible)
        let cancelBtn = document.querySelector('.cancel-home');
        let isFromSettings = cancelBtn && cancelBtn.style.display !== 'none';

        if(typeof this.config.online == 'boolean') {
            if(this.config.online) {
                await this.getMicrosoft(); // Mode Microsoft avec option crack
            } else {
                // Si on vient des paramètres et que la config est crack uniquement, on force le choix
                if(isFromSettings) {
                    await this.getMicrosoft(); // On force le mode Microsoft avec choix
                } else {
                    await this.getCrack(); // Mode crack uniquement
                }
            }
        } else if(typeof this.config.online == 'string') {
            if(this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                await this.getAZauth();
            }
        }
        
        cancelBtn.addEventListener('click', () => {
            cancelBtn.style.display = 'none'
            changePanel('settings')
        })
    }

    async getMicrosoft() {
        console.log('Initializing Microsoft login...');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        let crackBtn = document.querySelector('.connect-crack');
        loginHome.style.display = 'block';

        microsoftBtn.addEventListener("click", () => {
            popupLogin.openPopup({
                title: 'Connexion en cours',
                content: 'Veuillez patienter...',
                color: 'var(--dark)'
            });

            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                if(account_connect === 'cancel' || !account_connect) {
                    popupLogin.closePopup();
                } else {
                    await this.saveData(account_connect)
                    popupLogin.closePopup();
                }

            }).catch(err => {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: err,
                    options: true
                });
            });
        })

        crackBtn.addEventListener("click", () => {
            // Basculer vers le mode crack
            loginHome.style.display = 'none';
            let loginOffline = document.querySelector('.login-offline');
            loginOffline.style.display = 'block';
            
            // Initialiser la logique de connexion crack
            this.initCrackLogin();
        })
    }

    initCrackLogin() {
        let popupLogin = new popup();
        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-crack-mode'); // Classe spécifique pour le mode crack
        let cancelOffline = document.querySelector('.cancel-crack-mode'); // Classe spécifique pour le mode crack

        // Afficher le bouton annuler pour revenir à Microsoft
        cancelOffline.style.display = 'inline-block';

        // Gérer le retour vers Microsoft
        cancelOffline.addEventListener('click', () => {
            document.querySelector('.login-offline').style.display = 'none';
            document.querySelector('.login-home').style.display = 'block';
        });

        connectOffline.addEventListener('click', async () => {
            if(emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo doit faire au moins 3 caractères !',
                    options: true
                });
                return;
            }

            if(emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo ne doit pas contenir d\'espaces !',
                    options: true
                });
                return;
            }

            popupLogin.openPopup({
                title: 'Connexion en cours',
                content: 'Veuillez patienter...',
                color: 'var(--dark)'
            });

            // Générer un UUID déterministe pour ce pseudo
            let deterministicUUID = generateDeterministicUUID(emailOffline.value);
            
            // Créer un objet de connexion avec l'UUID déterministe
            let MojangConnect = {
                name: emailOffline.value,
                uuid: deterministicUUID,
                access_token: 'offline',
                meta: {
                    type: 'Mojang',
                    online: false
                }
            };

            await this.saveData(MojangConnect)
            popupLogin.closePopup();
        });
    }

    async getCrack() {
        console.log('Initializing offline login...');
        let popupLogin = new popup();
        let loginOffline = document.querySelector('.login-offline');
        let loginHome = document.querySelector('.login-home');
        
        // Masquer le bouton crack car on est déjà en mode crack uniquement
        let crackBtn = document.querySelector('.connect-crack');
        if(crackBtn) crackBtn.style.display = 'none';

        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-crack-mode'); // Classe spécifique pour le mode crack
        loginOffline.style.display = 'block';

        connectOffline.addEventListener('click', async () => {
            if(emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo doit faire au moins 3 caractères !',
                    options: true
                });
                return;
            }

            if(emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo ne doit pas contenir d\'espaces !',
                    options: true
                });
                return;
            }

            // Générer un UUID déterministe pour ce pseudo
            let deterministicUUID = generateDeterministicUUID(emailOffline.value);
            
            // Créer un objet de connexion avec l'UUID déterministe
            let MojangConnect = {
                name: emailOffline.value,
                uuid: deterministicUUID,
                access_token: 'offline',
                meta: {
                    type: 'Mojang',
                    online: false
                }
            };

            await this.saveData(MojangConnect)
            popupLogin.closePopup();
        });
    }

    async getAZauth() {
        console.log('Initializing AZauth login...');
        let AZauthClient = new AZauth(this.config.online);
        let PopupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');

        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');
        let AZauthConnectBTN = document.querySelector('.connect-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');

        loginAZauth.style.display = 'block';

        AZauthConnectBTN.addEventListener('click', async () => {
            PopupLogin.openPopup({
                title: 'Connexion en cours',
                content: 'Veuillez patienter...',
                color: 'var(--dark)'
            });

            if(AZauthEmail.value === '' || AZauthPassword.value === '') {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Veuillez remplir tous les champs !',
                    options: true
                });
                return;
            }

            let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

            if(AZauthConnect.error) {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: AZauthConnect.message,
                    options: true
                });
            } else if(AZauthConnect.A2F) {
                loginAZauthA2F.style.display = 'block';
                loginAZauth.style.display = 'none';
                PopupLogin.closePopup();

                AZauthCancelA2F.addEventListener('click', () => {
                    loginAZauthA2F.style.display = 'none';
                    loginAZauth.style.display = 'block';
                });

                connectAZauthA2F.addEventListener('click', async () => {
                    PopupLogin.openPopup({
                        title: 'Connexion en cours',
                        content: 'Veuillez patienter...',
                        color: 'var(--dark)'
                    });

                    if(AZauthA2F.value === '') {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez entrer le code A2F !',
                            options: true
                        });
                        return;
                    }

                    AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if(AZauthConnect.error) {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: AZauthConnect.message,
                            options: true
                        });
                        return;
                    }

                    await this.saveData(AZauthConnect)
                    PopupLogin.closePopup();
                });
            } else if(!AZauthConnect.A2F) {
                await this.saveData(AZauthConnect)
                PopupLogin.closePopup();
            }
        });
    }

    async saveData(connectionData) {
        let configClient = await this.db.readData('configClient');
        
        // Vérifier s'il existe déjà un compte avec ce nom (pour éviter les doublons)
        let existingAccounts = await this.db.readAllData('accounts');
        let existingAccount = existingAccounts.find(acc => acc.name === connectionData.name);
        
        if(existingAccount) {
            // Utiliser directement le compte existant (même UUID, même stuff)
            let popupInfo = new popup();
            popupInfo.openPopup({
                title: 'Compte existant',
                content: `Le compte "${connectionData.name}" existe déjà. Utilisation du compte existant pour préserver votre inventaire.`,
                color: 'green',
                background: false
            });
            
            // Sélectionner le compte existant sans le recréer
            configClient.account_selected = existingAccount.ID;
            await this.db.updateData('configClient', configClient);
            await addAccount(existingAccount);
            await accountSelect(existingAccount);
            await changePanel('home');
            return;
        }
        
        let account = await this.db.createData('accounts', connectionData)
        let instanceSelect = configClient.instance_selct
        let instancesList = await config.getInstanceList()
        configClient.account_selected = account.ID;

        for(let instance of instancesList) {
            if(instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist === account.name)
                if(whitelist !== account.name) {
                    if(instance.name === instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive === false)
                        configClient.instance_selct = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }

        await this.db.updateData('configClient', configClient);
        await addAccount(account);
        await accountSelect(account);

        await changePanel('home');
    }
}

export default Login;