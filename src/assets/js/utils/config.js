/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const pkg = require('../package.json');
const nodeFetch = require("node-fetch");
const convert = require('xml-js');
let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url

let config = `${url}/launcher/config-launcher/config.json`;
let news = `${url}/launcher/news-launcher/news.json`;

class Config {
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if(config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        // URL de l'API PHP pour lister les instances
        const urlInstance = `${url}/launcher/files/?instance=null`;
        
        try {
            // Log réduit - seulement en cas d'erreur
            // console.log(`[Config] Récupération des instances depuis: ${urlInstance}`);
            const response = await nodeFetch(urlInstance);
            
            // Vérifier que la réponse est OK et que c'est du JSON
            if (!response.ok) {
                console.warn(`[Config] Erreur HTTP ${response.status} lors de la récupération des instances`);
                return [];
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn(`[Config] La réponse n'est pas du JSON (Content-Type: ${contentType})`);
                return [];
            }
            
            const instances = await response.json();
            // Log réduit - seulement en cas d'erreur
            // console.log(`[Config] Données reçues de l'API:`, instances);
            
            // L'API PHP peut retourner soit un objet, soit un tableau
            let instancesList = [];
            
            if (Array.isArray(instances)) {
                // Si c'est un tableau, utiliser directement
                instancesList = instances;
            } else if (typeof instances === 'object' && instances !== null) {
                // Si c'est un objet, convertir en tableau
                const entries = Object.entries(instances);
                for(let [name, data] of entries) {
                    let instance = data;
                    // S'assurer que le nom est défini
                    if (!instance.name) {
                        instance.name = name;
                    }
                    // S'assurer que l'URL est définie (utiliser le format de l'API PHP)
                    if (!instance.url) {
                        instance.url = `${url}/launcher/files/?instance=${name}`;
                    }
                    instancesList.push(instance);
                }
            } else {
                console.warn(`[Config] Format de données invalide pour les instances`);
                return [];
            }
            
            // Vérifier qu'on a au moins une instance
            if (instancesList.length === 0) {
                console.warn(`[Config] Aucune instance trouvée dans la réponse`);
                return [];
            }
            
            // Log réduit
            // console.log(`[Config] ${instancesList.length} instance(s) trouvée(s)`);
            return instancesList;
        } catch (error) {
            console.error(`[Config] Erreur lors de la récupération des instances:`, error);
            return [];
        }
    }


    async getNews() {
        let configData = await this.GetConfig().catch(err => {
            console.warn('[Config] Erreur lors de la récupération de la config:', err);
            return {};
        });

        if(configData.rss) {
            console.log(`[Config] Récupération des news depuis RSS: ${configData.rss}`);
            return new Promise((resolve, reject) => {
                nodeFetch(configData.rss).then(async response => {
                    if(response.status === 200) {
                        let news = [];
                        let textResponse = await response.text();
                        try {
                            let parsedResponse = JSON.parse(convert.xml2json(textResponse, { compact: true }));
                            let items = parsedResponse?.rss?.channel?.item;

                            if(!Array.isArray(items)) items = [items];
                            for(let item of items) {
                                if(item && item.title && item.title._text) {
                                    news.push({
                                        title: item.title._text,
                                        content: item['content:encoded']?._text || item.description?._text || '',
                                        author: item['dc:creator']?._text || 'Inconnu',
                                        publish_date: item.pubDate?._text || new Date().toISOString()
                                    });
                                }
                            }
                            console.log(`[Config] ${news.length} news récupérée(s) depuis RSS`);
                            return resolve(news);
                        } catch (parseError) {
                            console.error('[Config] Erreur lors du parsing RSS:', parseError);
                            return reject({ error: parseError });
                        }
                    } else {
                        console.error(`[Config] Erreur HTTP ${response.status} lors de la récupération RSS`);
                        return reject({ error: { code: response.statusText, message: 'server not accessible' } });
                    }
                }).catch(error => {
                    console.error('[Config] Erreur lors de la récupération RSS:', error);
                    return reject({ error });
                });
            });
        } else {
            console.log(`[Config] Récupération des news depuis: ${news}`);
            return new Promise((resolve, reject) => {
                nodeFetch(news).then(async response => {
                    if(response.status === 200) {
                        try {
                            const contentType = response.headers.get('content-type') || '';
                            if (!contentType.includes('application/json')) {
                                console.warn(`[Config] La réponse n'est pas du JSON (Content-Type: ${contentType})`);
                                return reject({ error: { message: 'Format de réponse invalide' } });
                            }
                            const newsData = await response.json();
                            console.log(`[Config] ${Array.isArray(newsData) ? newsData.length : '?'} news récupérée(s)`);
                            return resolve(newsData);
                        } catch (parseError) {
                            console.error('[Config] Erreur lors du parsing JSON:', parseError);
                            return reject({ error: parseError });
                        }
                    } else {
                        console.error(`[Config] Erreur HTTP ${response.status} lors de la récupération des news`);
                        return reject({ error: { code: response.statusText, message: 'server not accessible' } });
                    }
                }).catch(error => {
                    console.error('[Config] Erreur lors de la récupération des news:', error);
                    console.error('[Config] URL tentée:', news);
                    return reject({ error });
                });
            });
        }
    }
}

export default new Config;