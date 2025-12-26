const fs = require("fs");
const os = require("os");

const builder = require('electron-builder')
const JavaScriptObfuscator = require('javascript-obfuscator');
const nodeFetch = require('node-fetch')
const png2icons = require('png2icons');
const { Jimp, JimpMime } = require('jimp');

const { productName } = require('./package.json');

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
        await this.Obfuscate();
        const platform = os.platform();
        const config = {
            generateUpdatesFilesForAllChannels: false,
            appId: "EarthKingdoms Launcher",
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

    async iconSet(url) {
        const response = await nodeFetch(url)
        if (response.status == 200) {
            const buffer = await response.buffer()
            let image = await Jimp.read(buffer);
            image = await image.resize({ w: 256, h: 256 }).getBuffer(JimpMime.png);
            fs.writeFileSync("src/assets/images/icon.icns", png2icons.createICNS(image, png2icons.BILINEAR, 0));
            fs.writeFileSync("src/assets/images/icon.ico", png2icons.createICO(image, png2icons.HERMITE, 0, false));
            fs.writeFileSync("src/assets/images/icon.png", image);
            //console.log('New icon set !')
        } else {
            console.log('Connection error !')
        }
    }
}

new Index().init();