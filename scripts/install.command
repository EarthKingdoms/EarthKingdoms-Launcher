#!/bin/bash

# Script d'installation automatique pour macOS
# À double-cliquer dans le DMG

APP_NAME="EarthKingdoms Launcher"
APP_PATH="/Applications/${APP_NAME}.app"
DMG_APP_PATH="/Volumes/${APP_NAME}*/${APP_NAME}.app"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Installation de ${APP_NAME}"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Trouver l'app dans le DMG
if [ -d "$DMG_APP_PATH" ]; then
    echo "📦 Copie de l'application dans Applications..."
    cp -R "$DMG_APP_PATH" "/Applications/"
    echo "✅ Application copiée !"
else
    echo "⚠️  Application non trouvée dans le DMG."
    echo "   Veuillez glisser manuellement l'app dans Applications."
    read -p "Appuyez sur Entrée pour continuer..."
    exit 1
fi

# Vérifier que l'app existe maintenant
if [ ! -d "$APP_PATH" ]; then
    echo "❌ L'application n'a pas été trouvée dans Applications."
    exit 1
fi

# Retirer la quarantaine macOS
echo "🔓 Configuration de l'application..."
xattr -cr "$APP_PATH" 2>/dev/null
chmod +x "$APP_PATH/Contents/MacOS/${APP_NAME}" 2>/dev/null

echo "✅ Installation terminée !"
echo ""
echo "L'application est maintenant dans Applications."
echo "Vous pouvez la lancer en double-cliquant dessus."
echo ""
read -p "Voulez-vous lancer l'application maintenant ? (o/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Oo]$ ]]; then
    open "$APP_PATH"
fi

echo ""
echo "Appuyez sur Entrée pour fermer..."
read

