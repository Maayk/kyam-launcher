const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

const configPath = path.join(app.getPath('appData'), 'Kyamtale', 'user-settings.json');
const oldConfigPath = path.join(app.getPath('appData'), 'Battly4Hytale', 'user-settings.json');

const defaultSettings = {
    hideLauncher: true,
    gpuPreference: 'auto',
    gameChannel: 'latest',
    useCustomJava: false,
    customJavaPath: '',
    profiles: [],
    playerUUID: ''
};

let currentSettings = { ...defaultSettings };

async function loadSettings() {
    try {
        // Migra configurações do path antigo (Battly4Hytale) para o novo (Kyamtale)
        if (await fs.pathExists(oldConfigPath) && !(await fs.pathExists(configPath))) {
            console.log('Migrando configurações de Battly4Hytale para Kyamtale...');
            await fs.ensureDir(path.dirname(configPath));
            await fs.copy(oldConfigPath, configPath);
        }

        if (await fs.pathExists(configPath)) {
            const data = await fs.readJson(configPath);
            currentSettings = { ...defaultSettings, ...data };
        } else {
            await saveSettings();
        }
    } catch (e) {
        console.error("Error loading settings:", e);
    }
    return currentSettings;
}

async function saveSettings(settings) {
    if (settings) {
        currentSettings = { ...currentSettings, ...settings };
    }
    try {
        await fs.ensureDir(path.dirname(configPath));
        await fs.writeJson(configPath, currentSettings);
    } catch (e) {
        console.error("Error saving settings:", e);
    }
}

function getSettings() {
    return currentSettings;
}

module.exports = { loadSettings, saveSettings, getSettings };
