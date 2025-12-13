/**
 * Module d'authentification pour l'API backend EarthKingdoms
 * Utilise le système de tokens launcher (12 heures / 43200 secondes)
 * @author EarthKingdoms
 */

const nodeFetch = require('node-fetch');
import Constants from './constants.js';

class AuthAPI {
    constructor() {
        this.apiBaseUrl = Constants.API_BASE_URL;
    }

    /**
     * Obtenir un token valide pour un compte (vérifie, rafraîchit si besoin)
     * Cette méthode centralise toute la logique de cycle de vie du token
     * @param {Object} account - L'objet compte complet de la BDD
     * @returns {Promise<Object>} { token, account } (account peut être mis à jour) ou throw Error
     */
    async getValidToken(account) {
        if (!account) throw new Error("Compte manquant");

        // Gérer le cas où account.meta contient les infos
        let token = account.access_token;
        let tokenExpires = account.token_expires;
        let updated = false;

        // 1. Vérifications basiques
        if (!token || token.trim() === '') {
            throw new Error('Token manquant ou vide');
        }

        // Si pas de date d'expiration, invalide
        if (!tokenExpires) {
            throw new Error("Date d'expiration manquante. Veuillez vous reconnecter.");
        }

        // 2. Normalisation du timestamp d'expiration (Secondes vs MS)
        // Convertir en MS pour les comparaisons Date, et stocker en S pour la consistance
        const expiresMs = tokenExpires > 10000000000 ? tokenExpires : tokenExpires * 1000;
        const nowMs = Date.now();
        const expiresAt = new Date(expiresMs);

        // 3. Vérification Expiration & Rafraîchissement

        // Cas A : Déjà expiré
        if (nowMs > expiresMs) {
            console.warn(`[AuthAPI] ⚠️ Token expiré depuis ${Math.floor((nowMs - expiresMs) / 60000)} minutes.`);

            // Si expiré depuis trop longtemps (> 30 min), on jette
            if (this.isTokenExpiredTooLong(tokenExpires)) {
                throw new Error("Session expirée depuis trop longtemps. Veuillez vous reconnecter.");
            }

            // Sinon (Grace Period), on tente un refresh
            console.log('[AuthAPI] Tentative de rafraîchissement (Grace Period)...');
            const refreshResult = await this.refreshToken(token);

            if (refreshResult.success && refreshResult.token) {
                console.log('[AuthAPI] ✅ Token rafraîchi avec succès.');
                token = refreshResult.token;
                tokenExpires = refreshResult.expires;

                // Mettre à jour l'objet compte localement
                account.access_token = token;
                account.token_expires = tokenExpires;
                updated = true;
            } else {
                console.error('[AuthAPI] ❌ Échec du rafraîchissement:', refreshResult.errorMessage);
                // On pourrait essayer de continuer, mais c'est risqué. Mieux vaut bloquer.
                throw new Error("Impossible de rafraîchir la session. Veuillez vous reconnecter.");
            }
        }
        // Cas B : Pas encore expiré, mais proche de la fin (< 1h)
        else if (this.isTokenNearExpiration(tokenExpires)) {
            console.log('[AuthAPI] Token proche de l\'expiration, rafraîchissement préventif...');
            const refreshResult = await this.refreshToken(token);

            if (refreshResult.success && refreshResult.token) {
                console.log('[AuthAPI] ✅ Token rafraîchi préventivement.');
                token = refreshResult.token;
                tokenExpires = refreshResult.expires;

                account.access_token = token;
                account.token_expires = tokenExpires;
                updated = true;
            } else {
                console.warn('[AuthAPI] ⚠️ Échec du rafraîchissement préventif. Continuation avec le token actuel.');
                // On continue avec le token actuel car il est encore valide
            }
        }

        // 4. Vérification finale (optionnelle mais sécurisée)
        // On vérifie que le token final est bien accepté par l'API
        // Note: On peut désactiver cette étape pour accélérer le lancement si on fait confiance au refresh
        /*
        const check = await this.checkToken(token);
        if (check.error || !check.valid) {
             throw new Error("Token rejeté par le serveur: " + (check.errorMessage || check.reason));
        }
        */

        return {
            token,
            account,
            updated
        };
    }

    /**
     * Connexion via l'API backend - Route launcher
     * @param {string} username - Pseudo ou email
     * @param {string} password - Mot de passe
     * @returns {Promise<Object>} Token launcher (64 chars, valable 12 heures) et infos utilisateur
     */
    async login(username, password) {
        try {
            const url = `${this.apiBaseUrl}/auth/launcher/login`;
            console.log(`[AuthAPI] Tentative de connexion vers: ${url}`);

            // Timeout de 30 secondes pour éviter que la requête bloque indéfiniment
            const timeout = 30000; // 30 secondes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await nodeFetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username: username,
                        password: password
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return await this.handleLoginResponse(response);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    console.error('[AuthAPI] ❌ Timeout de la requête (30s dépassé)');
                    return {
                        error: true,
                        errorMessage: 'Timeout de connexion: Le serveur ne répond pas dans les temps (30 secondes). Vérifiez votre connexion internet ou réessayez plus tard.',
                        message: 'Timeout de connexion. Le serveur ne répond pas.'
                    };
                }
                throw fetchError; // Re-lancer l'erreur pour qu'elle soit gérée par le catch externe
            }
        } catch (error) {
            return {
                error: true,
                errorMessage: error.message || 'Erreur de connexion au serveur',
                message: error.message || 'Erreur de connexion au serveur'
            };
        }
    }

    /**
     * Gérer la réponse de connexion (factorisé pour réutiliser)
     * @param {Response} response - Réponse HTTP
     * @returns {Promise<Object>} Données de connexion ou erreur
     */
    async handleLoginResponse(response) {
        // Vérifier d'abord si la réponse est OK
        if (!response.ok) {
            // Lire le texte de la réponse pour voir ce qui est retourné
            const textResponse = await response.text();
            console.error(`[AuthAPI] Erreur HTTP ${response.status}:`, textResponse.substring(0, 200));

            // Gérer les erreurs HTTP spécifiques AVANT d'essayer de parser
            if (response.status === 502) {
                return {
                    error: true,
                    errorMessage: 'Erreur serveur (502 Bad Gateway): Le serveur web ne peut pas communiquer avec l\'API backend. Veuillez contacter l\'administrateur ou réessayer plus tard.',
                    message: 'Erreur serveur (502): Le serveur ne répond pas correctement. Veuillez réessayer plus tard.'
                };
            }

            if (response.status === 503) {
                return {
                    error: true,
                    errorMessage: 'Service temporairement indisponible (503). Le serveur est en maintenance. Veuillez réessayer plus tard.',
                    message: 'Service temporairement indisponible. Veuillez réessayer plus tard.'
                };
            }

            if (response.status === 500) {
                return {
                    error: true,
                    errorMessage: 'Erreur serveur interne (500). Un problème est survenu côté serveur. Veuillez contacter l\'administrateur.',
                    message: 'Erreur serveur interne. Veuillez contacter l\'administrateur.'
                };
            }

            if (response.status === 504) {
                return {
                    error: true,
                    errorMessage: 'Timeout serveur (504 Gateway Timeout): Le serveur backend ne répond pas dans les temps. Le serveur est peut-être surchargé ou en maintenance. Veuillez réessayer dans quelques instants.',
                    message: 'Timeout serveur (504): Le serveur ne répond pas. Veuillez réessayer plus tard.'
                };
            }

            // Essayer de parser en JSON si possible
            let errorData;
            try {
                errorData = JSON.parse(textResponse);
            } catch (e) {
                // Ce n'est pas du JSON, utiliser le texte brut
                errorData = { error: textResponse || `Erreur HTTP ${response.status}` };
            }

            // Gérer les erreurs HTTP spécifiques
            if (response.status === 401) {
                return {
                    error: true,
                    errorMessage: 'Nom d\'utilisateur ou mot de passe incorrect',
                    message: 'Nom d\'utilisateur ou mot de passe incorrect'
                };
            }

            if (response.status === 403) {
                return {
                    error: true,
                    errorMessage: errorData.error || 'Compte désactivé ou email non vérifié',
                    message: errorData.error || 'Compte désactivé ou email non vérifié'
                };
            }

            if (response.status === 429) {
                const waitTime = errorData.wait_time || errorData.retry_after || 15;
                const message = errorData.error || errorData.message || `Trop de tentatives de connexion. Veuillez réessayer dans ${waitTime} minutes.`;
                return {
                    error: true,
                    errorMessage: message,
                    message: message,
                    rateLimited: true,
                    waitTime: waitTime
                };
            }

            // Autre erreur HTTP
            return {
                error: true,
                errorMessage: errorData.error || errorData.message || `Erreur serveur (${response.status})`,
                message: errorData.error || errorData.message || `Erreur serveur (${response.status})`
            };
        }

        // Vérifier le Content-Type avant de parser
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        let data;
        if (isJson) {
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('[AuthAPI] Erreur lors du parsing JSON:', parseError);
                const textResponse = await response.text();
                console.error('[AuthAPI] Réponse reçue:', textResponse.substring(0, 200));
                return {
                    error: true,
                    errorMessage: 'Réponse invalide du serveur (JSON malformé)',
                    message: 'Réponse invalide du serveur'
                };
            }
        } else {
            // Si ce n'est pas du JSON, lire le texte brut pour diagnostiquer
            const textResponse = await response.text();
            console.error('[AuthAPI] Réponse non-JSON reçue:', {
                status: response.status,
                statusText: response.statusText,
                contentType: contentType,
                url: response.url,
                preview: textResponse.substring(0, 200)
            });

            // Si c'est du HTML, c'est probablement une erreur 404 ou 500
            if (contentType.includes('text/html')) {
                return {
                    error: true,
                    errorMessage: `Erreur serveur (${response.status}): L'API a retourné du HTML au lieu de JSON. Vérifiez que l'endpoint /api/auth/launcher/login existe et fonctionne correctement.`,
                    message: `Erreur serveur (${response.status}): L'API a retourné du HTML au lieu de JSON.`
                };
            }

            // Autre type de contenu
            return {
                error: true,
                errorMessage: `Erreur serveur (${response.status}): Réponse inattendue (${contentType})`,
                message: `Erreur serveur (${response.status}): Réponse inattendue`
            };
        }

        // Réponse: { token, expires, username, is_admin }
        // expires est un timestamp Unix en secondes (confirmé côté serveur)
        // Normaliser en secondes si nécessaire (détection automatique)
        let expiresSeconds = data.expires;
        if (data.expires > 10000000000) {
            // Si expires > 10000000000, c'est probablement en millisecondes
            expiresSeconds = Math.floor(data.expires / 1000);
            console.log('[AuthAPI] ⚠️ expires reçu en millisecondes, conversion en secondes:', expiresSeconds);
        }

        console.log('[AuthAPI] ✅ Connexion réussie - Token:', data.token.substring(0, 16) + '...', 'Expires:', expiresSeconds, `(${new Date(expiresSeconds * 1000).toISOString()})`);

        return {
            error: false,
            token: data.token, // Token launcher (64 caractères hex)
            expires: expiresSeconds, // Timestamp Unix en secondes (normalisé)
            username: data.username, // Pseudo depuis la BDD
            is_admin: data.is_admin || 0
        };
    }

    /**
     * Vérifier le token launcher (route pour le launcher - GET)
     * @param {string} token - Token launcher (64 caractères hex)
     * @returns {Promise<Object>} { valid, username, is_admin } ou { valid: false, reason }
     */
    async checkToken(token) {
        if (!token) {
            console.error('[AuthAPI] checkToken appelé sans token');
            return {
                error: true,
                valid: false,
                errorMessage: 'Token manquant',
                reason: 'Token manquant'
            };
        }

        try {
            const url = `${this.apiBaseUrl}/auth/launcher/check-token?token=${encodeURIComponent(token)}`;
            const response = await nodeFetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Logs réduits - seulement en cas d'erreur
            if (!response.ok) {
                console.error(`[AuthAPI] Erreur HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error(`[AuthAPI] Réponse non-JSON: ${textResponse.substring(0, 100)}`);
                return {
                    error: true,
                    valid: false,
                    errorMessage: 'Réponse invalide de l\'API (pas du JSON)',
                    reason: 'Réponse invalide de l\'API (pas du JSON)'
                };
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error(`[AuthAPI] Erreur parsing JSON: ${parseError.message}`);
                return {
                    error: true,
                    valid: false,
                    errorMessage: 'Réponse invalide de l\'API (pas du JSON)',
                    reason: 'Réponse invalide de l\'API (pas du JSON)'
                };
            }

            // Vérifier si la propriété valid existe et est false, ou si elle n'existe pas
            if (data.valid === false || data.valid === undefined || data.valid === null) {
                const reason = data.reason || data.error || data.message || 'Token invalide ou expiré';
                console.warn(`[AuthAPI] Token invalide - Raison: ${reason}`);
                return {
                    error: true,
                    valid: false,
                    errorMessage: reason,
                    reason: reason
                };
            }

            // Token valide: { valid: true, username, is_admin, expires_at }
            return {
                error: false,
                valid: true,
                username: data.username,
                is_admin: data.is_admin || 0,
                expires_at: data.expires_at // Format ISO pour synchronisation
            };
        } catch (error) {
            console.error('[AuthAPI] Erreur lors du vérification du token:', error);
            return {
                error: true,
                valid: false,
                errorMessage: error.message || 'Erreur de vérification',
                reason: error.message || 'Erreur de vérification'
            };
        }
    }

    /**
     * Vérifier le token launcher et récupérer les informations (route pour le mod serveur - POST)
     * Utilisé par le mod serveur Minecraft
     * @param {string} token - Token launcher (64 caractères hex)
     * @returns {Promise<Object>} { valid, username, is_admin, allowed_ips } ou { valid: false, reason }
     */
    async verifyToken(token) {
        try {
            const response = await nodeFetch(`${this.apiBaseUrl}/auth/launcher/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: token
                })
            });

            const data = await response.json();

            if (!data.valid) {
                return {
                    error: true,
                    errorMessage: data.reason || 'Token invalide ou expiré',
                    reason: data.reason || 'Token invalide ou expiré'
                };
            }

            // Token valide: { valid: true, username, is_admin, allowed_ips }
            return {
                error: false,
                valid: true,
                username: data.username,
                is_admin: data.is_admin || 0,
                allowed_ips: data.allowed_ips || null
            };
        } catch (error) {
            return {
                error: true,
                errorMessage: error.message || 'Erreur de vérification',
                reason: error.message || 'Erreur de vérification'
            };
        }
    }

    /**
     * Rafraîchir un token launcher valide (route POST /api/auth/launcher/refresh-token)
     * Permet d'obtenir un nouveau token avant l'expiration du token actuel
     * @param {string} currentToken - Token launcher actuel (valide)
     * @returns {Promise<Object>} Nouveau token launcher { success, token, expires_at }
     */
    async refreshToken(currentToken) {
        if (!currentToken || currentToken.trim() === '') {
            console.error('[AuthAPI] refreshToken appelé sans token');
            return {
                error: true,
                success: false,
                errorMessage: 'Token manquant'
            };
        }

        try {
            const response = await nodeFetch(`${this.apiBaseUrl}/auth/launcher/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                }
            });

            // Vérifier le Content-Type avant de parser
            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');

            let data;
            if (isJson) {
                data = await response.json();
            } else {
                const textResponse = await response.text();
                console.error('[AuthAPI] Réponse non-JSON lors du refresh:', {
                    status: response.status,
                    contentType: contentType,
                    preview: textResponse.substring(0, 200)
                });
                return {
                    error: true,
                    success: false,
                    errorMessage: `Erreur serveur (${response.status}): Réponse invalide`
                };
            }

            if (!response.ok || !data.success) {
                const errorMsg = data.error || data.message || 'Erreur lors du rafraîchissement du token';
                console.error('[AuthAPI] Erreur lors du rafraîchissement:', errorMsg);
                console.error('[AuthAPI] Détails réponse:', { status: response.status, data: data });
                return {
                    error: true,
                    success: false,
                    errorMessage: errorMsg
                };
            }

            // Vérifier que le token est présent dans la réponse
            if (!data.token || data.token.trim() === '') {
                console.error('[AuthAPI] ❌ Token manquant dans la réponse de rafraîchissement');
                return {
                    error: true,
                    success: false,
                    errorMessage: 'Token manquant dans la réponse du serveur'
                };
            }

            // Réponse: { success: true, token, expires (timestamp), expires_at (ISO) }
            // Priorité: utiliser expires (timestamp Unix) si disponible, sinon convertir expires_at
            let expiresTimestamp;
            if (data.expires) {
                // Vérifier si expires est en secondes ou millisecondes
                // Si expires > 10000000000, c'est probablement en millisecondes
                if (data.expires > 10000000000) {
                    expiresTimestamp = Math.floor(data.expires / 1000); // Convertir en secondes
                    console.log('[AuthAPI] expires en millisecondes, conversion en secondes:', expiresTimestamp);
                } else {
                    expiresTimestamp = data.expires; // Déjà en secondes
                }
            } else if (data.expires_at) {
                expiresTimestamp = Math.floor(new Date(data.expires_at).getTime() / 1000);
            } else {
                console.warn('[AuthAPI] ⚠️ Aucune date d\'expiration dans la réponse');
                expiresTimestamp = null;
            }

            const expiresDate = expiresTimestamp ? new Date(expiresTimestamp * 1000) : null;
            console.log('[AuthAPI] ✅ Rafraîchissement réussi - Token:', data.token.substring(0, 16) + '...', 'Expires:', expiresTimestamp, expiresDate ? `(${expiresDate.toISOString()})` : '(null)');

            return {
                error: false,
                success: true,
                token: data.token, // Nouveau token launcher
                expires: expiresTimestamp, // Timestamp Unix en secondes
                expires_at: data.expires_at, // Format ISO (pour référence)
                username: data.username // Username (peut être présent dans la réponse)
            };
        } catch (error) {
            console.error('[AuthAPI] Erreur lors du rafraîchissement du token:', error);
            return {
                error: true,
                success: false,
                errorMessage: error.message || 'Erreur de connexion au serveur'
            };
        }
    }

    /**
     * Vérifier si un token est expiré
     * @param {number} expires - Timestamp d'expiration
     * @returns {boolean} true si expiré
     */
    isTokenExpired(expires) {
        if (!expires) return true;

        // Vérifier si expires est en secondes ou millisecondes
        let expiresSeconds;
        if (expires > 10000000000) {
            expiresSeconds = Math.floor(expires / 1000);
        } else {
            expiresSeconds = expires;
        }

        const now = Math.floor(Date.now() / 1000);
        return now >= expiresSeconds;
    }

    /**
     * Calculer le temps restant avant expiration du token (en secondes)
     * @param {number} expires - Timestamp d'expiration
     * @returns {number} Temps restant en secondes (négatif si expiré)
     */
    getTokenTimeRemaining(expires) {
        if (!expires) return -1;

        // Vérifier si expires est en secondes ou millisecondes
        // Si expires > 10000000000, c'est probablement en millisecondes (timestamp après 2001)
        // Si expires < 10000000000, c'est probablement en secondes
        let expiresSeconds;
        if (expires > 10000000000) {
            // C'est en millisecondes, convertir en secondes
            expiresSeconds = Math.floor(expires / 1000);
        } else {
            // C'est déjà en secondes
            expiresSeconds = expires;
        }

        const now = Math.floor(Date.now() / 1000);
        const remaining = expiresSeconds - now;
        return remaining;
    }

    /**
     * Vérifier si le token est proche de l'expiration (< 1 heure restante)
     * Avec un token de 12h, on rafraîchit si moins de 1h restante
     * @param {number} expires - Timestamp d'expiration
     * @returns {boolean} true si < 1 heure restante
     */
    isTokenNearExpiration(expires) {
        const timeRemaining = this.getTokenTimeRemaining(expires);
        return timeRemaining > 0 && timeRemaining < Constants.TOKEN_REFRESH_THRESHOLD_SECONDS; // Moins de 1 heure
    }

    /**
     * Vérifier si le token est dans la fenêtre de grâce (expiré depuis moins de 30 minutes)
     * Permet de rafraîchir un token légèrement expiré
     * @param {number} expires - Timestamp d'expiration
     * @returns {boolean} true si dans la fenêtre de grâce
     */
    isTokenInGracePeriod(expires) {
        if (!expires) return false;
        const timeRemaining = this.getTokenTimeRemaining(expires);
        // Expiré mais depuis moins de 30 minutes (1800 secondes)
        const inGrace = timeRemaining < 0 && timeRemaining > -Constants.TOKEN_GRACE_PERIOD_SECONDS;
        return inGrace;
    }

    /**
     * Vérifier si le token est expiré depuis plus de 30 minutes
     * @param {number} expires - Timestamp d'expiration
     * @returns {boolean} true si expiré depuis plus de 30 minutes
     */
    isTokenExpiredTooLong(expires) {
        if (!expires) return true;
        const timeRemaining = this.getTokenTimeRemaining(expires);
        const expiredTooLong = timeRemaining <= -Constants.TOKEN_GRACE_PERIOD_SECONDS; // Expiré depuis plus de 30 minutes
        return expiredTooLong;
    }

    /**
     * Récupérer l'URL du skin d'un utilisateur
     * @param {string} pseudo - Pseudo de l'utilisateur
     * @returns {string} URL du skin
     */
    getSkinUrl(pseudo) {
        return Constants.SKIN_URL_TEMPLATE.replace('{username}', pseudo);
    }

    /**
     * Convertir les données de l'API en format compatible avec minecraft-java-core
     * @param {Object} apiData - Données de l'API (token launcher + username + expires)
     * @param {Object} userInfo - Informations utilisateur supplémentaires (optionnel, pour compatibilité)
     * @returns {Object} Format de compte compatible
     */
    convertToAccountFormat(apiData, userInfo = null) {
        const { token, expires, username, is_admin } = apiData;

        // Générer un UUID déterministe basé sur le pseudo
        const crypto = require('crypto');
        const data = Buffer.from('OfflinePlayer:' + username, 'utf8');
        const hash = crypto.createHash('md5').update(data).digest();
        hash[6] = (hash[6] & 0x0f) | 0x30;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.toString('hex');
        const uuid = [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20, 32)
        ].join('-');

        return {
            name: username,
            uuid: uuid,
            access_token: token,
            token_expires: expires,
            meta: {
                type: 'EarthKingdoms',
                online: false,
                username: username,
                is_admin: is_admin || 0,
                user_id: userInfo?.id || null,
                email: userInfo?.email || null,
                skin_url: userInfo?.skin_url || null,
                email_verified: userInfo?.email_verified || null
            }
        };
    }
}

export default new AuthAPI();
