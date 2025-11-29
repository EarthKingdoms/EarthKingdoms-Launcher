/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */
const nodeFetch = require('node-fetch')

export class skin2D {
    async creatHeadTexture(data) {
        let image = await getData(data)
        return await new Promise((resolve, reject) => {
            // Gérer les erreurs de chargement d'image
            image.addEventListener('error', (e) => {
                console.error('[skin2D] Erreur lors du chargement de l\'image:', e);
                reject(new Error('Impossible de charger l\'image'));
            });
            
            // Si l'image est déjà chargée, traiter immédiatement
            if (image.complete && image.naturalHeight !== 0) {
                try {
                    let cvs = document.createElement('canvas');
                    cvs.width = 8;
                    cvs.height = 8;
                    let ctx = cvs.getContext('2d');
                    ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                    ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                    return resolve(cvs.toDataURL());
                } catch (error) {
                    reject(error);
                }
            } else {
                // Attendre que l'image se charge
                image.addEventListener('load', (e) => {
                    try {
                        let cvs = document.createElement('canvas');
                        cvs.width = 8;
                        cvs.height = 8;
                        let ctx = cvs.getContext('2d');
                        ctx.drawImage(image, 8, 8, 8, 8, 0, 0, 8, 8);
                        ctx.drawImage(image, 40, 8, 8, 8, 0, 0, 8, 8);
                        return resolve(cvs.toDataURL());
                    } catch (error) {
                        reject(error);
                    }
                });
            }
        })
    }
}

async function getData(data) {
    // Si c'est une URL HTTP, la convertir en base64 pour éviter les problèmes CORS
    if (data.startsWith('http')) {
        try {
            console.log(`[getData] Téléchargement de l'image depuis: ${data}`);
            let response = await nodeFetch(data);
            console.log(`[getData] Réponse reçue - Status: ${response.status}, OK: ${response.ok}`);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Impossible de lire le texte de l\'erreur');
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 100)}`);
            }
            
            let buffer = await response.buffer();
            console.log(`[getData] Buffer reçu - Taille: ${buffer.length} bytes`);
            
            // Vérifier que c'est bien une image
            const contentType = response.headers.get('content-type');
            console.log(`[getData] Content-Type: ${contentType}`);
            
            if (contentType && !contentType.startsWith('image/')) {
                throw new Error(`Le fichier n'est pas une image (Content-Type: ${contentType})`);
            }
            
            data = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`[getData] Image convertie en base64 avec succès (${data.length} caractères)`);
        } catch (error) {
            const errorMsg = error?.message || error?.toString() || String(error);
            const errorStack = error?.stack || 'Pas de stack trace';
            console.error(`[getData] Erreur lors du chargement de l'image depuis ${data}:`);
            console.error(`[getData] Message: ${errorMsg}`);
            console.error(`[getData] Stack: ${errorStack}`);
            throw error;
        }
    }
    // Si c'est déjà du base64 ou une data URL, utiliser directement
    let img = new Image();
    img.src = data;
    return img;
}