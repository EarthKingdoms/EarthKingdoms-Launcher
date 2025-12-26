#!/bin/bash

# Script d'installation automatique pour macOS
# Retire la quarantaine et configure l'application

APP_NAME="EarthKingdoms Launcher"
APP_PATH="/Applications/${APP_NAME}.app"

echo "🔧 Installation de ${APP_NAME}..."

# Vérifier si l'app existe
if [ ! -d "$APP_PATH" ]; then
    echo "❌ L'application n'a pas été trouvée dans Applications."
    echo "   Veuillez d'abord copier l'application dans le dossier Applications."
    exit 1
fi

# Retirer la quarantaine macOS
echo "🔓 Retrait de la quarantaine macOS..."
xattr -cr "$APP_PATH"

# Vérifier que ça a fonctionné
if [ $? -eq 0 ]; then
    echo "✅ Quarantaine retirée avec succès !"
else
    echo "⚠️  Erreur lors du retrait de la quarantaine."
fi

# Rendre l'exécutable... exécutable (au cas où)
chmod +x "$APP_PATH/Contents/MacOS/${APP_NAME}"

echo "✅ Installation terminée !"
echo ""
echo "Vous pouvez maintenant lancer ${APP_NAME} depuis Applications."
echo ""
read -p "Voulez-vous lancer l'application maintenant ? (o/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    open "$APP_PATH"
fi

