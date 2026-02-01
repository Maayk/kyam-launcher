const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const crypto = require('crypto');
const StreamZip = require('node-stream-zip');
const { downloadFile } = require('./utils');
const { getRemoteConfig } = require('./updater');
const { getSettings } = require('./config');
const { setActivity } = require('./discord');
const { ensureJavaInstalled } = require('./javaManager');
const { patchGame, patchClient, patchServer } = require('./patcher');
const { _trackEvent } = require('../analytics');

const USER_AGENT = "Battly (https://github.com/1ly4s0/Battly4Hytale, 1.0.0)";


async function fetchAuthTokens(uuid, name) {
    const authServerUrl = "https://sessions.sanasol.ws";
    try {
        console.log(`Solicitando tokens de autenticación reales a ${authServerUrl}`);

        const response = await fetch(`${authServerUrl}/game-session/child`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': USER_AGENT
            },
            body: JSON.stringify({
                uuid: uuid,
                name: name,
                scopes: ['hytale:server', 'hytale:client']
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server returned ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log("Tokens obtenidos correctamente del servidor.");
        return {
            identityToken: data.IdentityToken || data.identityToken,
            sessionToken: data.SessionToken || data.sessionToken
        };
    } catch (e) {
        console.error("Error obteniendo tokens reales, usando fallback local:", e);
        return generateLocalTokens(uuid, name);
    }
}

async function launchGame(event, username) {
    console.log(`Solicitud de inicio para: ${username}`);
    _trackEvent('game_launch_attempt', { username: username });
    const win = BrowserWindow.fromWebContents(event.sender);

    const hytaleRoot = path.join(app.getPath('appData'), 'Hytale');

    const gameDir = path.join(hytaleRoot, 'install', 'release', 'package', 'game', 'latest');
    const executablePath = path.join(gameDir, 'Client', 'HytaleClient.exe');
    const userDir = path.join(hytaleRoot, 'UserData');


    await fs.ensureDir(userDir);


    let javaExec;
    try {
        javaExec = await ensureJavaInstalled(event);
    } catch (e) {
        console.error("Java Error:", e);
        event.reply('launch-error', `Error Java: ${e.message}`);
        return;
    }


    if (!fs.existsSync(executablePath)) {
        try {
            await patchGame(gameDir, event);
        } catch (e) {
            console.error("Game Patch Error:", e);
            event.reply('launch-error', `Error instalando juego: ${e.message}`);
            return;
        }
    }


    try {
        if (fs.existsSync(executablePath)) {
            await patchClient(executablePath, event);

            const serverPath = path.join(gameDir, 'Server', 'HytaleServer.jar');
            if (fs.existsSync(serverPath)) {
                await patchServer(serverPath, javaExec, event);
            } else {
                console.warn("Server JAR not found at", serverPath);
            }

        } else {
            throw new Error("Game executable not found after patching.");
        }
    } catch (e) {
        console.error("Client Patch Error:", e);
        event.reply('launch-error', `Error parcheando cliente: ${e.message}`);
        return;
    }

    event.reply('launch-status', 'Lanzando Hytale...');

    const uuid = crypto.randomUUID();

    const tokens = await fetchAuthTokens(uuid, username);

    const settings = getSettings();
    const args = [
        '--app-dir', gameDir,
        '--user-dir', userDir,
        '--java-exec', settings.useCustomJava && settings.customJavaPath ? settings.customJavaPath : javaExec,
        '--auth-mode', 'authenticated',
        '--uuid', uuid,
        '--name', username,
        '--identity-token', tokens.identityToken,
        '--session-token', tokens.sessionToken
    ];

    console.log("Ejecutando:", executablePath, args);

    setActivity('Jugando a Hytale', `Jugador: ${username}`, 'logo', 'Hytale');

    if (settings.hideLauncher && win) {
        win.hide();
    }

    const child = spawn(executablePath, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });

    child.stdout.on('data', (data) => {
        console.log(`[Game]: ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`[Game Error]: ${data.toString().trim()}`);
    });

    child.on('error', (err) => {
        console.error("Failed to start game process:", err);
        event.reply('launch-error', `Error al iniciar proceso: ${err.message}`);
        if (win) {
            win.show();
            win.focus();
        }
    });

    child.on('close', (code) => {
        console.log(`Game process exited with code ${code}`);
        if (win) {
            setActivity('En el Launcher');
            win.show();
            win.focus();
            event.reply('launch-status', '');
        }

        if (code !== 0) {
            event.reply('launch-error', `El juego se cerró con código: ${code}`);
        } else {
            event.reply('launch-success', 'Juego terminado');
        }
    });

    child.unref();
    event.reply('launch-success', 'Juego iniciado');
}

function generateLocalTokens(uuid, name) {

    const authServerUrl = "https://sessions.sanasol.ws";
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 36000;

    const header = Buffer.from(JSON.stringify({
        alg: 'EdDSA',
        kid: '2025-10-01',
        typ: 'JWT'
    })).toString('base64url');

    const identityPayload = Buffer.from(JSON.stringify({
        sub: uuid,
        name: name,
        username: name,
        entitlements: ['game.base'],
        scope: 'hytale:server hytale:client',
        iat: now,
        exp: exp,
        iss: authServerUrl,
        jti: crypto.randomUUID()
    })).toString('base64url');

    const sessionPayload = Buffer.from(JSON.stringify({
        sub: uuid,
        scope: 'hytale:server',
        iat: now,
        exp: exp,
        iss: authServerUrl,
        jti: crypto.randomUUID()
    })).toString('base64url');

    const signature = crypto.randomBytes(64).toString('base64url');

    return {
        identityToken: `${header}.${identityPayload}.${signature}`,
        sessionToken: `${header}.${sessionPayload}.${signature}`
    };
}

module.exports = { launchGame };
