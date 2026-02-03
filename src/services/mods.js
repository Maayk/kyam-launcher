const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const { app, BrowserWindow } = require('electron');
const { downloadFile } = require('./utils');

// Carrega configurações da API do config.json
const configPath = path.join(app.getAppPath(), 'config.json');
const config = fs.readJsonSync(configPath);

const CF_API_KEY = config.api?.curseforge_key || '';
const CF_API_URL = config.api?.curseforge_url || 'https://api.curseforge.com/v1';
const GAME_ID = config.api?.hytale_game_id || 70216;


function registerModHandlers(ipcMain) {
    const modsDir = path.join(app.getPath('appData'), 'Kyamtale', 'UserData', 'Mods');

    ipcMain.handle('search-mods', async (event, query = '') => {
        try {
            const headers = {
                'x-api-key': CF_API_KEY,
                'Accept': 'application/json'
            };

            let response;
            if (query || GAME_ID === 70216) {
                response = await axios.get(`${CF_API_URL}/mods/search`, {
                    params: {
                        gameId: GAME_ID,
                        searchFilter: query,
                        sortField: 2,
                        sortOrder: 'desc'
                    },
                    headers
                });
            } else {
                response = await axios.post(`${CF_API_URL}/mods/featured`, {
                    gameId: GAME_ID,
                    excludedModIds: [],
                    gameVersionTypeId: 0
                }, { headers });
            }

            let modsRaw = [];
            if (query || GAME_ID === 70216) {
                modsRaw = response.data.data;
            } else {
                const featured = response.data.data.featured || [];
                const popular = response.data.data.popular || [];
                const map = new Map();
                [...featured, ...popular].forEach(m => map.set(m.id, m));
                modsRaw = Array.from(map.values());
            }

            const hytaleMods = modsRaw.map(mod => ({
                id: mod.id,
                name: mod.name,
                summary: mod.summary,
                description: null,
                logo: mod.logo,
                author: mod.authors && mod.authors.length > 0 ? mod.authors[0].name : 'Unknown',
                downloads: mod.downloadCount,
                lastUpdated: new Date(mod.dateModified).toLocaleDateString(),
                version: mod.latestFiles && mod.latestFiles.length > 0 ? mod.latestFiles[0].displayName : 'Unknown'
            }));

            return { success: true, data: hytaleMods };

        } catch (error) {
            console.error("CF API Error:", error?.response?.data || error.message);
            return { success: false, error: "Error connecting to CurseForge: " + error.message };
        }
    });

    ipcMain.handle('get-mod-description', async (event, modId) => {
        try {
            const headers = { 'x-api-key': CF_API_KEY, 'Accept': 'application/json' };
            const response = await axios.get(`${CF_API_URL}/mods/${modId}/description`, { headers });
            return { success: true, data: response.data.data };
        } catch (error) {
            console.error("CF Description Error:", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('list-installed-mods', async () => {
        try {
            await fs.ensureDir(modsDir);
            const files = await fs.readdir(modsDir);

            const mods = files.map(file => {
                const isEnabled = !file.endsWith('.disabled');
                return {
                    name: file.replace('.disabled', ''),
                    fileName: file,
                    enabled: isEnabled,
                    path: path.join(modsDir, file)
                };
            });
            return { success: true, data: mods };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('install-mod', async (event, modData) => {
        try {
            await fs.ensureDir(modsDir);
            event.sender.send('launch-status', `Buscando atualizações para ${modData.name}...`);

            const headers = { 'x-api-key': CF_API_KEY, 'Accept': 'application/json' };
            const filesResponse = await axios.get(`${CF_API_URL}/mods/${modData.id}/files`, {
                headers,
                params: { pageSize: 1 }
            });

            const files = filesResponse.data.data;
            if (!files || files.length === 0) {
                throw new Error("Nenhum arquivo descargável encontrado para este mod.");
            }

            const latestFile = files[0];
            const downloadUrl = latestFile.downloadUrl;
            const fileName = latestFile.fileName;
            const destPath = path.join(modsDir, fileName);

            if (!downloadUrl) {
                throw new Error("Nenhuma URL de download direta encontrada (provavelmente externo).");
            }

            event.sender.send('launch-status', `Baixando ${fileName}...`);
            await downloadFile(downloadUrl, destPath, event);

            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('toggle-mod', async (event, fileName) => {
        try {
            const oldPath = path.join(modsDir, fileName);
            let newPath;

            if (fileName.endsWith('.disabled')) {
                newPath = path.join(modsDir, fileName.replace('.disabled', ''));
            } else {
                newPath = path.join(modsDir, fileName + '.disabled');
            }

            await fs.rename(oldPath, newPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-mod', async (event, fileName) => {
        try {
            await fs.remove(path.join(modsDir, fileName));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { registerModHandlers };
