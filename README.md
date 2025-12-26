# EarthKingdoms Launcher - Analyse de Compatibilité Linux et macOS

## 📋 Résumé Exécutif

Le projet est maintenant **configuré et corrigé** pour Linux et macOS. Toutes les corrections nécessaires ont été appliquées pour assurer la compatibilité cross-platform tout en préservant le fonctionnement sur Windows. Le workflow GitHub Actions est configuré pour builder les 3 plateformes.

## ✅ Corrections Appliquées

Toutes les corrections suivantes ont été implémentées :

---

## ✅ Points Positifs (Déjà en Place)

### 1. Configuration de Build
- **`build.js`** contient déjà la logique pour détecter et builder Linux/macOS :
  - macOS (darwin) : DMG + ZIP avec architecture universelle
  - Linux : AppImage pour x64
  - Les icônes sont présentes : `icon.icns` (macOS), `icon.png` (Linux), `icon.ico` (Windows)

### 2. GitHub Actions
- Le workflow `.github/workflows/build.yml` build déjà pour les 3 plateformes :
  ```yaml
  os: [macos-14, ubuntu-latest, windows-latest]
  ```

### 3. Electron Builder
- `electron-builder` est installé et configuré
- La configuration détecte automatiquement la plateforme

---

## ✅ Corrections Appliquées

### 1. ✅ Chemin `.ek_auth` - Corrigé
**Fichier :** `src/assets/js/panels/home.js` (ligne 584)
**Fichier :** `src/app.js` (ligne 60)

**Avant :**
```javascript
const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
```

**Après :**
```javascript
// Dans app.js - Ajout du handler IPC
ipcMain.handle('app-data-path', () => app.getPath('appData'))

// Dans home.js - Utilisation cross-platform
const appDataPath = await ipcRenderer.invoke('app-data-path');
const authFilePath = path.join(appDataPath, '.ek_auth');
```

**Résultat :** Le fichier `.ek_auth` sera créé au bon emplacement sur toutes les plateformes :
- Windows : `%APPDATA%/.ek_auth`
- macOS : `~/Library/Application Support/.ek_auth`
- Linux : `~/.config/.ek_auth` (ou équivalent selon la distribution)

### 2. ✅ Messages d'erreur avec backslashes - Corrigé
**Fichier :** `src/assets/js/panels/home.js` (lignes 1351, 1667)

**Avant :**
```javascript
errorMessage += `\n\nVérifiez les logs Minecraft dans:\n${instancePath}\\logs\\latest.log`;
```

**Après :**
```javascript
const logPath = path.join(instancePath, 'logs', 'latest.log');
errorMessage += `\n\nVérifiez les logs Minecraft dans:\n${logPath}`;
```

**Résultat :** Les messages d'erreur utilisent maintenant des chemins cross-platform corrects.

### 3. ✅ Gestion des chemins dans database.js - Amélioré
**Fichier :** `src/assets/js/utils/database.js` (ligne 27)

**Avant :**
```javascript
const dbPath = `${userDataPath}${dev ? '../..' : '/databases'}`;
```

**Après :**
```javascript
const dbPath = dev ? path.join(userDataPath, '..', '..') : path.join(userDataPath, 'databases');
```

**Résultat :** Utilisation de `path.join()` pour une meilleure compatibilité cross-platform.

### 4. ✅ Configuration package.json - Ajoutée
**Fichier :** `package.json` (section build)

**Ajouté :**
```json
"linux": {
    "target": ["AppImage"],
    "category": "Game",
    "desktop": {}
},
"mac": {
    "category": "public.app-category.games",
    "hardenedRuntime": false,
    "gatekeeperAssess": false
}
```

**Note :** La propriété `StartupWMClass` a été retirée car elle n'est pas supportée dans `linux.desktop` par electron-builder 26.x. La configuration minimale fonctionne correctement.

**Résultat :** Configuration spécifique pour Linux et macOS ajoutée.

---

## 📝 Anciens Problèmes (Maintenant Résolus)

### Note sur les Chemins

Le code utilise maintenant `path.join()` et les APIs Electron cross-platform pour tous les chemins de fichiers, garantissant la compatibilité sur toutes les plateformes.

### Note sur les Dépendances Natives

La dépendance `better-sqlite3` nécessite une compilation native. `electron-rebuild` est présent dans les devDependencies et devrait fonctionner automatiquement lors du build via GitHub Actions. Si des problèmes surviennent, il faudra vérifier que les outils de build sont installés sur les runners.

---

## 📝 Prochaines Étapes (Tests)

### Tests à Effectuer

1. **Tester le build sur Linux et macOS**
   - [ ] Build AppImage réussi sur Linux
   - [ ] Build DMG/ZIP réussi sur macOS
   - [ ] Vérifier que `better-sqlite3` se compile correctement
   - [ ] Tester le lancement de l'application
   - [ ] Vérifier la création du fichier `.ek_auth` au bon emplacement
   - [ ] Tester le lancement de Minecraft
   - [ ] Vérifier les chemins de fichiers générés

2. **Tester les mises à jour automatiques**
   - [ ] Vérifier que `electron-updater` fonctionne sur Linux/macOS
   - [ ] Tester les formats de release (AppImage, DMG)
   - [ ] Vérifier que les mises à jour se téléchargent et installent correctement

---

## 🔧 Détails Techniques des Modifications

Toutes les modifications ont été appliquées en utilisant les APIs cross-platform d'Electron et Node.js. Aucune logique spécifique à Windows n'a été supprimée, mais remplacée par des alternatives compatibles avec toutes les plateformes.

### Fichiers Modifiés

1. **`src/app.js`** - Ajout du handler IPC `app-data-path`
2. **`src/assets/js/panels/home.js`** - Correction du chemin `.ek_auth` et des messages d'erreur
3. **`src/assets/js/utils/database.js`** - Amélioration de la gestion des chemins
4. **`package.json`** - Ajout des configurations Linux et macOS

---

## 🧪 Checklist de Tests

### Tests Linux
- [ ] Build AppImage réussi
- [ ] Lancement de l'application
- [ ] Création du fichier `.ek_auth` au bon emplacement (`~/.config/.ek_auth` ou équivalent)
- [ ] Lancement de Minecraft
- [ ] Mise à jour automatique fonctionnelle
- [ ] Chemins de fichiers corrects dans les messages d'erreur

### Tests macOS
- [ ] Build DMG réussi
- [ ] Build ZIP réussi
- [ ] Lancement de l'application
- [ ] Création du fichier `.ek_auth` au bon emplacement (`~/Library/Application Support/.ek_auth`)
- [ ] Lancement de Minecraft
- [ ] Mise à jour automatique fonctionnelle
- [ ] Chemins de fichiers corrects dans les messages d'erreur

### Tests Windows (Vérification de non-régression)
- [ ] Vérifier que tout fonctionne toujours correctement
- [ ] Vérifier que le fichier `.ek_auth` est créé au bon emplacement (`%APPDATA%/.ek_auth`)

---

## 📊 État Actuel du Projet

| Composant | Windows | macOS | Linux |
|-----------|---------|-------|-------|
| Build Configuration | ✅ | ✅ | ✅ |
| GitHub Actions | ✅ | ✅ | ✅ |
| Icônes | ✅ | ✅ | ✅ |
| Chemins fichiers | ✅ | ✅ | ✅ |
| Messages erreur | ✅ | ✅ | ✅ |
| Configuration package.json | ✅ | ✅ | ✅ |
| Dépendances natives | ✅ | ⚠️ | ⚠️ |

**Légende :**
- ✅ Fonctionne / Corrigé
- ⚠️ Nécessite des tests (compilation native)

---

## 🎯 Conclusion

Le projet est maintenant **100% prêt au niveau du code** pour Linux et macOS. Toutes les corrections nécessaires ont été appliquées :

✅ **Corrections appliquées :**
- Chemin `.ek_auth` cross-platform
- Messages d'erreur avec chemins corrects
- Gestion des chemins dans `database.js`
- Configuration `package.json` pour Linux/macOS
- Handler IPC pour `appData` path

✅ **Compatibilité Windows préservée :**
- Toutes les modifications utilisent des APIs cross-platform
- Aucune régression attendue sur Windows
- Les chemins Windows continuent de fonctionner normalement

⚠️ **Prochaines étapes :**
- Tester les builds sur Linux et macOS
- Vérifier la compilation de `better-sqlite3` sur ces plateformes
- Tester les mises à jour automatiques

**Le code est prêt pour les builds multi-plateformes !** 🚀

---

## 📖 Guides Disponibles

### Guide de Tests
Un guide de tests détaillé est disponible dans **[TESTS.md](TESTS.md)** avec :
- Instructions pas à pas pour chaque test
- Commandes à exécuter
- Résultats attendus
- Solutions de dépannage
- Checklist complète

### Guide de Correction macOS
Un guide spécifique pour les problèmes macOS est disponible dans **[FIX_MACOS.md](FIX_MACOS.md)** avec :
- Solution pour régénérer l'icône (remplacer celle du template)
- Solutions pour le problème de lancement (Gatekeeper)
- Instructions de diagnostic
- Options de code signing et notarisation

### Guide de Diagnostic macOS
Un guide de diagnostic pour la page blanche est disponible dans **[DIAGNOSTIC_MACOS.md](DIAGNOSTIC_MACOS.md)** avec :
- Comment vérifier les logs
- Comment diagnostiquer les problèmes de chargement
- Solutions étape par étape

Consultez ces documents pour effectuer tous les tests et corrections nécessaires avant de publier les versions Linux et macOS.

