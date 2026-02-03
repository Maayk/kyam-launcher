const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { execFile } = require('child_process');
const { downloadFile, verifyFileHash } = require('./utils');
const StreamZip = require('node-stream-zip');
const os = require('os');
const { fileURLToPath } = require('url');
const serverPatcher = require('./serverPatcher');

const CONFIG = {
    toolsDir: path.join(app.getPath('appData'), 'Kyamtale', 'tools'),
    butlerBin: process.platform === 'win32' ? 'butler.exe' : 'butler',
    originalDomain: 'hytale.com',
    targetDomain: 'sanasol.ws',
    patchFlagFile: '.patched_custom',
    primaryPatch: '4.pwr',
    fallbackPatch: '5.pwr',
    oldDiscord: '.gg/hytale',
    newDiscord: '.gg/98SsAX7Ks9',
    // Fix: Check resourcesPath for production build (extraResources)
    localConfigPath: fs.existsSync(path.join(app.getAppPath(), 'config.json'))
        ? path.join(app.getAppPath(), 'config.json')
        : path.join(process.resourcesPath, 'config.json'),
    localCdnDir: path.join(app.getAppPath(), 'cdn'),
    extractScanMaxDepth: 6,
    extractScanMaxEntries: 200
};

function isHttpUrl(value) {
    return /^https?:\/\//i.test(value || '');
}

function normalizeConfigChannel(value) {
    return value === 'beta' ? 'beta' : 'latest';
}

function getHytaleConfig(cfg, channel) {
    const normalized = normalizeConfigChannel(channel);
    if (cfg && cfg.hytale) {
        if (cfg.hytale[normalized]) return cfg.hytale[normalized];
        if (cfg.hytale.latest) return cfg.hytale.latest;
        if (cfg.hytale.url) return cfg.hytale;
    }
    return null;
}

async function resolveLocalArchivePath(channel) {
    let configUrl = null;

    if (await fs.pathExists(CONFIG.localConfigPath)) {
        try {
            const cfg = await fs.readJson(CONFIG.localConfigPath);
            const hytaleConfig = getHytaleConfig(cfg, channel);
            configUrl = hytaleConfig && hytaleConfig.url ? hytaleConfig.url : null;
        } catch (e) {
            configUrl = null;
        }
    }

    if (configUrl && isHttpUrl(configUrl)) {
        return { url: configUrl, isRemote: true };
    }

    let candidate = null;
    if (configUrl && !isHttpUrl(configUrl)) {
        if (configUrl.startsWith('file://')) {
            candidate = fileURLToPath(configUrl);
        } else if (path.isAbsolute(configUrl)) {
            candidate = configUrl;
        } else {
            candidate = path.join(app.getAppPath(), configUrl);
        }
    }

    if (candidate && await fs.pathExists(candidate)) {
        return { path: candidate, isRemote: false };
    }

    if (await fs.pathExists(CONFIG.localCdnDir)) {
        const entries = await fs.readdir(CONFIG.localCdnDir);
        const archives = entries.filter((file) => /\.zip$/i.test(file));

        if (archives.length) {
            const sorted = await Promise.all(archives.map(async (file) => {
                const fullPath = path.join(CONFIG.localCdnDir, file);
                const stat = await fs.stat(fullPath);
                return { fullPath, mtime: stat.mtimeMs };
            }));

            sorted.sort((a, b) => b.mtime - a.mtime);
            return { path: sorted[0].fullPath, isRemote: false };
        }
    }

    return null;
}

async function extractArchive(archivePath, destDir) {
    const ext = path.extname(archivePath).toLowerCase();
    await fs.ensureDir(destDir);

    if (ext === '.zip') {
        const zip = new StreamZip.async({ file: archivePath });
        await zip.extract(null, destDir);
        await zip.close();
        return;
    }

    throw new Error(`Unsupported archive format: ${ext}`);
}

async function moveDirContents(sourceDir, targetDir) {
    const entries = await fs.readdir(sourceDir);
    for (const entry of entries) {
        await fs.move(path.join(sourceDir, entry), path.join(targetDir, entry), { overwrite: true });
    }
}

async function resolveExtractedGameRoot(baseDir) {
    const directCandidates = [
        baseDir,
        path.join(baseDir, 'install', 'release', 'package', 'game'),
        path.join(baseDir, 'release', 'package', 'game'),
        path.join(baseDir, 'package', 'game')
    ];

    for (const candidate of directCandidates) {
        if (await fs.pathExists(path.join(candidate, 'Client'))) {
            return candidate;
        }
    }

    const entries = await fs.readdir(baseDir);
    if (entries.length !== 1) return null;

    const onlyPath = path.join(baseDir, entries[0]);
    const stat = await fs.stat(onlyPath);
    if (!stat.isDirectory()) return null;

    const nestedCandidates = [
        onlyPath,
        path.join(onlyPath, 'install', 'release', 'package', 'game'),
        path.join(onlyPath, 'release', 'package', 'game'),
        path.join(onlyPath, 'package', 'game')
    ];

    for (const candidate of nestedCandidates) {
        if (await fs.pathExists(path.join(candidate, 'Client'))) {
            return candidate;
        }
    }

    return await findGameRootByScan(baseDir);
}

async function findGameRootByScan(baseDir) {
    const queue = [{ dir: baseDir, depth: 0 }];
    let scanned = 0;

    while (queue.length) {
        const { dir, depth } = queue.shift();
        scanned += 1;
        if (scanned > CONFIG.extractScanMaxEntries) return null;

        const clientDir = path.join(dir, 'Client');
        if (await fs.pathExists(clientDir)) {
            const clientExe = path.join(clientDir, 'HytaleClient.exe');
            if (await fs.pathExists(clientExe)) return dir;
            return dir;
        }

        if (depth >= CONFIG.extractScanMaxDepth) continue;

        let entries = null;
        try {
            entries = await fs.readdir(dir);
        } catch (e) {
            entries = null;
        }

        if (!entries || !entries.length) continue;

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            let stat = null;
            try {
                stat = await fs.stat(fullPath);
            } catch (e) {
                stat = null;
            }
            if (stat && stat.isDirectory()) {
                queue.push({ dir: fullPath, depth: depth + 1 });
            }
        }
    }

    return null;
}

async function tryInstallFromLocalArchive(gameDir, event, channel) {
    const archiveSource = await resolveLocalArchivePath(channel);
    if (!archiveSource) return false;

    let archivePath = archiveSource.path;
    if (archiveSource.isRemote && archiveSource.url) {
        const cachePath = path.join(app.getPath('appData'), 'Kyamtale', 'cache');
        await fs.ensureDir(cachePath);
        let fileName = `hytale-${normalizeConfigChannel(channel)}.zip`;
        try {
            const urlObj = new URL(archiveSource.url);
            const baseName = path.basename(urlObj.pathname);
            if (baseName) fileName = baseName;
        } catch (e) {
        }
        archivePath = path.join(cachePath, fileName);
        await fs.remove(archivePath).catch(() => { });
        await downloadFile(archiveSource.url, archivePath, event);
    }

    if (event) event.reply('launch-status', 'status_extracting');
    console.log('Installing game from archive:', archivePath);

    const cachePath = path.join(app.getPath('appData'), 'Kyamtale', 'cache');
    const tempDir = path.join(cachePath, `extract_${normalizeConfigChannel(channel)}`);
    await fs.remove(tempDir).catch(() => { });
    await extractArchive(archivePath, tempDir);

    const sourceDir = await resolveExtractedGameRoot(tempDir);
    if (!sourceDir) {
        await fs.remove(tempDir).catch(() => { });
        return false;
    }

    await fs.ensureDir(gameDir);
    await moveDirContents(sourceDir, gameDir);
    await fs.remove(tempDir).catch(() => { });
    return true;
}

function encodeUtf16(str) {
    const buf = Buffer.alloc(str.length * 2);
    for (let i = 0; i < str.length; i++) {
        buf.writeUInt16LE(str.charCodeAt(i), i * 2);
    }
    return buf;
}

function getPatternIndices(buffer, pattern) {
    const indices = [];
    let pos = 0;
    while (pos < buffer.length) {
        const index = buffer.indexOf(pattern, pos);
        if (index === -1) break;
        indices.push(index);
        pos = index + 1;
    }
    return indices;
}

function replaceBinaryStrings(buffer, replacementMap) {
    let totalReplacements = 0;
    let modifiedBuffer = Buffer.from(buffer);

    for (const { type, oldVal, newVal } of replacementMap) {
        if (type === 'simple') {
            const oldBytes = encodeUtf16(oldVal);
            const newBytes = encodeUtf16(newVal);
            const matches = getPatternIndices(modifiedBuffer, oldBytes);

            for (const pos of matches) {
                newBytes.copy(modifiedBuffer, pos);
                totalReplacements++;
            }
        } else if (type === 'smart_domain') {
            const oldBytesStub = encodeUtf16(oldVal.slice(0, -1));
            const newBytesStub = encodeUtf16(newVal.slice(0, -1));

            const oldEndByte = oldVal.charCodeAt(oldVal.length - 1);
            const newEndByte = newVal.charCodeAt(newVal.length - 1);

            const matches = getPatternIndices(modifiedBuffer, oldBytesStub);

            for (const pos of matches) {
                const endBytePos = pos + oldBytesStub.length;
                if (endBytePos + 1 > modifiedBuffer.length) continue;

                if (modifiedBuffer[endBytePos] === oldEndByte) {
                    newBytesStub.copy(modifiedBuffer, pos);
                    modifiedBuffer[endBytePos] = newEndByte;
                    totalReplacements++;
                }
            }
        }
    }

    return { buffer: modifiedBuffer, count: totalReplacements };
}

async function ensureTools(event) {
    const butlerPath = path.join(CONFIG.toolsDir, CONFIG.butlerBin);
    if (await fs.pathExists(butlerPath)) {
        return butlerPath;
    }

    await fs.ensureDir(CONFIG.toolsDir);
    const zipPath = path.join(CONFIG.toolsDir, 'butler.zip');

    let downloadUrl = '';
    const platform = process.platform;
    const arch = os.arch();

    if (platform === 'win32') {
        downloadUrl = 'https://broth.itch.zone/butler/windows-amd64/LATEST/archive/default';
    } else if (platform === 'darwin') {
        downloadUrl = (arch === 'arm64')
            ? 'https://broth.itch.zone/butler/darwin-arm64/LATEST/archive/default'
            : 'https://broth.itch.zone/butler/darwin-amd64/LATEST/archive/default';
    } else if (platform === 'linux') {
        downloadUrl = 'https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default';
    } else {
        throw new Error('OS not supported for Butler');
    }

    if (event) event.reply('launch-status', 'status_downloading_tools');
    console.log('Fetching dependencies from', downloadUrl);
    await downloadFile(downloadUrl, zipPath, event);

    if (event) event.reply('launch-status', 'status_configuring_tools');
    const zip = new StreamZip.async({ file: zipPath });
    await zip.extract(null, CONFIG.toolsDir);
    await zip.close();

    await fs.remove(zipPath);

    if (platform !== 'win32') {
        await fs.chmod(butlerPath, 0o755);
    }
    return butlerPath;
}

async function applyBinaryMods(clientPath, event) {
    const trackingFile = clientPath + CONFIG.patchFlagFile;

    if (await fs.pathExists(trackingFile)) {
        try {
            const meta = await fs.readJson(trackingFile);
            if (meta.target === CONFIG.targetDomain) {
                console.log("Binary already modified.");
                return;
            }
        } catch (e) { }
    }

    if (event) event.reply('launch-status', 'status_patching_client');
    console.log("Processing binary:", clientPath);

    await fs.copy(clientPath, clientPath + '.bak', { overwrite: false }).catch(() => { });

    const rawData = await fs.readFile(clientPath);

    const modifications = [
        { type: 'smart_domain', oldVal: CONFIG.originalDomain, newVal: CONFIG.targetDomain },
        { type: 'simple', oldVal: CONFIG.oldDiscord, newVal: CONFIG.newDiscord }
    ];

    const { buffer: newData, count } = replaceBinaryStrings(rawData, modifications);

    console.log(`Applied ${count} binary replacements.`);

    await fs.writeFile(clientPath, newData);

    await fs.writeJson(trackingFile, {
        date: new Date().toISOString(),
        original: CONFIG.originalDomain,
        target: CONFIG.targetDomain
    });
    console.log("Client modifications finished.");
}


async function updateGameFiles(gameDir, event, channel) {
    const installedFromLocal = await tryInstallFromLocalArchive(gameDir, event, channel);
    if (installedFromLocal) return;

    // Se falhar a instalação do arquivo local/custom para Beta, NÃO deve fazer fallback para o patch oficial (que baixaria a versão Legacy)
    if (channel !== 'latest') {
        throw new Error(`Failed to install custom version for channel '${channel}'. Verifique o arquivo de configuração ou a URL.`);
    }

    const patcherBin = await ensureTools(event);

    const sysOs = process.platform === 'win32' ? 'windows' :
        process.platform === 'darwin' ? 'darwin' : 'linux';
    const sysArch = 'amd64';

    const patchUrlBase = `https://game-patches.hytale.com/patches/${sysOs}/${sysArch}/release/0/`;
    const cachePath = path.join(app.getPath('appData'), 'Kyamtale', 'cache');
    await fs.ensureDir(cachePath);

    const targetPatchFile = path.join(cachePath, CONFIG.primaryPatch);

    if (!await fs.pathExists(targetPatchFile)) {
        if (event) event.reply('launch-status', 'status_fetching_patch');

        try {
            console.log(`Attempting download: ${CONFIG.primaryPatch}`);
            console.log(`Attempting download: ${CONFIG.primaryPatch}`);
            await downloadFile(patchUrlBase + CONFIG.primaryPatch, targetPatchFile, event);

            // TODO: Adicionar hash conhecido para 4.pwr quando possível para aumentar segurança
            // const knownHash = "HASH_DO_ARQUIVO_4_PWR";
            // if (!await verifyFileHash(targetPatchFile, knownHash, 'sha256')) {
            //      throw new Error("Hash verification failed for game patch");
            // }
        } catch (err) {
            console.error(`Download failed for ${CONFIG.primaryPatch}, attempting fallback...`, err.message);

            const fallbackPath = path.join(cachePath, CONFIG.fallbackPatch);
            try {
                if (event) event.reply('launch-status', 'status_fallback_attempt');
                await downloadFile(patchUrlBase + CONFIG.fallbackPatch, fallbackPath, event);

                await fs.copy(fallbackPath, targetPatchFile);
            } catch (fallbackErr) {
                console.error("All download attempts failed.", fallbackErr);
                throw err;
            }
        }
    }

    const stagingArea = path.join(gameDir, 'staging_temp');
    await fs.ensureDir(gameDir);

    const patchArgs = ['apply', '--staging-dir', stagingArea, targetPatchFile, gameDir];

    if (event) event.reply('launch-status', 'status_updating_files');

    return new Promise((resolve, reject) => {
        execFile(patcherBin, patchArgs, { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
            if (await fs.pathExists(stagingArea)) {
                await fs.remove(stagingArea).catch(console.error);
            }
            if (error) {
                console.error("Patcher Output:", stdout);
                reject(new Error(`Update failed: ${stderr || error.message}`));
            } else {
                console.log("Game files updated successfully.");
                resolve();
            }
        });
    });
}

module.exports = {
    patchGame: updateGameFiles,
    patchClient: applyBinaryMods,
    patchServer: serverPatcher.patchServer.bind(serverPatcher)
};
