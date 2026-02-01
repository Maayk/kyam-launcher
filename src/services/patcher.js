const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { execFile } = require('child_process');
const { downloadFile } = require('./utils');
const { _trackEvent } = require('../analytics');
const StreamZip = require('node-stream-zip');
const os = require('os');
const serverPatcher = require('./serverPatcher');

const CONFIG = {
    toolsDir: path.join(app.getPath('appData'), 'Hytale', 'tools'),
    butlerBin: process.platform === 'win32' ? 'butler.exe' : 'butler',
    originalDomain: 'hytale.com',
    targetDomain: 'sanasol.ws',
    patchFlagFile: '.patched_custom',
    primaryPatch: '4.pwr',
    fallbackPatch: '5.pwr',
    oldDiscord: '.gg/hytale',
    newDiscord: '.gg/98SsAX7Ks9'
};

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


async function updateGameFiles(gameDir, event) {
    const patcherBin = await ensureTools(event);

    const sysOs = process.platform === 'win32' ? 'windows' :
        process.platform === 'darwin' ? 'darwin' : 'linux';
    const sysArch = 'amd64';

    const patchUrlBase = `https://game-patches.hytale.com/patches/${sysOs}/${sysArch}/release/0/`;
    const cachePath = path.join(app.getPath('appData'), 'Hytale', 'cache');
    await fs.ensureDir(cachePath);

    const targetPatchFile = path.join(cachePath, CONFIG.primaryPatch);

    if (!await fs.pathExists(targetPatchFile)) {
        if (event) event.reply('launch-status', 'status_fetching_patch');

        try {
            console.log(`Attempting download: ${CONFIG.primaryPatch}`);
            await downloadFile(patchUrlBase + CONFIG.primaryPatch, targetPatchFile, event);
            _trackEvent('hytale_patch_download', { patch: CONFIG.primaryPatch });
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
                _trackEvent('hytale_install_error', { error: stderr || error.message });
                reject(new Error(`Update failed: ${stderr || error.message}`));
            } else {
                console.log("Game files updated successfully.");
                _trackEvent('hytale_install_success', { patch: CONFIG.primaryPatch });
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

