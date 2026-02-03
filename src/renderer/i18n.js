const path = require('path');
const fs = require('fs');

let currentTranslations = {};
const AVAILABLE_LANGS = ['en', 'es', 'pt', 'de', 'fr', 'zh', 'ru', 'ja'];
const defaultLang = 'pt';

const getSavedLang = () => {
    const saved = localStorage.getItem('battly_lang');
    return AVAILABLE_LANGS.includes(saved) ? saved : defaultLang;
};

async function loadLocale(lang) {
    try {
        const localePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
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

function applyTranslations(playBtn = null) {
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

module.exports = {
    AVAILABLE_LANGS,
    defaultLang,
    getSavedLang,
    loadLocale,
    t,
    applyTranslations
};
