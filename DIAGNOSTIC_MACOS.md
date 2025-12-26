# Diagnostic - Page Blanche sur macOS

## 🔍 Comment Diagnostiquer le Problème

### Étape 1 : Vérifier les Logs

Lancez l'application depuis le terminal pour voir les erreurs :

```bash
/Applications/EarthKingdoms\ Launcher.app/Contents/MacOS/EarthKingdoms\ Launcher
```

Vous devriez voir des logs comme :
```
[MainWindow] AppPath: /path/to/app
[MainWindow] IsDev: false
[MainWindow] Fichier HTML trouvé: /path/to/app/launcher.html
```

### Étape 2 : Vérifier que les Fichiers Existent

Vérifiez que les fichiers HTML sont bien dans l'application :

```bash
# Vérifier la structure de l'app
ls -la "/Applications/EarthKingdoms Launcher.app/Contents/Resources/"

# Chercher les fichiers HTML
find "/Applications/EarthKingdoms Launcher.app" -name "*.html"
```

### Étape 3 : Vérifier les Chemins dans les Logs

Si vous voyez des erreurs comme :
- `❌ Aucun fichier launcher.html trouvé`
- `❌ Erreur lors du chargement`

Cela signifie que les fichiers ne sont pas au bon endroit.

## 🛠️ Solutions Possibles

### Solution 1 : Vérifier le Build

Assurez-vous que le build inclut bien tous les fichiers :

```bash
# Vérifier que les fichiers sont dans app/ après le build
ls -la app/
ls -la app/*.html
```

### Solution 2 : Vérifier l'ASAR

Les fichiers peuvent être dans un ASAR. Vérifiez :

```bash
# Lister le contenu de l'ASAR
npx asar list "/Applications/EarthKingdoms Launcher.app/Contents/Resources/app.asar" | grep html
```

### Solution 3 : Ouvrir les DevTools

**Les DevTools s'ouvrent maintenant automatiquement** pour faciliter le diagnostic.

1. Lancer l'app depuis le terminal (voir Étape 1)
2. Les DevTools s'ouvrent automatiquement
3. Vérifier la console pour les erreurs JavaScript
4. Vérifier l'onglet Network pour voir si les fichiers CSS/JS se chargent
5. Vérifier l'onglet Console pour les logs `[MainWindow]` et `[UpdateWindow]`

**Logs à chercher :**
- `[MainWindow] AppPath: ...` - Le chemin de l'application
- `[MainWindow] Fichier HTML trouvé: ...` - Le fichier HTML chargé
- `[MainWindow] ✅ Page chargée avec succès` - Confirmation du chargement
- `[MainWindow] ⚠️ Le body est vide !` - Problème de chargement des assets

## 📝 Informations à Fournir

Si le problème persiste, fournissez :

1. **Les logs complets** depuis le terminal (tous les messages `[MainWindow]` et `[UpdateWindow]`)
2. **Les erreurs de la console** (DevTools) - Capture d'écran de l'onglet Console
3. **L'onglet Network** (DevTools) - Voir quels fichiers CSS/JS ne se chargent pas
4. **La version de macOS** (`sw_vers`)
5. **Le résultat de** `find "/Applications/EarthKingdoms Launcher.app" -name "*.html"`
6. **Le résultat de** `npx asar list "/Applications/EarthKingdoms Launcher.app/Contents/Resources/app.asar" | head -20`

## 🔍 Diagnostic Automatique

Les nouvelles versions incluent :
- ✅ DevTools ouverts automatiquement pour diagnostic
- ✅ Logs détaillés dans la console
- ✅ Détection automatique des problèmes de chargement
- ✅ Vérification automatique si le body est vide

## ✅ Corrections Appliquées

Les dernières corrections incluent :
- ✅ Détection automatique de plusieurs chemins possibles
- ✅ Logs détaillés pour le diagnostic
- ✅ Fallback automatique si un chemin ne fonctionne pas
- ✅ Support des chemins ASAR et non-ASAR

**Important :** Ces corrections nécessitent un **nouveau build** pour être actives !

