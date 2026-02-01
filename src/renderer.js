const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

let currentTranslations = {};
const languageSelect = document.getElementById('languageSelect');
const defaultLang = localStorage.getItem('battly_lang') || 'es';

async function loadNews() {
    const container = document.getElementById('newsContainer');
    try {
        const newsItems = await ipcRenderer.invoke('get-news');

        container.innerHTML = '';

        if (!newsItems || newsItems.length === 0) {
            container.innerHTML = '<p class="error-text">No news available.</p>';
            return;
        }

        newsItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'news-card fade-in-up';
            card.onclick = () => require('electron').shell.openExternal(item.link);

            const bgImage = item.image || 'https://hytale.com/static/images/media/screenshots/1.jpg';

            card.innerHTML = `
                <div class="news-image" style="background-image: url('${bgImage}')"></div>
                <div class="news-content">
                    <h3>${item.title}</h3>
                    <p>${item.summary}</p>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        console.error("News Load Error:", e);
        container.innerHTML = '<p class="error-text">Failed to load news.</p>';
    }
}

async function loadLocale(lang) {
    try {
        const localePath = path.join(__dirname, 'locales', `${lang}.json`);
        console.log(`Loading locale from: ${localePath}`);
        if (fs.existsSync(localePath)) {
            const data = fs.readFileSync(localePath, 'utf8');
            currentTranslations = JSON.parse(data);
            localStorage.setItem('battly_lang', lang);
            applyTranslations();
        } else {
            console.error(`Locale ${lang} not found at ${localePath}`);
        }
    } catch (e) {
        console.error('Error loading locale:', e);
    }
}

function t(key) {
    return currentTranslations[key] || key;
}

function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (currentTranslations[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = currentTranslations[key];
            } else {
                el.textContent = currentTranslations[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (currentTranslations[key]) el.placeholder = currentTranslations[key];
    });

    if (playBtn && !playBtn.disabled) playBtn.innerHTML = t('play_btn');
}

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

if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
    });
}

if (closeSettingsBtn) {
}

if (hideLauncherCheck) {
}
hideLauncherCheck.addEventListener('change', async (e) => {
    await ipcRenderer.invoke('save-settings', { hideLauncher: e.target.checked });
});


settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

document.getElementById('discordBtn').addEventListener('click', () => {
    require('electron').shell.openExternal('https://discord.com/invite/tecno-bros-885235460178342009');
});

const playBtn = document.getElementById('playBtn');
const usernameInput = document.getElementById('username');
const statusMsg = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const modsBtn = document.getElementById('modsBtn');

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

languageSelect.value = defaultLang;
loadLocale(defaultLang);
loadNews();

languageSelect.addEventListener('change', (e) => {
    const newLang = e.target.value;
    loadLocale(newLang);
    ipcRenderer.send('track-event', 'settings', 'language_changed', newLang, 1);
});

const savedUser = localStorage.getItem('hytale_username');
if (savedUser) {
    usernameInput.value = savedUser;
}

const settingsPlayerName = document.getElementById('settingsPlayerName');
const openLocationBtn = document.getElementById('openLocationBtn');
const repairGameBtn = document.getElementById('repairGameBtn');
const gpuDetectedText = document.getElementById('gpuDetectedText');
const useCustomJavaCheck = document.getElementById('useCustomJavaCheck');
const javaPathInput = document.getElementById('javaPathInput');
const browseJavaBtn = document.getElementById('browseJavaBtn');
const customJavaArea = document.getElementById('customJavaArea');
const gpuButtons = document.querySelectorAll('.gpu-btn');

let currentSettingsData = {};

const settingsTabs = document.querySelectorAll('.settings-tab');
settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        settingsTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-page').forEach(p => p.style.display = 'none');

        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        const page = document.getElementById(`settings-${target}`);
        if (page) page.style.display = 'block';
    });
});

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
            ipcRenderer.send('repair-game');
            statusMsg.textContent = t('repair_started');
            settingsModal.classList.remove('active');
        }
    };
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
        currentSettingsData = await ipcRenderer.invoke('get-settings');

        if (settingsPlayerName) settingsPlayerName.value = usernameInput.value || currentSettingsData.playerName || '';
        if (hideLauncherCheck) hideLauncherCheck.checked = currentSettingsData.hideLauncher || false;

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
    } else {
        showCustomDialog(t('error'), result.error, false);
    }
});

playBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();

    if (!username) {
        shakeElement(usernameInput);
        statusMsg.textContent = t('status_error') + "Username required";
        statusMsg.style.color = "#ff4444";
        return;
    }

    localStorage.setItem('hytale_username', username);

    statusMsg.textContent = t('status_init');
    statusMsg.style.color = "#00d9ff";
    playBtn.disabled = true;
    playBtn.style.opacity = "0.7";
    playBtn.innerHTML = t('status_launching');

    ipcRenderer.send('launch-game', username);
});

let isModsViewOpen = false;

modsBtn.addEventListener('click', () => {
    isModsViewOpen = !isModsViewOpen;

    if (isModsViewOpen) {
        homeView.style.display = 'none';
        modsView.style.display = 'flex';
        modsBtn.style.color = '#00d9ff';
        modsBtn.style.borderColor = '#00d9ff';

        let currentState = 'Catalogo de Hytale';
        if (tabInstalled.classList.contains('active')) currentState = 'Revisando instalados';
        ipcRenderer.send('discord-activity', 'Explorando Mods', currentState);

        if (modsList.children.length <= 1) loadPopularMods();
    } else {
        homeView.style.display = 'flex';
        modsView.style.display = 'none';
        modsBtn.style.color = '';
        modsBtn.style.borderColor = '';
        ipcRenderer.send('discord-activity', 'En el Launcher');
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
        ipcRenderer.send('discord-activity', 'Explorando Mods', 'Catalogo de Hytale');
    } else {
        tabDiscover.classList.remove('active');
        tabInstalled.classList.add('active');
        discoverSection.style.display = 'none';
        installedSection.style.display = 'block';
        ipcRenderer.send('discord-activity', 'Gestionando Mods', 'Revisando instalados');
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
        const result = await ipcRenderer.invoke('search-mods', query);

        if (result.success) {
            renderMods(result.data);
        } else {
            modsList.innerHTML = `<p style="color: #ff4444;">${t('status_error')} ${result.error}</p>`;
        }
    } catch (err) {
        modsList.innerHTML = `<p style="color: #ff4444;">${t('status_error')} ${err.message}</p>`;
    }
}

function renderMods(mods) {
    modsList.innerHTML = '';

    if (mods.length === 0) {
        modsList.innerHTML = `<p>${t('no_mods_found')}</p>`;
        return;
    }

    mods.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'mod-card';

        const logoUrl = mod.logo && mod.logo.thumbnailUrl ? mod.logo.thumbnailUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(mod.name)}&background=random&color=fff&size=128`;
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(mod.name)}&background=333&color=fff&size=128&font-size=0.5`;

        const safeName = mod.name.replace(/'/g, "\\'");

        card.innerHTML = `
            <div class="mod-icon-wrapper" style="width: 80px; height: 80px; margin-bottom: 10px;"></div>
            <div class="mod-title" title="${mod.name}">${mod.name}</div>
            <div class="mod-desc">${mod.summary}</div>
            <button class="install-btn" data-id="${mod.id}" data-name="${safeName}">${t('modal_install').toUpperCase()}</button>
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

    statusMsg.textContent = `${t('status_installing')} ${modName}...`;

    try {
        const result = await ipcRenderer.invoke('install-mod', { id: modId, name: modName });
        if (result.success) {
            btnElement.textContent = t('modal_installed');
            btnElement.style.background = '#4caf50';
            statusMsg.textContent = `${modName} ${t('modal_installed')}`;
            setTimeout(() => statusMsg.textContent = '', 3000);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        btnElement.textContent = 'ERROR';
        btnElement.style.background = '#ff4444';
        statusMsg.textContent = `${t('status_error')} ${err.message}`;
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
        placeholder.className = 'modal-mod-logo modal-fallback';
        placeholder.style.background = `#${color}`;
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#fff';
        placeholder.style.fontWeight = 'bold';
        placeholder.style.fontSize = '32px';
        placeholder.innerText = mod.name.substring(0, 2).toUpperCase();

        this.parentElement.insertBefore(placeholder, this);
    };
    modalElements.name.textContent = mod.name;
    modalElements.author.textContent = `${t('modal_author')} ${mod.author || 'Unknown'}`;
    modalElements.version.textContent = mod.version || 'v1.0';
    modalElements.date.textContent = mod.lastUpdated ? `${t('modal_updated')}: ${mod.lastUpdated}` : 'Recent';
    modalElements.downloads.textContent = mod.downloads ? mod.downloads.toLocaleString() : '0';

    modalElements.description.innerHTML = '<p style="color: #888;">...</p>';

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
        installedList.innerHTML = `<p style="text-align:center;color:#888;">${t('no_installed_mods')}</p>`;
        return;
    }

    mods.forEach(mod => {
        const item = document.createElement('div');
        item.className = 'installed-item';

        item.innerHTML = `
            <div class="inst-info">
                <div class="inst-status ${mod.enabled ? 'status-on' : 'status-off'}"></div>
                <span style="${!mod.enabled ? 'text-decoration: line-through; color: #888;' : ''}">${mod.name}</span>
            </div>
            <div class="inst-actions">
                <button class="icon-btn" title="${mod.enabled ? 'Desactivar' : 'Activar'}" onclick="toggleMod('${mod.fileName}')">
                    <i class="fas fa-power-off"></i>
                </button>
                <button class="icon-btn delete" title="Eliminar" onclick="deleteMod('${mod.fileName}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        installedList.appendChild(item);
    });
}

window.toggleMod = async (fileName) => {
    await ipcRenderer.invoke('toggle-mod', fileName);
    loadInstalledMods();
};

window.deleteMod = async (fileName) => {
    if (await customAsk(t('delete_mod_title'), t('delete_mod_confirm'))) {
        await ipcRenderer.invoke('delete-mod', fileName);
        loadInstalledMods();
    }
};

ipcRenderer.on('launch-error', (event, message) => {
    statusMsg.textContent = `${t('status_error')} ${message}`;
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
        statusMsg.textContent = `${t('status_downloading')} ${percent}%`;
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

ipcRenderer.on('update-available', async (event, remoteConfig) => {
    console.log("Update available:", remoteConfig);
    const title = t('update_available_title') || "Update Available";
    const msg = (t('update_available_msg') || "A new version {v} is available. Update now?").replace('{v}', remoteConfig.version);

    if (await customAsk(title, msg)) {
        ipcRenderer.invoke('perform-update', remoteConfig.downloadUrl);
    }
});

function resetPlayBtn() {
    playBtn.disabled = false;
    playBtn.style.opacity = "1";
    playBtn.innerHTML = `${t('play_btn')}`;
}

function shakeElement(element) {
    element.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(10px)' },
        { transform: 'translateX(-10px)' },
        { transform: 'translateX(0)' }
    ], {
        duration: 400
    });
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
    const isSetupComplete = localStorage.getItem('battly_setup_complete');

    if (!isSetupComplete) {
        onboardingView.style.display = 'flex';
        showStep('onboardingStep1');

        const currentLang = localStorage.getItem('battly_lang') || 'es';
        document.querySelector(`.lang-card[data-lang="${currentLang}"]`)?.classList.add('selected');

        const savedUser = localStorage.getItem('hytale_username');
        if (savedUser) {
            onboardingUser.value = savedUser;
            checkStep2Validity();
        }
    }
}

function checkStep2Validity() {
    if (!btnToStep3) return;
    const isUserValid = onboardingUser.value.trim().length > 0;
    btnToStep3.disabled = !isUserValid;
}

function checkStep3Validity() {
    if (!startBtn) return;
    const isTermsAccepted = termsCheck.checked;
    startBtn.disabled = !isTermsAccepted;
}

if (onboardingView) {
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
            else if (btn.closest('#onboardingStep2')) showStep('onboardingStep1');
            else if (btn.closest('#onboardingStep3')) showStep('onboardingStep2');
        });
    });

    langCards.forEach(card => {
        card.addEventListener('click', () => {
            const lang = card.dataset.lang;
            loadLocale(lang);
            languageSelect.value = lang;
            langCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    if (onboardingUser) {
        onboardingUser.addEventListener('input', (e) => {
            checkStep2Validity();
            const usernameMain = document.getElementById('username');
            if (usernameMain) usernameMain.value = e.target.value;
        });
    }

    if (termsCheck) {
        termsCheck.addEventListener('change', checkStep3Validity);
    }

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const user = onboardingUser.value.trim();
            if (!user || !termsCheck.checked) return;

            localStorage.setItem('hytale_username', user);
            localStorage.setItem('battly_setup_complete', 'true');

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

const customDialog = document.getElementById('customDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogConfirmBtn = document.getElementById('dialogConfirmBtn');
const dialogCancelBtn = document.getElementById('dialogCancelBtn');

function showCustomDialog(title, message, isQuestion = false) {
    return new Promise((resolve) => {
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;

        dialogConfirmBtn.textContent = 'Confirm';
        dialogCancelBtn.textContent = 'Cancel';

        if (typeof t === 'function') {
            dialogConfirmBtn.textContent = isQuestion ? t('btn_confirm') || 'Yes' : t('btn_ok') || 'OK';
            dialogCancelBtn.textContent = t('btn_cancel') || 'Cancel';
        }

        customDialog.style.display = 'flex';
        void customDialog.offsetWidth;
        customDialog.classList.add('active');

        if (isQuestion) {
            dialogCancelBtn.style.display = 'block';
        } else {
            dialogCancelBtn.style.display = 'none';
        }

        const close = (result) => {
            customDialog.classList.remove('active');
            setTimeout(() => {
                customDialog.style.display = 'none';
            }, 300);

            dialogConfirmBtn.onclick = null;
            dialogCancelBtn.onclick = null;
            resolve(result);
        };

        dialogConfirmBtn.onclick = () => close(true);
        dialogCancelBtn.onclick = () => close(false);
    });
}

window.customAlert = (title, message) => showCustomDialog(title, message, false);
window.customAsk = (title, message) => showCustomDialog(title, message, true);
