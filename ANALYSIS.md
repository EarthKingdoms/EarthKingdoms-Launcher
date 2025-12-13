# Analyse du Launcher EarthKingdoms

Voici une analyse détaillée du code source du launcher, avec des suggestions d'améliorations, d'ajouts et de corrections.

## 🔴 Problèmes Critiques & Refactoring Prioritaire

### 1. Duplication de la logique d'Authentification (`home.js` vs `auth-api.js`)
**Problème :** Le fichier `src/assets/js/panels/home.js` contient un énorme bloc de code (lignes ~440 à 700) qui gère la vérification et le rafraîchissement du token avant le lancement. Cette logique existe déjà en grande partie dans `auth-api.js`.
**Risque :** Si vous modifiez la gestion des tokens dans l'API, vous devez modifier deux fichiers. Risque élevé de bugs et de désynchronisation.
**Solution :**
*   Déplacer toute la logique de "Vérification + Refresh automatique si besoin" dans une seule méthode `AuthAPI.getValidToken(account)`.
*   `home.js` devrait simplement appeler `await authAPI.getValidToken(account)` et obtenir un token prêt à l'emploi.

### 2. "God Class" `Home.js` - Méthode `startGame` trop complexe
**Problème :** La méthode `startGame` fait tout : vérification réseau, téléchargement, logique de token, arguments Java, gestion d'erreurs UI... Elle est difficile à maintenir.
**Solution :**
*   Extraire la logique de préparation des arguments Java dans un service dédié (ex: `GameLaunchService`).
*   Extraire la logique de téléchargement/vérification des fichiers.

### 3. Valeurs Hardcodées
**Problème :** L'URL `earthkingdoms-mc.fr` et l'IP du serveur sont écrites en dur à plusieurs endroits (`home.js`, `auth-api.js`, `settings.js`, `utils.js`).
**Solution :**
*   Créer un fichier `src/config.js` ou `src/constants.js` qui exporte ces valeurs.
*   Si l'IP du serveur change, vous n'aurez qu'un seul fichier à modifier.

---

## ✨ Fonctionnalités Manquantes / Suggestions d'Ajout

### 1. Système de "Réparation" / Vérification des fichiers
**Constat :** Le launcher télécharge les fichiers, mais ne semble pas proposer de bouton explicite "Réparer" pour forcer la revérification de l'intégrité de tous les fichiers du jeu (hash SHA1).
**Suggestion :** Ajouter une option (clic droit sur l'instance ou bouton dans les paramètres) pour forcer le re-téléchargement ou la revérification complète.

### 2. Gestion des Logs & Debug
**Constat :** Si le jeu crash, l'utilisateur d'habitude voit juste la fenêtre se fermer.
**Suggestion :**
*   Ajouter un onglet ou un bouton "Logs du Launcher" pour voir ce qu'il se passe en temps réel.
*   Si le jeu crash (code de sortie != 0), afficher une popup proposant d'ouvrir le fichier de logs (`latest.log` ou `crash-report`).

### 3. État du Serveur (Status Page)
**Constat :** Le statut affiche juste "En ligne/Hors ligne".
**Suggestion :**
*   Afficher plus de détails si le serveur est en maintenance (message récupéré via API).
*   Ajouter un lien vers une page de statut externe si le serveur est injoignable.

---

## 🛠 améliorations Techniques & Maintenance

### 1. `auth-api.js` - Gestion des erreurs
Le code gère beaucoup de codes HTTP (502, 503, 504), ce qui est très bien. Cependant, le mélange de `console.error` et de retour d'objets d'erreur peut être simplifié.
*   Utiliser des Exceptions personnalisées pour le flux de contrôle plutôt que de retourner `{error: true}` partout, ce qui oblige à vérifier `if(res.error)` à chaque étage.

### 2. `settings.js` - DOM Manipulation
Le fichier est rempli de `document.querySelector` éparpillés.
*   Mettre en cache les éléments DOM dans le constructeur ou une méthode `initDOM` pour améliorer (légèrement) les performances et la lisibilité.

### 3. Gestion de Java
Le launcher gère la RAM et le chemin Java.
*   **Amélioration :** Ajouter une détection automatique des versions de Java installées sur le système (via une commande `java -version` ou scan de registres) pour proposer une liste déroulante plutôt que de demander à l'utilisateur de chercher le fichier.

## 🎨 UI / UX (Interface Utilisateur)

*   **Feedback Visuel :** Lors du clic sur "Jouer", si le traitement (vérification token/fichiers) est long, ajouter un spinner ou changer le texte du bouton immédiatement pour "Préparation..." pour que l'utilisateur sache que sa demande est prise en compte.
*   **Accessibilité :** Les contrastes semblent corrects (thème clair/sombre géré), mais attention à la navigation au clavier qui semble absente (pas de `tabindex` ou gestion des événements clavier explicite hors des inputs).

## Résumé des actions recommandées (Par ordre de priorité)

1.  **Refactorer `auth-api.js`** pour centraliser la logique de "Token valide" et nettoyer `home.js`.
2.  **Externaliser les constantes** (URLs, IPs) dans un fichier de configuration.
3.  **Nettoyer `startGame`** dans `home.js`.
4.  Ajouter un bouton **"Réparer l'installation"**.
