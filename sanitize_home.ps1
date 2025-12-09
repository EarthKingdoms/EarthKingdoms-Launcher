$file = "src/assets/js/panels/home.js"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix encoding artifacts
$content = $content.Replace("Ã©", "é")
$content = $content.Replace("Ã¨", "è")
$content = $content.Replace("Ã§", "ç")
$content = $content.Replace("âœ…", "✅")
$content = $content.Replace("ForcÃ©", "Forcé")
$content = $content.Replace("dÃ©diÃ©", "dédié")
$content = $content.Replace("succÃ¨s", "succès")
$content = $content.Replace("PrÃ©fÃ©rence", "Préférence")
$content = $content.Replace("configurÃ©", "configuré")
$content = $content.Replace("rÃ©cursive", "récursive")
$content = $content.Replace("nÃ©cessite", "nécessite")
$content = $content.Replace("ajoutÃ©e", "ajoutée")

# Fix potential syntax errors in console.log
# Ensure the line with the checkmark is correct
$content = $content.Replace("console.log([GPU] ✅ Préférence GPU ajoutée au Registre avec succès);", "console.log('[GPU] ✅ Préférence GPU ajoutée au Registre avec succès');")

$content | Set-Content $file -Encoding UTF8
Write-Host "Home.js sanitized."
