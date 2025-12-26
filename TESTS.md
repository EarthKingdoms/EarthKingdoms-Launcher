# Guide de Tests - Compatibilité Linux et macOS

Ce document détaille tous les tests à effectuer pour vérifier que le launcher fonctionne correctement sur Linux et macOS après les corrections apportées.

---

## 📋 Table des Matières

1. [Tests de Build](#tests-de-build)
2. [Tests de Fonctionnement](#tests-de-fonctionnement)
3. [Tests de Chemins de Fichiers](#tests-de-chemins-de-fichiers)
4. [Tests de Lancement Minecraft](#tests-de-lancement-minecraft)
5. [Tests de Mises à Jour](#tests-de-mises-à-jour)
6. [Tests de Non-Régression Windows](#tests-de-non-régression-windows)

---

## 🏗️ Tests de Build

### Test 1.1 : Build Linux (AppImage)

**Objectif :** Vérifier que le build Linux génère un AppImage fonctionnel.

**Prérequis :**
- Machine Linux (Ubuntu 20.04+ recommandé) ou Docker avec image Linux
- Node.js 18.x installé
- Toutes les dépendances installées (`npm ci`)

**Instructions :**

```bash
# 1. Cloner/naviguer vers le projet
cd EarthKingdoms-Launcher

# 2. Installer les dépendances
npm ci

# 3. Lancer le build
npm run build

# 4. Vérifier que les fichiers sont générés
ls -lh dist/
# Vous devriez voir :
# - EarthKingdoms-Launcher-linux-x64.AppImage
# - latest.yml (fichier de mise à jour)
```

**Résultats attendus :**
- ✅ Le build se termine sans erreur
- ✅ Le fichier `.AppImage` est généré dans `dist/`
- ✅ Le fichier `latest.yml` est créé
- ✅ La taille du fichier AppImage est raisonnable (> 50 MB)

**Vérifications supplémentaires :**
```bash
# Vérifier que l'AppImage est exécutable
chmod +x dist/EarthKingdoms-Launcher-linux-x64.AppImage

# Tester l'exécution (ne devrait pas crasher immédiatement)
./dist/EarthKingdoms-Launcher-linux-x64.AppImage --version
```

---

### Test 1.2 : Build macOS (DMG + ZIP)

**Objectif :** Vérifier que le build macOS génère un DMG et un ZIP.

**Prérequis :**
- Machine macOS (macOS 11+ recommandé)
- Node.js 18.x installé
- Xcode Command Line Tools installés (`xcode-select --install`)
- Toutes les dépendances installées

**Instructions :**

```bash
# 1. Cloner/naviguer vers le projet
cd EarthKingdoms-Launcher

# 2. Installer les dépendances
npm ci

# 3. Lancer le build
npm run build

# 4. Vérifier que les fichiers sont générés
ls -lh dist/
# Vous devriez voir :
# - EarthKingdoms-Launcher-mac-universal.dmg
# - EarthKingdoms-Launcher-mac-universal.zip
# - latest-mac.yml (fichier de mise à jour)
```

**Résultats attendus :**
- ✅ Le build se termine sans erreur
- ✅ Le fichier `.dmg` est généré
- ✅ Le fichier `.zip` est généré
- ✅ Les fichiers de mise à jour sont créés

**Vérifications supplémentaires :**
```bash
# Vérifier le contenu du DMG
hdiutil attach dist/EarthKingdoms-Launcher-mac-universal.dmg
# Vérifier que l'app est présente dans le DMG
ls /Volumes/EarthKingdoms\ Launcher/
hdiutil detach /Volumes/EarthKingdoms\ Launcher/
```

---

### Test 1.3 : Compilation de better-sqlite3

**Objectif :** Vérifier que la dépendance native `better-sqlite3` se compile correctement.

**Instructions Linux :**

```bash
# 1. Installer les dépendances de build
sudo apt-get update
sudo apt-get install -y build-essential python3

# 2. Nettoyer et réinstaller
rm -rf node_modules
npm ci

# 3. Vérifier que better-sqlite3 est compilé
ls node_modules/better-sqlite3/build/Release/
# Devrait contenir : better_sqlite3.node
```

**Instructions macOS :**

```bash
# 1. Installer les dépendances de build (si pas déjà fait)
xcode-select --install

# 2. Nettoyer et réinstaller
rm -rf node_modules
npm ci

# 3. Vérifier que better-sqlite3 est compilé
ls node_modules/better-sqlite3/build/Release/
# Devrait contenir : better_sqlite3.node
```

**Résultats attendus :**
- ✅ `better-sqlite3` se compile sans erreur
- ✅ Le fichier `.node` est présent dans `build/Release/`
- ✅ Aucune erreur de compilation native

**En cas d'erreur :**
- Vérifier que `electron-rebuild` est dans les devDependencies
- Essayer : `npm run electron-rebuild` (si script disponible)
- Vérifier les logs d'erreur pour les dépendances manquantes

---

## 🚀 Tests de Fonctionnement

### Test 2.1 : Lancement de l'Application (Linux)

**Objectif :** Vérifier que l'application se lance correctement sur Linux.

**Instructions :**

```bash
# 1. Rendre l'AppImage exécutable (si pas déjà fait)
chmod +x dist/EarthKingdoms-Launcher-linux-x64.AppImage

# 2. Lancer l'application
./dist/EarthKingdoms-Launcher-linux-x64.AppImage

# 3. Observer le comportement
# - La fenêtre de mise à jour devrait s'afficher (ou la fenêtre principale)
# - Aucune erreur dans la console
# - L'interface se charge correctement
```

**Résultats attendus :**
- ✅ L'application se lance sans crasher
- ✅ La fenêtre principale s'affiche
- ✅ Aucune erreur dans la console
- ✅ L'interface est visible et fonctionnelle

**Vérifications dans la console :**
```bash
# Lancer avec logs pour voir les erreurs
./dist/EarthKingdoms-Launcher-linux-x64.AppImage 2>&1 | tee launcher.log
# Vérifier les logs pour des erreurs
grep -i error launcher.log
```

---

### Test 2.2 : Lancement de l'Application (macOS)

**Objectif :** Vérifier que l'application se lance correctement sur macOS.

**Instructions :**

```bash
# 1. Extraire le ZIP (si nécessaire)
unzip dist/EarthKingdoms-Launcher-mac-universal.zip -d dist/

# 2. Lancer l'application
open dist/EarthKingdoms\ Launcher.app

# OU depuis le DMG :
# 1. Monter le DMG
hdiutil attach dist/EarthKingdoms-Launcher-mac-universal.dmg

# 2. Copier l'app dans Applications (optionnel)
cp -R /Volumes/EarthKingdoms\ Launcher/EarthKingdoms\ Launcher.app /Applications/

# 3. Lancer
open /Applications/EarthKingdoms\ Launcher.app
```

**Résultats attendus :**
- ✅ L'application se lance sans crasher
- ✅ Pas d'avertissement Gatekeeper (ou acceptable)
- ✅ La fenêtre principale s'affiche
- ✅ L'interface est visible et fonctionnelle

**En cas d'avertissement Gatekeeper :**
```bash
# Autoriser l'application manuellement
xattr -cr /Applications/EarthKingdoms\ Launcher.app
```

---

## 📁 Tests de Chemins de Fichiers

### Test 3.1 : Vérification du Fichier `.ek_auth` (Linux)

**Objectif :** Vérifier que le fichier `.ek_auth` est créé au bon emplacement sur Linux.

**Instructions :**

```bash
# 1. Lancer l'application et se connecter avec un compte EarthKingdoms
# 2. Lancer une instance (même si elle échoue, le fichier devrait être créé)

# 3. Vérifier l'emplacement du fichier
# Sur Linux, devrait être dans :
# ~/.config/.ek_auth OU
# ~/.local/share/.ek_auth OU
# ~/Library/Application Support/.ek_auth (selon la config Electron)

# Trouver le fichier
find ~ -name ".ek_auth" 2>/dev/null

# OU vérifier les emplacements Electron standards
ls -la ~/.config/.ek_auth
ls -la ~/.local/share/.ek_auth
```

**Résultats attendus :**
- ✅ Le fichier `.ek_auth` est créé
- ✅ Il est dans un emplacement logique (pas dans `~/AppData/Roaming/`)
- ✅ Le contenu est valide JSON

**Vérification du contenu :**
```bash
# Afficher le contenu (si trouvé)
cat ~/.config/.ek_auth
# Devrait contenir : {"token":"...","username":"...","expires":"..."}
```

---

### Test 3.2 : Vérification du Fichier `.ek_auth` (macOS)

**Objectif :** Vérifier que le fichier `.ek_auth` est créé au bon emplacement sur macOS.

**Instructions :**

```bash
# 1. Lancer l'application et se connecter avec un compte EarthKingdoms
# 2. Lancer une instance

# 3. Vérifier l'emplacement du fichier
# Sur macOS, devrait être dans :
# ~/Library/Application Support/EarthKingdoms-Launcher/.ek_auth

# Trouver le fichier
find ~/Library/Application\ Support -name ".ek_auth" 2>/dev/null

# OU vérifier directement
ls -la ~/Library/Application\ Support/EarthKingdoms-Launcher/.ek_auth
```

**Résultats attendus :**
- ✅ Le fichier `.ek_auth` est créé
- ✅ Il est dans `~/Library/Application Support/` (pas dans `~/AppData/`)
- ✅ Le contenu est valide JSON

---

### Test 3.3 : Vérification des Chemins dans les Messages d'Erreur

**Objectif :** Vérifier que les messages d'erreur affichent des chemins corrects (sans backslashes Windows).

**Instructions :**

1. Lancer l'application
2. Tenter de lancer Minecraft avec une configuration invalide (pour générer une erreur)
3. Observer le message d'erreur affiché

**Résultats attendus :**
- ✅ Les chemins utilisent des slashes `/` ou `path.join()` (pas de `\\`)
- ✅ Les chemins sont lisibles et corrects
- ✅ Exemple de chemin correct : `/home/user/.minecraft/instances/instance/logs/latest.log`
- ✅ Exemple de chemin incorrect : `C:\Users\...\logs\latest.log` (Windows uniquement)

---

## 🎮 Tests de Lancement Minecraft

### Test 4.1 : Lancement Complet (Linux)

**Objectif :** Vérifier que Minecraft se lance correctement depuis le launcher sur Linux.

**Prérequis :**
- Java installé et accessible
- Compte Minecraft configuré dans le launcher
- Instance configurée et valide

**Instructions :**

1. Lancer l'application
2. Se connecter avec un compte
3. Sélectionner une instance
4. Cliquer sur "Jouer"
5. Observer le processus de lancement

**Résultats attendus :**
- ✅ Le téléchargement des fichiers fonctionne
- ✅ Les mods sont téléchargés correctement
- ✅ Minecraft se lance
- ✅ Le jeu démarre sans erreur critique
- ✅ Le fichier `.ek_auth` est créé (pour comptes EarthKingdoms)

**Vérifications dans les logs :**
```bash
# Vérifier les logs de l'application
tail -f ~/.config/EarthKingdoms-Launcher/logs/*.log

# Vérifier les logs Minecraft
tail -f ~/.minecraft/instances/[instance-name]/logs/latest.log
```

---

### Test 4.2 : Lancement Complet (macOS)

**Objectif :** Vérifier que Minecraft se lance correctement depuis le launcher sur macOS.

**Instructions :**

1. Lancer l'application
2. Se connecter avec un compte
3. Sélectionner une instance
4. Cliquer sur "Jouer"
5. Observer le processus de lancement

**Résultats attendus :**
- ✅ Le téléchargement des fichiers fonctionne
- ✅ Les mods sont téléchargés correctement
- ✅ Minecraft se lance
- ✅ Le jeu démarre sans erreur critique
- ✅ Le fichier `.ek_auth` est créé au bon emplacement

---

## 🔄 Tests de Mises à Jour

### Test 5.1 : Mise à Jour Automatique (Linux)

**Objectif :** Vérifier que le système de mise à jour fonctionne sur Linux.

**Instructions :**

1. Créer une release GitHub avec une version supérieure
2. Lancer une version ancienne du launcher
3. Vérifier que la mise à jour est détectée
4. Télécharger et installer la mise à jour

**Résultats attendus :**
- ✅ La mise à jour est détectée
- ✅ Le téléchargement fonctionne
- ✅ L'installation se fait correctement
- ✅ Le launcher redémarre avec la nouvelle version

**Vérifications techniques :**
```bash
# Vérifier le fichier latest.yml
cat dist/latest.yml
# Devrait contenir les informations de mise à jour pour Linux
```

---

### Test 5.2 : Mise à Jour Automatique (macOS)

**Objectif :** Vérifier que le système de mise à jour fonctionne sur macOS.

**Instructions :**

1. Créer une release GitHub avec une version supérieure
2. Lancer une version ancienne du launcher
3. Vérifier que la mise à jour est détectée
4. Télécharger et installer la mise à jour

**Résultats attendus :**
- ✅ La mise à jour est détectée
- ✅ Le téléchargement fonctionne
- ✅ L'installation se fait correctement (DMG ou ZIP)
- ✅ Le launcher redémarre avec la nouvelle version

---

## 🪟 Tests de Non-Régression Windows

### Test 6.1 : Vérification Windows (Fonctionnement Normal)

**Objectif :** Vérifier que les modifications n'ont pas cassé le fonctionnement sur Windows.

**Instructions :**

1. Builder l'application sur Windows
2. Lancer l'application
3. Tester toutes les fonctionnalités principales

**Résultats attendus :**
- ✅ Tout fonctionne comme avant
- ✅ Le fichier `.ek_auth` est créé dans `%APPDATA%\.ek_auth`
- ✅ Les chemins dans les messages d'erreur sont corrects
- ✅ Minecraft se lance correctement

**Vérifications spécifiques :**
```powershell
# Vérifier le fichier .ek_auth
Get-Content $env:APPDATA\.ek_auth
# Devrait contenir le JSON avec token, username, expires
```

---

## 📊 Checklist de Tests Rapide

### Tests Essentiels (Minimum Requis)

- [ ] **Build Linux** : AppImage généré sans erreur
- [ ] **Build macOS** : DMG et ZIP générés sans erreur
- [ ] **Lancement Linux** : Application se lance sans crasher
- [ ] **Lancement macOS** : Application se lance sans crasher
- [ ] **Fichier .ek_auth Linux** : Créé au bon emplacement (pas dans AppData)
- [ ] **Fichier .ek_auth macOS** : Créé au bon emplacement (pas dans AppData)
- [ ] **Messages d'erreur** : Chemins corrects (pas de backslashes Windows)
- [ ] **Non-régression Windows** : Tout fonctionne toujours

### Tests Complets (Recommandés)

- [ ] **Compilation better-sqlite3 Linux** : Se compile sans erreur
- [ ] **Compilation better-sqlite3 macOS** : Se compile sans erreur
- [ ] **Lancement Minecraft Linux** : Jeu se lance correctement
- [ ] **Lancement Minecraft macOS** : Jeu se lance correctement
- [ ] **Mise à jour Linux** : Système de mise à jour fonctionne
- [ ] **Mise à jour macOS** : Système de mise à jour fonctionne

---

## 🐛 Dépannage

### Problème : Build échoue avec erreur de compilation native

**Solution :**
```bash
# Installer les outils de build
# Linux :
sudo apt-get install -y build-essential python3

# macOS :
xcode-select --install

# Réinstaller les dépendances
rm -rf node_modules
npm ci
```

### Problème : Fichier .ek_auth créé au mauvais endroit

**Vérification :**
```javascript
// Dans la console DevTools de l'application
const { ipcRenderer } = require('electron');
ipcRenderer.invoke('app-data-path').then(path => console.log(path));
// Vérifier que le chemin est correct pour la plateforme
```

### Problème : Application ne se lance pas sur macOS

**Solutions :**
```bash
# 1. Vérifier les permissions
xattr -cr /Applications/EarthKingdoms\ Launcher.app

# 2. Vérifier les logs système
log show --predicate 'process == "EarthKingdoms Launcher"' --last 5m

# 3. Lancer depuis le terminal pour voir les erreurs
/Applications/EarthKingdoms\ Launcher.app/Contents/MacOS/EarthKingdoms\ Launcher
```

---

## 📝 Notes de Test

**Date des tests :** _______________

**Testeur :** _______________

**Environnement de test :**
- Linux : _______________
- macOS : _______________
- Windows : _______________

**Résultats :**
- [ ] Tous les tests passent
- [ ] Certains tests échouent (voir notes ci-dessous)
- [ ] Tests non effectués

**Notes :**
_______________
_______________
_______________

---

## ✅ Validation Finale

Une fois tous les tests essentiels passés, le launcher est considéré comme compatible Linux et macOS.

**Critères de validation :**
- ✅ Builds réussis sur les 3 plateformes
- ✅ Application se lance sur toutes les plateformes
- ✅ Fichiers créés aux bons emplacements
- ✅ Aucune régression sur Windows
- ✅ Messages d'erreur avec chemins corrects

