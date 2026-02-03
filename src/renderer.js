const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Módulos extraídos
const { ONBOARDING_CONFIG, sanitizeUsername, shakeElement } = require('./renderer/utils');
const { getSavedLang, loadLocale, t, applyTranslations, AVAILABLE_LANGS, defaultLang } = require('./renderer/i18n');
const { showCustomDialog, customAsk } = require('./renderer/dialog');
const { loadNews } = require('./renderer/news');

// Configurações
const SETTINGS_CONFIG = {
    defaultGameChannel: 'latest',
    gameChannels: ['latest', 'beta']
};

document.getElementById('minBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
});

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const hideLauncherCheck = document.getElementById('hideLauncherCheck');

hideLauncherCheck.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('save-settings', { hideLauncher: e.target.checked });
});


settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

const playBtn = document.getElementById('playBtn');
const usernameInput = document.getElementById('username');
const statusMsg = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const modsBtn = document.getElementById('modsBtn');
const homeGameChannel = document.getElementById('homeGameChannel');
const homeGameVersion = document.getElementById('homeGameVersion');

const homeView = document.getElementById('homeView');
const modsView = document.getElementById('modsView');

const tabDiscover = document.getElementById('tabDiscover');
const tabInstalled = document.getElementById('tabInstalled');
const discoverSection = document.getElementById('discoverSection');
const installedSection = document.getElementById('installedSection');

const modsList = document.getElementById('modsList');
const installedList = document.getElementById('installedList');
const modSearchInput = document.getElementById('modSearchInput');
const searchModsBtn = document.getElementById('searchModsBtn');

// Inicialização do locale precisa ser síncrona para garantir traduções corretas
(async () => {
    await loadLocale(getSavedLang());
    loadNews();
})();

const langSelect = document.getElementById('langSelect');
if (langSelect) {
    langSelect.value = getSavedLang();
    langSelect.addEventListener('change', (e) => {
        loadLocale(e.target.value);
    });
}

const savedUser = localStorage.getItem('hytale_username');
let originalUsername = savedUser || '';
if (savedUser) {
    usernameInput.value = savedUser;
}

const confirmNameBtn = document.getElementById('confirmNameBtn');

// Mostra botão de confirmação quando o nome é alterado
usernameInput.addEventListener('input', () => {
    const currentValue = usernameInput.value.trim();
    if (currentValue !== originalUsername && currentValue.length > 0) {
        confirmNameBtn.classList.add('visible');
    } else {
        confirmNameBtn.classList.remove('visible');
    }
});

// Confirma e salva o novo nome
// Função de Log de Atividades
function logActivity(message, type = 'normal') {
    const logContainer = document.getElementById('activityLog');
    if (!logContainer) return;

    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement('div');
    item.className = `log-item ${type}`;

    let icon = '';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'error') icon = '<i class="fas fa-exclamation-circle"></i>';
    if (type === 'loading') icon = '<div class="log-spinner"></div>';

    item.innerHTML = `
        <span class="log-time">${time}</span>
        ${icon}
        <span>${message}</span>
    `;

    logContainer.appendChild(item);

    // Auto scroll para o final
    logContainer.scrollTop = logContainer.scrollHeight;

    // Limita histórico (opcional)
    if (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Log inicial
setTimeout(() => {
    logActivity(t('status_init') || 'Bem-vindo ao KyamLauncher', 'normal');
}, 1000); // Pequeno delay pra animar na entrada

// Confirma e salva o novo nome
confirmNameBtn.addEventListener('click', () => {
    const newName = usernameInput.value.trim();
    if (newName.length > 0) {
        localStorage.setItem('hytale_username', newName);
        originalUsername = newName;
        confirmNameBtn.classList.remove('visible');

        logActivity(`Nome salvo: ${newName}`, 'success');
    }
});

const settingsPlayerName = document.getElementById('settingsPlayerName');
const openLocationBtn = document.getElementById('openLocationBtn');
const repairGameBtn = document.getElementById('repairGameBtn');
const gameChannelSelect = document.getElementById('gameChannelSelect');
const gpuDetectedText = document.getElementById('gpuDetectedText');
const useCustomJavaCheck = document.getElementById('useCustomJavaCheck');
const javaPathInput = document.getElementById('javaPathInput');
const browseJavaBtn = document.getElementById('browseJavaBtn');
const customJavaArea = document.getElementById('customJavaArea');
const gpuButtons = document.querySelectorAll('.gpu-btn');

let currentSettingsData = {};
let currentGameVersion = null;

const normalizeGameChannel = (value) => {
    return SETTINGS_CONFIG.gameChannels.includes(value) ? value : SETTINGS_CONFIG.defaultGameChannel;
};

const updateHomeGameVersion = () => {
    if (!homeGameVersion) return;
    homeGameVersion.textContent = currentGameVersion || '-';
};

const loadGameVersion = async (channel) => {
    try {
        const version = await ipcRenderer.invoke('get-hytale-version', channel);
        if (typeof version === 'string' && version.trim()) {
            currentGameVersion = version.trim();
        }
    } catch (e) {
        currentGameVersion = null;
    }
    updateHomeGameVersion();
};

const syncGameChannel = async () => {
    currentSettingsData = await ipcRenderer.invoke('get-settings');
    const channel = normalizeGameChannel(currentSettingsData.gameChannel);
    if (homeGameChannel) homeGameChannel.value = channel;
    if (gameChannelSelect) gameChannelSelect.value = channel;
    await loadGameVersion(channel);
};

syncGameChannel();

// Handler original de settings tabs removido - movido para depois de refreshGpuButtons()

let detectedGpus = { integrated: null, dedicated: null };

const updateGpuText = (pref) => {
    const textEl = document.getElementById('gpuDetectedText');
    if (!textEl) return;

    if (pref === 'integrated') {
        textEl.textContent = detectedGpus.integrated || 'No Integrated GPU detected';
        textEl.style.color = detectedGpus.integrated ? '#aaa' : '#ff4444';
    } else if (pref === 'dedicated') {
        textEl.textContent = detectedGpus.dedicated || 'No Dedicated GPU detected';
        textEl.style.color = detectedGpus.dedicated ? '#a855f7' : '#ff4444';
    } else {
        textEl.textContent = 'Auto: ' + (detectedGpus.dedicated || detectedGpus.integrated || 'System Default');
        textEl.style.color = '#00d9ff';
    }
};

const refreshGpuButtons = () => {
    const btns = document.querySelectorAll('.gpu-btn');
    btns.forEach(btn => {
        btn.onclick = function () {
            btns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            updateGpuText(this.getAttribute('data-val'));
        }
    });
};
refreshGpuButtons();

// Settings Tabs Handler
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsPages = document.querySelectorAll('.settings-page');

settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');

        settingsTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        settingsPages.forEach(page => {
            page.classList.remove('active');
            if (page.id === `settings-${targetTab}`) {
                page.classList.add('active');
            }
        });
    });
});

// Java custom area toggle
if (useCustomJavaCheck) {
    useCustomJavaCheck.addEventListener('change', () => {
        if (customJavaArea) {
            if (useCustomJavaCheck.checked) {
                customJavaArea.classList.remove('disabled');
            } else {
                customJavaArea.classList.add('disabled');
            }
        }
    });
}

if (openLocationBtn) {
    openLocationBtn.addEventListener('click', () => {
        ipcRenderer.send('open-game-location');
    });
}

if (browseJavaBtn) {
    browseJavaBtn.addEventListener('click', async () => {
        const path = await ipcRenderer.invoke('select-java-path');
        if (path) {
            javaPathInput.value = path;
        }
    });
}

if (useCustomJavaCheck) {
    useCustomJavaCheck.addEventListener('change', () => {
        updateJavaAreaState();
    });
}

function updateJavaAreaState() {
    if (useCustomJavaCheck && customJavaArea) {
        if (useCustomJavaCheck.checked) {
            customJavaArea.style.opacity = '1';
            customJavaArea.style.pointerEvents = 'auto';
        } else {
            customJavaArea.style.opacity = '0.5';
            customJavaArea.style.pointerEvents = 'none';
        }
    }
}

if (repairGameBtn) {
    repairGameBtn.onclick = async () => {
        const confirmed = await showCustomDialog(t('repair_confirm_title'), t('repair_confirm_msg'), true);
        if (confirmed) {
            const selectedChannel = normalizeGameChannel(homeGameChannel ? homeGameChannel.value : currentSettingsData.gameChannel);
            ipcRenderer.send('repair-game', selectedChannel);
            statusMsg.textContent = t('repair_started');
            settingsModal.classList.remove('active');
        }
    };
}

if (homeGameChannel) {
    homeGameChannel.addEventListener('change', async (e) => {
        const selectedChannel = normalizeGameChannel(e.target.value);
        e.target.value = selectedChannel;
        if (!currentSettingsData || !Object.keys(currentSettingsData).length) {
            currentSettingsData = await ipcRenderer.invoke('get-settings');
        }
        currentSettingsData = { ...currentSettingsData, gameChannel: selectedChannel };
        await ipcRenderer.invoke('save-settings', currentSettingsData);
        await loadGameVersion(selectedChannel);
    });
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
        currentSettingsData = await ipcRenderer.invoke('get-settings');

        if (settingsPlayerName) settingsPlayerName.value = usernameInput.value || currentSettingsData.playerName || '';
        if (hideLauncherCheck) hideLauncherCheck.checked = currentSettingsData.hideLauncher || false;
        if (gameChannelSelect) gameChannelSelect.value = normalizeGameChannel(currentSettingsData.gameChannel);
        if (homeGameChannel) homeGameChannel.value = normalizeGameChannel(currentSettingsData.gameChannel);

        const gpuPref = currentSettingsData.gpuPreference || 'auto';
        document.querySelectorAll('.gpu-btn').forEach(btn => {
            if (btn.getAttribute('data-val') === gpuPref) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        try {
            const gpuData = await ipcRenderer.invoke('get-gpu-info');
            if (typeof gpuData === 'object') {
                detectedGpus = gpuData;
            } else {
                detectedGpus = { integrated: gpuData, dedicated: gpuData };
            }
            updateGpuText(gpuPref);
        } catch (e) {
            console.error('Failed to load GPU info:', e);
            document.getElementById('gpuDetectedText').textContent = 'Error loading GPU info';
        }

        if (useCustomJavaCheck) useCustomJavaCheck.checked = currentSettingsData.useCustomJava || false;
        if (javaPathInput) javaPathInput.value = currentSettingsData.customJavaPath || '';
        updateJavaAreaState();

        settingsModal.classList.add('active');
    });
}

if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', async () => {
        settingsModal.classList.remove('active');

        const selectedGpuBtn = document.querySelector('.gpu-btn.active');
        const gpuVal = selectedGpuBtn ? selectedGpuBtn.getAttribute('data-val') : 'auto';

        const newSettings = {
            ...currentSettingsData,
            playerName: settingsPlayerName.value,
            hideLauncher: hideLauncherCheck.checked,
            gpuPreference: gpuVal,
            gameChannel: normalizeGameChannel(homeGameChannel ? homeGameChannel.value : currentSettingsData.gameChannel),
            useCustomJava: useCustomJavaCheck.checked,
            customJavaPath: javaPathInput.value
        };

        if (settingsPlayerName.value) {
            usernameInput.value = settingsPlayerName.value;
            localStorage.setItem('hytale_username', settingsPlayerName.value);
        }

        await ipcRenderer.invoke('save-settings', newSettings);
    });
}

ipcRenderer.on('repair-complete', (event, result) => {
    if (result.success) {
        showCustomDialog(t('success'), t('repair_success_msg'), false);
        const selectedChannel = normalizeGameChannel(homeGameChannel ? homeGameChannel.value : currentSettingsData.gameChannel);
        loadGameVersion(selectedChannel);
    } else {
        showCustomDialog(t('error'), result.error, false);
    }
});

playBtn.addEventListener('click', () => {
    // Verifica se há alteração de nome não confirmada
    const currentValue = sanitizeUsername(usernameInput.value);
    if (currentValue !== originalUsername && currentValue.length > 0) {
        shakeElement(confirmNameBtn);
        statusMsg.textContent = 'Confirme o novo nome antes de jogar';
        statusMsg.style.color = '#ffb347';
        setTimeout(() => {
            statusMsg.textContent = '';
            statusMsg.style.color = '';
        }, 3000);
        return;
    }

    // Usa o nome salvo (confirmado)
    const username = sanitizeUsername(originalUsername || currentValue);

    if (!username) {
        shakeElement(usernameInput);
        statusMsg.textContent = t('status_error') + ' ' + t('error_name_required');
        statusMsg.style.color = "#ff4444";
        return;
    }

    localStorage.setItem('hytale_username', username);

    // Feedback Visual
    logActivity(t('status_launching'), 'loading');

    // Atualiza estado do botão
    playBtn.disabled = true;
    playBtn.style.opacity = "0.7";
    playBtn.querySelector('i')?.remove(); // Remove ícones anteriores se houver
    playBtn.textContent = t('status_running_btn'); // Texto mais limpo no botão

    ipcRenderer.send('launch-game', username);
});


// Handlers de Lançamento/Saída do Jogo
ipcRenderer.on('launch-success', (event, message) => {
    // Se a mensagem for "Juego terminado", significa que o jogo fechou
    if (message === 'Juego terminado' || message === 'Game finished') {
        playBtn.disabled = false;
        playBtn.style.opacity = "1";
        playBtn.textContent = t('play_btn'); // "JOGAR"

        logActivity(t('status_session_ended'), 'normal');
        return;
    }

    // Outros casos de sucesso (ex: "Juego iniciado")
    if (message === 'Juego iniciado') {
        logActivity(t('status_game_started'), 'success');
        // Oculta status de carregamento na barra de atividades se quiser, 
        // ou mantém até o jogo fechar.
    }
});

ipcRenderer.on('launch-error', (event, message) => {
    playBtn.disabled = false;
    playBtn.style.opacity = "1";
    playBtn.textContent = t('play_btn');

    logActivity(`${t('status_error')} ${message}`, 'error');
});

ipcRenderer.on('launch-status', (event, message) => {
    if (message) {
        logActivity(message, 'info');
    }
});


let isModsViewOpen = false;

const activityLog = document.getElementById('activityLog');

modsBtn.addEventListener('click', () => {
    isModsViewOpen = !isModsViewOpen;

    if (isModsViewOpen) {
        homeView.style.display = 'none';
        modsView.style.display = 'flex';
        modsBtn.style.color = '#00d9ff';
        modsBtn.style.borderColor = '#00d9ff';

        if (modsList.children.length <= 1) loadPopularMods();
    } else {
        homeView.style.display = 'flex';
        modsView.style.display = 'none';
        modsBtn.style.color = '';
        modsBtn.style.borderColor = '';

    }
});

tabDiscover.addEventListener('click', () => {
    switchTab('discover');
});

tabInstalled.addEventListener('click', () => {
    switchTab('installed');
    loadInstalledMods();
});

function switchTab(tab) {
    if (tab === 'discover') {
        tabDiscover.classList.add('active');
        tabInstalled.classList.remove('active');
        discoverSection.style.display = 'flex';
        installedSection.style.display = 'none';
    } else {
        tabDiscover.classList.remove('active');
        tabInstalled.classList.add('active');
        discoverSection.style.display = 'none';
        installedSection.style.display = 'block';
    }
}

searchModsBtn.addEventListener('click', () => {
    const query = modSearchInput.value.trim();
    loadPopularMods(query);
});

modSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadPopularMods(modSearchInput.value.trim());
    }
});

async function loadPopularMods(query = '') {
    modsList.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> ${t('status_init')}</div>`;

    try {
        // Busca mods e lista de instalados em paralelo
        const [modsResult, installedResult] = await Promise.all([
            ipcRenderer.invoke('search-mods', query),
            ipcRenderer.invoke('list-installed-mods')
        ]);

        const installedMods = installedResult.success ? installedResult.data : [];

        if (modsResult.success) {
            renderMods(modsResult.data, installedMods);
        } else {
            modsList.innerHTML = `<p style="color: #ff4444;">${t('status_error')} ${modsResult.error}</p>`;
        }
    } catch (err) {
        modsList.innerHTML = `<p style="color: #ff4444;">${t('status_error')} ${err.message}</p>`;
    }
}

function renderMods(mods, installedMods = []) {
    modsList.innerHTML = '';

    if (mods.length === 0) {
        modsList.innerHTML = `<p>${t('no_mods_found')}</p>`;
        return;
    }

    // Cria um mapa de mods instalados por nome (sem versão) para verificação rápida
    const installedMap = new Map();
    installedMods.forEach(installed => {
        // Remove .jar, .disabled e extrai o nome base (sem versão)
        const baseName = installed.name
            .replace(/\.jar$/i, '')
            .replace(/\.disabled$/i, '')
            .replace(/-[\d.]+.*$/, '') // Remove versão tipo -1.0.0
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ''); // Remove caracteres especiais
        installedMap.set(baseName, installed);
    });

    mods.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'mod-card';

        const logoUrl = mod.logo && mod.logo.thumbnailUrl ? mod.logo.thumbnailUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(mod.name)}&background=random&color=fff&size=128`;

        const safeName = mod.name.replace(/'/g, "\\'");

        // Verifica se está instalado pelo nome simplificado
        const modBaseName = mod.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isInstalled = installedMap.has(modBaseName);

        // Determina texto e classe do botão
        let btnText, btnClass;
        if (isInstalled) {
            btnText = `<i class="fas fa-check"></i> ${t('modal_installed')}`;
            btnClass = 'install-btn installed';
        } else {
            btnText = t('modal_install').toUpperCase();
            btnClass = 'install-btn';
        }

        card.innerHTML = `
            <div class="mod-icon-wrapper" style="width: 80px; height: 80px; margin-bottom: 10px;"></div>
            <div class="mod-title" title="${mod.name}">${mod.name}</div>
            <div class="mod-desc">${mod.summary}</div>
            <button class="${btnClass}" data-id="${mod.id}" data-name="${safeName}">${btnText}</button>
        `;

        const iconWrapper = card.querySelector('.mod-icon-wrapper');

        const createFallback = () => {
            iconWrapper.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'mod-icon-placeholder';

            let hash = 0;
            for (let i = 0; i < mod.name.length; i++) hash = mod.name.charCodeAt(i) + ((hash << 5) - hash);
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            const color = "00000".substring(0, 6 - c.length) + c;

            Object.assign(placeholder.style, {
                width: '100%',
                height: '100%',
                borderRadius: '10px',
                background: `#${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '28px'
            });
            placeholder.innerText = mod.name.substring(0, 2).toUpperCase();
            iconWrapper.appendChild(placeholder);
        };

        const img = new Image();
        img.className = 'mod-icon';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';
        img.alt = mod.name;

        img.onload = () => {
            iconWrapper.innerHTML = '';
            iconWrapper.appendChild(img);
        };

        img.onerror = () => {
            createFallback();
        };

        img.src = logoUrl;

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('install-btn')) {
                return;
            }
            openModModal(mod);
        });

        const btn = card.querySelector('.install-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            installMod(mod.id, mod.name, btn);
        });

        modsList.appendChild(card);
    });
}

window.installMod = async (modId, modName, btnElement) => {
    if (!btnElement) return;

    const originalText = btnElement.textContent;
    btnElement.textContent = '...';
    btnElement.disabled = true;

    logActivity(`${t('status_installing')} ${modName}...`, 'loading');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    try {
        const result = await ipcRenderer.invoke('install-mod', { id: modId, name: modName });

        // Esconde a barra de progresso quando termina
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';

        if (result.success) {
            btnElement.innerHTML = `<i class="fas fa-check"></i> ${t('modal_installed')}`;
            btnElement.classList.add('installed');
            logActivity(`✓ ${modName} instalado com sucesso!`, 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        // Esconde a barra de progresso em caso de erro também
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';

        btnElement.textContent = 'ERROR';
        btnElement.style.background = '#ff4444';

        logActivity(`${t('status_error')} ${err.message}`, 'error');

        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.disabled = false;
            btnElement.style.background = '';
        }, 3000);
    }
};

const modModal = document.getElementById('modModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalInstallBtn = document.getElementById('modalInstallBtn');

const modalElements = {
    image: document.getElementById('modalModImage'),
    name: document.getElementById('modalModName'),
    author: document.getElementById('modalModAuthor'),
    version: document.getElementById('modalModVersion'),
    date: document.getElementById('modalModDate'),
    downloads: document.getElementById('modalModDownloads'),
    description: document.getElementById('modalModDescription')
};

let currentModalMod = null;

function openModModal(mod) {
    currentModalMod = mod;

    const logoUrl = mod.logo && mod.logo.thumbnailUrl ? mod.logo.thumbnailUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(mod.name)}&background=random&color=fff&size=128`;

    modalElements.image.style.display = 'block';
    const prevFallback = modalElements.image.parentElement.querySelector('.modal-fallback');
    if (prevFallback) prevFallback.remove();

    modalElements.image.src = logoUrl;
    modalElements.image.onerror = function () {
        this.style.display = 'none';

        let hash = 0;
        for (let i = 0; i < mod.name.length; i++) hash = mod.name.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        const color = "00000".substring(0, 6 - c.length) + c;

        const placeholder = document.createElement('div');
        placeholder.className = 'mod-detail-logo modal-fallback';
        placeholder.style.background = `#${color}`;
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#fff';
        placeholder.style.fontWeight = 'bold';
        placeholder.style.fontSize = '24px';
        placeholder.innerText = mod.name.substring(0, 2).toUpperCase();

        this.parentElement.insertBefore(placeholder, this);
    };
    modalElements.name.textContent = mod.name;
    modalElements.author.textContent = `${t('modal_author')} ${mod.author || 'Unknown'}`;
    modalElements.version.textContent = mod.version || 'v1.0';
    modalElements.date.textContent = mod.lastUpdated || 'Recent';
    modalElements.downloads.textContent = mod.downloads ? mod.downloads.toLocaleString() : '0';

    modalElements.description.innerHTML = '<p style="color: #666;">...</p>';

    ipcRenderer.invoke('get-mod-description', mod.id).then(result => {
        if (currentModalMod && currentModalMod.id === mod.id) {
            if (result.success && result.data) {
                modalElements.description.innerHTML = result.data;
            } else {
                modalElements.description.textContent = mod.summary || t('modal_about');
            }
        }
    });

    modalInstallBtn.textContent = t('modal_install');
    modalInstallBtn.disabled = false;
    modalInstallBtn.style.background = '';

    modModal.classList.add('active');
}

function closeModModal() {
    modModal.classList.remove('active');
    currentModalMod = null;
}

closeModalBtn.addEventListener('click', closeModModal);

modModal.addEventListener('click', (e) => {
    if (e.target === modModal) closeModModal();
});

modalInstallBtn.addEventListener('click', () => {
    if (currentModalMod) {
        installMod(currentModalMod.id, currentModalMod.name, modalInstallBtn);
    }
});

async function loadInstalledMods() {
    installedList.innerHTML = '<div class="loading-spinner">...</div>';

    const result = await ipcRenderer.invoke('list-installed-mods');

    if (result.success) {
        renderInstalledMods(result.data);
    } else {
        installedList.innerHTML = `<p>${t('status_error')} ${result.error}</p>`;
    }
}

function renderInstalledMods(mods) {
    installedList.innerHTML = '';

    if (mods.length === 0) {
        installedList.innerHTML = `
            <div class="empty-mods-state">
                <i class="fas fa-puzzle-piece"></i>
                <p>${t('no_installed_mods')}</p>
            </div>`;
        return;
    }

    mods.forEach(mod => {
        const item = document.createElement('div');
        item.className = 'installed-item';
        item.dataset.filename = mod.fileName; // Critical for delegated events
        if (!mod.enabled) item.classList.add('disabled');

        const modDisplayName = mod.name.replace(/\.jar$/i, '').replace(/-/g, ' ');

        // Sanitização simples para o nome do arquivo no onclick
        const safeFileName = mod.fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        item.innerHTML = `
            <div class="inst-info">
                <div class="inst-status-icon ${mod.enabled ? 'status-on' : 'status-off'}">
                    <i class="fas ${mod.enabled ? 'fa-check' : 'fa-pause'}"></i>
                </div>
                <span class="inst-name">${modDisplayName}</span>
            </div>
            <div class="inst-actions" style="z-index: 100;">
                <button class="icon-btn toggle" title="${mod.enabled ? 'Desativar' : 'Ativar'}" onclick="event.stopPropagation(); window.toggleMod('${safeFileName}')">
                    <i class="fas fa-power-off"></i>
                </button>
                <button class="icon-btn delete" title="Remover" onclick="event.stopPropagation(); console.log('[DEBUG INLINE] Clicou deletar:', '${safeFileName}'); window.deleteMod('${safeFileName}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;

        // (Removido listeners manuais anteriores - usando inline agora)
        installedList.appendChild(item);
    });
}

// Delegated Event Listener removido
// (A lógica foi movida para bind direto na criação do elemento em renderInstalledMods)

window.toggleMod = async (fileName) => {
    try {
        await ipcRenderer.invoke('toggle-mod', fileName);
        loadInstalledMods();
    } catch (e) {
        console.error("Toggle error:", e);
    }
};

window.deleteMod = async (fileName) => {
    console.log('Requesting delete for:', fileName);
    let confirmed = false;

    try {
        confirmed = await customAsk(t('delete_mod_title'), t('delete_mod_confirm'));
    } catch (e) {
        console.error("CustomAsk failed, using fallback:", e);
        // Fallback para confirm nativo se algo quebrar na tradução ou modal
        confirmed = confirm("Delete this mod? (Fallback Check)");
    }

    if (confirmed) {
        console.log('Confirmed delete for:', fileName);
        try {
            await ipcRenderer.invoke('delete-mod', fileName);
            loadInstalledMods();
        } catch (e) {
            console.error("IPC delete failed:", e);
            alert("Failed to delete: " + e.message);
        }
    } else {
        console.log('Delete cancelled');
    }
};

ipcRenderer.on('launch-error', (event, message) => {
    statusMsg.textContent = `${t('status_error')} ${message} `;
    statusMsg.style.color = "#ff4444";
    progressContainer.style.display = 'none';
    resetPlayBtn();
});

ipcRenderer.on('launch-status', (event, message) => {
    statusMsg.textContent = t(message);
    statusMsg.style.color = "#00d9ff";
});

ipcRenderer.on('download-progress', (event, data) => {
    progressContainer.style.display = 'block';

    let percent = 0;
    let speed = '';
    let text = '';

    if (typeof data === 'object') {
        percent = data.percent;
        speed = data.speed;
        text = data.text;
    } else {
        percent = data;
    }

    progressBar.style.width = percent + '%';

    if (text) {
        statusMsg.innerText = text;
    } else if (speed) {
        statusMsg.textContent = `${t('status_downloading')} ${percent}% (${speed})`;
    } else {
        statusMsg.textContent = `${t('status_downloading')} ${percent}% `;
    }
    statusMsg.style.display = 'none';
    statusMsg.offsetHeight;
    statusMsg.style.display = 'block';
});

ipcRenderer.on('launch-success', (event, message) => {
    statusMsg.textContent = t('status_running');
    statusMsg.style.color = "#4caf50";
    progressContainer.style.display = 'none';

    setTimeout(() => {
        resetPlayBtn();
        statusMsg.textContent = "";
    }, 5000);
});

// ipcRenderer.on('update-available', async (event, remoteConfig) => {
//     console.log("Update available:", remoteConfig);
//     const title = t('update_available_title') || "Update Available";
//     const msg = (t('update_available_msg') || "A new version {v} is available. Update now?").replace('{v}', remoteConfig.version);
//
//     if (await customAsk(title, msg)) {
//         ipcRenderer.invoke('perform-update', remoteConfig.downloadUrl);
//     }
// }); // Desativado: launcher modificado não deve auto-atualizar

function resetPlayBtn() {
    playBtn.disabled = false;
    playBtn.style.opacity = "1";
    playBtn.innerHTML = `${t('play_btn')} `;
}

const onboardingView = document.getElementById('onboardingView');
const startBtn = document.getElementById('startBtn');
const termsCheck = document.getElementById('termsCheck');
const onboardingUser = document.getElementById('onboardingUser');
const langCards = document.querySelectorAll('.lang-card');
const btnToStep3 = document.getElementById('btnToStep3');

function showStep(stepId) {
    document.querySelectorAll('.onboarding-slide').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const step = document.getElementById(stepId);
    if (step) {
        step.style.display = 'flex';
        setTimeout(() => step.classList.add('active'), 10);
    }
}

function initOnboarding() {
    if (!onboardingView) return;

    if (!ONBOARDING_CONFIG.enabled) {
        localStorage.setItem('battly_setup_complete', 'true');
        onboardingView.style.display = 'none';
        return;
    }

    const isSetupComplete = localStorage.getItem('battly_setup_complete');

    if (!isSetupComplete) {
        onboardingView.style.display = 'flex';
        showStep('onboardingStep2');

        const currentLang = localStorage.getItem('battly_lang') || 'es';
        document.querySelector(`.lang - card[data - lang="${currentLang}"]`)?.classList.add('selected');

        const savedUser = localStorage.getItem('hytale_username');
        if (savedUser) {
            onboardingUser.value = savedUser;
            checkStep2Validity();
        }
    }
}

function checkStep2Validity() {
    if (!btnToStep3) return;
    const isUserValid = sanitizeUsername(onboardingUser.value).length > 0;
    btnToStep3.disabled = !isUserValid;
}

function checkStep3Validity() {
    if (!startBtn) return;
    const isTermsAccepted = termsCheck.checked;
    startBtn.disabled = !isTermsAccepted;
}

if (onboardingView) {
    if (!ONBOARDING_CONFIG.enabled) {
        onboardingView.style.display = 'none';
    }

    document.querySelectorAll('.next-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const nextId = btn.getAttribute('data-next');
            if (nextId) showStep(nextId);
        });
    });

    document.querySelectorAll('.back-step-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const prevId = btn.getAttribute('data-prev');
            if (prevId) showStep(prevId);
        });
    });



    if (onboardingUser) {
        onboardingUser.addEventListener('input', (e) => {
            const sanitized = sanitizeUsername(e.target.value);
            if (sanitized !== e.target.value) {
                e.target.value = sanitized;
            }
            checkStep2Validity();
            const usernameMain = document.getElementById('username');
            if (usernameMain) usernameMain.value = sanitized;
        });
    }

    if (termsCheck) {
        termsCheck.addEventListener('change', checkStep3Validity);
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const user = sanitizeUsername(onboardingUser.value);
            if (!user || !termsCheck.checked) return;

            localStorage.setItem('hytale_username', user);
            localStorage.setItem('battly_setup_complete', 'true');

            originalUsername = user;
            if (usernameInput) usernameInput.value = user;
            if (confirmNameBtn) confirmNameBtn.classList.remove('visible');

            onboardingView.style.transition = 'opacity 0.5s ease';
            onboardingView.style.opacity = '0';

            setTimeout(() => {
                onboardingView.style.display = 'none';
            }, 500);
        });
    }

    document.querySelectorAll('.legal-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = link.getAttribute('data-url');
            if (url) {
                const { shell } = require('electron');
                shell.openExternal(url);
            }
        });
    });
}

initOnboarding();

// customAsk já importado do módulo dialog.js
window.customAsk = customAsk;
