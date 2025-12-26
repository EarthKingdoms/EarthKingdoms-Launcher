# Guide de Correction pour macOS

Ce document explique comment résoudre les problèmes rencontrés avec la version macOS du launcher.

## 🔧 Problèmes Identifiés

1. **Icône du template** : L'icône utilisée est celle du template, pas celle d'EarthKingdoms
2. **Application ne se lance pas** : Le launcher ne démarre pas après installation via DMG dans Applications

---

## ✅ Solution 1 : Régénérer l'Icône macOS

### Option A : Depuis l'URL GitHub (Recommandé)

```bash
npm run icon
```

Cette commande télécharge l'icône depuis GitHub et génère automatiquement :
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- `icon.png` (Linux)

### Option B : Depuis un fichier local

Si vous avez une icône personnalisée dans `src/assets/images/icon.png` :

```bash
npm run icon:local
```

### Option C : Manuellement

Si vous avez une nouvelle icône PNG (256x256 ou plus) :

1. Placez-la dans `src/assets/images/icon.png`
2. Exécutez :
```bash
node build.js --icon=src/assets/images/icon.png
```

---

## ✅ Solution 2 : Problème de Lancement sur macOS

Le problème de lancement est généralement dû à **Gatekeeper** (sécurité macOS) qui bloque les applications non signées.

**✅ SOLUTION AUTOMATIQUE :** Un fichier README est maintenant inclus dans le DMG avec des instructions simples pour les joueurs. L'icône est aussi générée automatiquement si elle manque.

### Solution Immédiate (Pour l'utilisateur)

**Méthode 1 : Retirer la quarantaine (Recommandé)**

```bash
# Ouvrir Terminal et exécuter :
xattr -cr /Applications/EarthKingdoms\ Launcher.app

# Puis essayer de lancer à nouveau
open /Applications/EarthKingdoms\ Launcher.app
```

**Méthode 2 : Autoriser manuellement**

1. Aller dans **Préférences Système** > **Sécurité et confidentialité**
2. Cliquer sur **Ouvrir quand même** si un message apparaît
3. Ou faire un clic droit sur l'app > **Ouvrir** > Confirmer

**Méthode 3 : Lancer depuis le terminal pour voir les erreurs**

```bash
/Applications/EarthKingdoms\ Launcher.app/Contents/MacOS/EarthKingdoms\ Launcher
```

Cela affichera les erreurs dans le terminal si l'app ne démarre pas.

### Solution Permanente (Pour le développeur)

#### Option 1 : Code Signing (Recommandé pour production)

Pour signer l'application avec un certificat Apple Developer :

1. Obtenir un certificat Apple Developer
2. Ajouter dans `package.json` :
```json
"build": {
  "mac": {
    "identity": "Developer ID Application: Votre Nom (TEAM_ID)"
  }
}
```

3. Configurer les variables d'environnement :
```bash
export APPLE_ID="votre@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="mot-de-passe-app"
export APPLE_TEAM_ID="TEAM_ID"
```

#### Option 2 : Notarisation (Pour distribution publique)

La notarisation permet à l'app de passer Gatekeeper sans intervention utilisateur.

Ajouter dans le workflow GitHub Actions ou localement :
```yaml
- name: Notarize app
  run: |
    xcrun notarytool submit \
      --apple-id ${{ secrets.APPLE_ID }} \
      --password ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }} \
      --team-id ${{ secrets.APPLE_TEAM_ID }} \
      dist/EarthKingdoms-Launcher-mac-universal.dmg
```

#### Option 3 : Configuration DMG améliorée

Ajouter dans `package.json` :
```json
"build": {
  "mac": {
    "dmg": {
      "sign": false,
      "background": null
    }
  }
}
```

---

## 🔍 Diagnostic des Problèmes

### Vérifier les logs système

```bash
# Voir les logs récents de l'application
log show --predicate 'process == "EarthKingdoms Launcher"' --last 5m

# Ou utiliser Console.app (Application Utilitaires > Console)
```

### Vérifier les permissions

```bash
# Vérifier les attributs étendus
xattr -l /Applications/EarthKingdoms\ Launcher.app

# Devrait afficher quelque chose comme :
# com.apple.quarantine: 0081;...
```

### Vérifier la structure de l'app

```bash
# Vérifier que l'exécutable existe
ls -la /Applications/EarthKingdoms\ Launcher.app/Contents/MacOS/

# Devrait afficher :
# EarthKingdoms Launcher (exécutable)
```

### Tester l'exécutable directement

```bash
# Lancer l'exécutable directement
/Applications/EarthKingdoms\ Launcher.app/Contents/MacOS/EarthKingdoms\ Launcher

# Si ça fonctionne, le problème vient de Gatekeeper
# Si ça ne fonctionne pas, vérifier les erreurs affichées
```

---

## 📝 Checklist de Vérification

Avant de distribuer la version macOS :

- [ ] L'icône est correcte (pas celle du template)
- [ ] L'application se lance après installation
- [ ] Les permissions sont correctes
- [ ] Aucune erreur dans les logs
- [ ] L'exécutable est présent dans le bundle
- [ ] Les fichiers de ressources sont présents

---

## 🚀 Instructions pour le Prochain Build

1. **Régénérer l'icône** :
   ```bash
   npm run icon
   ```

2. **Vérifier que l'icône est correcte** :
   - Ouvrir `src/assets/images/icon.icns` avec Aperçu
   - Vérifier que c'est bien l'icône EarthKingdoms

3. **Builder l'application** :
   ```bash
   npm run build
   ```

4. **Tester le DMG** :
   - Monter le DMG
   - Copier l'app dans Applications
   - Exécuter `xattr -cr /Applications/EarthKingdoms\ Launcher.app`
   - Tester le lancement

5. **Si le problème persiste** :
   - Vérifier les logs système
   - Tester l'exécutable directement
   - Considérer le code signing pour la production

---

## 💡 Notes Importantes

- **Gatekeeper** : macOS bloque par défaut les apps non signées téléchargées depuis Internet
- **Quarantaine** : Les fichiers téléchargés ont un attribut `com.apple.quarantine` qui doit être retiré
- **Code Signing** : Nécessite un compte Apple Developer payant ($99/an)
- **Notarisation** : Recommandée pour les apps distribuées publiquement

---

## 🔗 Ressources

- [Documentation electron-builder macOS](https://www.electron.build/configuration/mac)
- [Apple Developer - Code Signing](https://developer.apple.com/support/code-signing/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

