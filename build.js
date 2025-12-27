const fs = require("fs");
const os = require("os");

const builder = require('electron-builder')
const JavaScriptObfuscator = require('javascript-obfuscator');
const nodeFetch = require('node-fetch')
const png2icons = require('png2icons');
const { Jimp, JimpMime } = require('jimp');

const { productName, version, repository } = require('./package.json');
const repoURL = repository.url.replace("git+", "").replace(".git", "").replace("https://github.com/", "").split("/");
const repoOwner = repoURL[0];
const repoName = repoURL[1];

class Index {
    async init() {
        process.env.ELECTRON_BUILDER_ALLOW_HANDLE_SYMLINK_AS_FILE = "true";
        this.obf = true
        this.Fileslist = []
        for (const val of process.argv) {
            if (val.startsWith('--icon')) {
                await this.iconSet(val.split('=')[1]);
            }

            if (val.startsWith('--obf')) {
                this.obf = JSON.parse(val.split('=')[1])
                this.Fileslist = this.getFiles("src");
            }

            if (val.startsWith('--build')) {
                let buildType = val.split('=')[1]
                if (buildType === 'platform') await this.buildPlatform();
            }
        }
    }

    async Obfuscate() {
        if (fs.existsSync("./app")) fs.rmSync("./app", { recursive: true })

        for (let path of this.Fileslist) {
            let fileName = path.split('/').pop()
            let extFile = fileName.split(".").pop()
            let folder = path.replace(`/${fileName}`, '').replace('src', 'app')

            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })

            if (extFile === 'js') {
                let code = fs.readFileSync(path, "utf8");
                code = code.replace(/src\//g, 'app/');
                if (this.obf) {
                    await new Promise((resolve) => {
                        console.log(`Obfuscate ${path}`);
                        let obf = JavaScriptObfuscator.obfuscate(code, { optionsPreset: 'medium-obfuscation', disableConsoleOutput: false });
                        resolve(fs.writeFileSync(`${folder}/${fileName}`, obf.getObfuscatedCode(), { encoding: "utf-8" }));
                    })
                } else {
                    console.log(`Copy ${path}`);
                    fs.writeFileSync(`${folder}/${fileName}`, code, { encoding: "utf-8" });
                }
            } else {
                fs.copyFileSync(path, `${folder}/${fileName}`);
            }
        }
    }


    async buildPlatform() {
        // Vérifier si la release existe déjà sur GitHub
        // On ignore cette vérification en CI car le workflow crée la release juste avant le build
        if (process.env.GITHUB_ACTIONS) {
            console.log(`[Build] Environnement CI détecté - Ignorer la vérification de la release.`);
        } else {
            console.log(`[Build] Vérification de l'existence de la version v${version} sur GitHub...`);
            try {
                // Vérifier avec et sans le prefixe 'v' car le workflow utilise la version brute
                const checkTags = [version, `v${version}`];
                let exists = false;

                for (const tag of checkTags) {
                    const response = await nodeFetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases/tags/${tag}`);
                    if (response.status === 200) {
                        exists = true;
                        console.error(`\x1b[31m[Error] La release ${tag} existe déjà sur GitHub !\x1b[0m`);
                        break;
                    }
                }

                if (exists) {
                    console.error(`\x1b[31m[Error] Veuillez augmenter la version dans package.json avant de build.\x1b[0m`);
                    process.exit(1);
                } else {
                    console.log(`[Build] La version ${version} n'existe pas encore sur GitHub. Continuation...`);
                }
            } catch (error) {
                console.error(`[Build] Erreur lors de la vérification de la release:`, error.message);
                console.warn(`[Build] On continue le build malgré l'erreur de vérification.`);
            }
        }

        await this.Obfuscate();
        const platform = os.platform();

        // Vérifier et générer l'icône macOS si nécessaire
        if (platform === 'darwin') {
            const iconPath = "./app/assets/images/icon.icns";
            if (!fs.existsSync(iconPath)) {
                console.warn("⚠️  Attention: icon.icns non trouvé. Génération depuis icon.png...");
                const pngPath = "./app/assets/images/icon.png";
                if (fs.existsSync(pngPath)) {
                    const { Jimp, JimpMime } = require('jimp');
                    const png2icons = require('png2icons');
                    const image = await Jimp.read(pngPath);
                    const buffer = await image.resize({ w: 256, h: 256 }).getBuffer(JimpMime.png);
                    fs.writeFileSync(iconPath, png2icons.createICNS(buffer, png2icons.BILINEAR, 0));
                    console.log("✅ icon.icns généré avec succès !");
                } else {
                    console.error("❌ Erreur: icon.png non trouvé. Utilisez 'npm run icon' pour générer les icônes.");
                }
            }
        }
        const config = {
            generateUpdatesFilesForAllChannels: false,
            appId: "com.earthkingdoms.launcher",
            productName: productName,
            copyright: '© 2025 EarthKingdoms',
            // Remplacer les espaces par des tirets pour correspondre au format dans latest.yml
            // latest.yml référence "EarthKingdoms-Launcher-win-x64.exe" (avec des tirets)
            artifactName: productName.replace(/\s+/g, '-') + "-${os}-${arch}.${ext}",
            extraMetadata: { main: 'app/app.js' },
            files: ["app/**/*", "package.json", "LICENSE.md"],
            directories: {
                "output": "dist"
            },
            compression: 'normal',
            asar: true,
            electronDownload: {
                cache: "./node_modules/.cache/electron"
            },
            nodeGypRebuild: false,
            npmRebuild: true,
            publish: [{
                provider: "github",
                releaseType: 'release',
            }]
        };

        if (platform === 'win32') {
            config.win = {
                icon: "./app/assets/images/icon.ico",
                target: [{ target: "nsis", arch: "x64" }]
            };
            config.nsis = {
                oneClick: true,
                allowToChangeInstallationDirectory: false,
                createDesktopShortcut: true,
                runAfterFinish: true,
                // S'assurer que le nom du fichier généré correspond au format dans latest.yml
                artifactName: productName.replace(/\s+/g, '-') + "-${os}-${arch}.${ext}"
            };
        } else if (platform === 'darwin') {
            config.mac = {
                icon: "./app/assets/images/icon.icns",
                category: "public.app-category.games",
                target: [{ target: "dmg", arch: "universal" }, { target: "zip", arch: "universal" }]
            };

            // Copier les fichiers d'aide dans le build si disponibles
            if (!fs.existsSync("./app")) fs.mkdirSync("./app", { recursive: true });

            const readmePath = "./scripts/README-MACOS.txt";
            if (fs.existsSync(readmePath)) {
                fs.copyFileSync(readmePath, "./app/README-MACOS.txt");
            }

            const installScriptPath = "./scripts/install.command";
            if (fs.existsSync(installScriptPath)) {
                fs.copyFileSync(installScriptPath, "./app/install.command");
                // Rendre le script exécutable
                fs.chmodSync("./app/install.command", 0o755);
            }

            config.dmg = {
                title: `${productName} ${require('./package.json').version}`,
                background: null,
                icon: "./app/assets/images/icon.icns",
                iconSize: 100,
                contents: [
                    { x: 380, y: 280, type: "link", path: "/Applications" },
                    { x: 110, y: 280, type: "file", path: "EarthKingdoms Launcher.app" },
                    { x: 110, y: 180, type: "file", path: "install.command" },
                    { x: 110, y: 120, type: "file", path: "README-MACOS.txt" }
                ],
                window: {
                    width: 540,
                    height: 400
                }
            };
        } else {
            config.linux = {
                icon: "./app/assets/images/icon.png",
                target: [{ target: "AppImage", arch: "x64" }]
            };
        }

        builder.build({
            targets: platform === 'win32' ? builder.Platform.WINDOWS.createTarget() : (platform === 'darwin' ? builder.Platform.MAC.createTarget() : builder.Platform.LINUX.createTarget()),
            config: config
        }).then(() => {
            console.log('Build done !')
        }).catch(err => {
            console.error('Error during build !', err)
        })
    }

    getFiles(path, file = []) {
        if (fs.existsSync(path)) {
            let files = fs.readdirSync(path);
            if (files.length === 0) file.push(path);
            for (let i in files) {
                let name = `${path}/${files[i]}`;
                if (fs.statSync(name).isDirectory()) this.getFiles(name, file);
                else file.push(name);
            }
        }
        return file;
    }

    async iconSet(urlOrPath) {
        let image;

        // Vérifier si c'est une URL ou un chemin local
        if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
            // C'est une URL, télécharger l'image
            const response = await nodeFetch(urlOrPath)
            if (response.status == 200) {
                const buffer = await response.buffer()
                image = await Jimp.read(buffer);
            } else {
                console.log('Connection error !')
                return;
            }
        } else {
            // C'est un chemin local
            if (!fs.existsSync(urlOrPath)) {
                console.log(`File not found: ${urlOrPath}`)
                return;
            }
            image = await Jimp.read(urlOrPath);
        }

        // Redimensionner et générer les icônes
        image = await image.resize({ w: 256, h: 256 }).getBuffer(JimpMime.png);
        fs.writeFileSync("src/assets/images/icon.icns", png2icons.createICNS(image, png2icons.BILINEAR, 0));
        fs.writeFileSync("src/assets/images/icon.ico", png2icons.createICO(image, png2icons.HERMITE, 0, false));
        fs.writeFileSync("src/assets/images/icon.png", image);
        console.log('✅ Icônes générées avec succès !')
    }
}

new Index().init();