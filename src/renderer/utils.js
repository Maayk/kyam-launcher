const ONBOARDING_CONFIG = {
    enabled: false,
    usernameMaxLength: 24
};

function sanitizeUsername(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ').slice(0, ONBOARDING_CONFIG.usernameMaxLength);
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

module.exports = {
    ONBOARDING_CONFIG,
    sanitizeUsername,
    shakeElement
};
