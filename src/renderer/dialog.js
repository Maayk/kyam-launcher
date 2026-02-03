const { t } = require('./i18n');

const customDialog = document.getElementById('customDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogMessage = document.getElementById('dialogMessage');
const dialogConfirmBtn = document.getElementById('dialogConfirmBtn');
const dialogCancelBtn = document.getElementById('dialogCancelBtn');

function showCustomDialog(title, message, isQuestion = false) {
    return new Promise((resolve) => {
        if (!customDialog) {
            console.error("Custom Dialog element not found!");
            resolve(false);
            return;
        }

        if (dialogTitle) dialogTitle.textContent = title;
        if (dialogMessage) dialogMessage.textContent = message;

        if (dialogConfirmBtn) {
            dialogConfirmBtn.textContent = 'Confirm';
        }
        if (dialogCancelBtn) {
            dialogCancelBtn.textContent = 'Cancel';
        }

        try {
            if (typeof t === 'function') {
                if (dialogConfirmBtn) dialogConfirmBtn.textContent = isQuestion ? (t('btn_confirm') || 'Confirm') : (t('btn_ok') || 'OK');
                if (dialogCancelBtn) dialogCancelBtn.textContent = t('btn_cancel') || 'Cancel';
            }
        } catch (e) {
            console.error("Translation error in dialog:", e);
        }

        customDialog.style.cssText = 'display: flex !important; opacity: 1 !important; z-index: 99999 !important; visibility: visible !important;';
        customDialog.classList.add('active');

        if (isQuestion) {
            if (dialogCancelBtn) dialogCancelBtn.style.display = 'block';
        } else {
            if (dialogCancelBtn) dialogCancelBtn.style.display = 'none';
        }

        const close = (result) => {
            customDialog.classList.remove('active');
            customDialog.style.opacity = '0';
            setTimeout(() => {
                customDialog.style.display = 'none';
            }, 300);

            if (dialogConfirmBtn) dialogConfirmBtn.onclick = null;
            if (dialogCancelBtn) dialogCancelBtn.onclick = null;
            resolve(result);
        };

        if (dialogConfirmBtn) dialogConfirmBtn.onclick = () => close(true);
        if (dialogCancelBtn) dialogCancelBtn.onclick = () => close(false);
    });
}

function customAsk(title, message) {
    return showCustomDialog(title, message, true);
}

module.exports = {
    showCustomDialog,
    customAsk
};
