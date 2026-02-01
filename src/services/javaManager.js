const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');
const StreamZip = require('node-stream-zip');
const { downloadFile } = require('./utils');
const os = require('os');

const JRE_DIR = path.join(app.getPath('appData'), 'Hytale', 'install', 'release', 'package', 'jre', 'latest');
const JAVA_EXECUTABLE = process.platform === 'win32' ? 'java.exe' : 'java';

async function getJavaExec() {
    const bundledJava = path.join(JRE_DIR, 'bin', JAVA_EXECUTABLE);
    if (await fs.pathExists(bundledJava)) {
        return bundledJava;
    }
    
    return 'java';
}

async function ensureJavaInstalled(event) {
    const bundledJava = path.join(JRE_DIR, 'bin', JAVA_EXECUTABLE);
    if (await fs.pathExists(bundledJava)) {
        return bundledJava;
    }

    event.reply('launch-status', 'Comprobando Java...');

    
    
    let jreConfigPath = path.resolve(__dirname, '../../jre.json');
    if (!fs.existsSync(jreConfigPath)) {
        jreConfigPath = path.resolve(process.cwd(), 'jre.json');
    }

    if (!fs.existsSync(jreConfigPath)) {
        throw new Error('jre.json configuration not found');
    }

    const jreConfig = await fs.readJson(jreConfigPath);
    const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
    const arch = os.arch() === 'x64' ? 'x64' : 'arm64'; 

    if (!jreConfig.download_url[platform] || !jreConfig.download_url[platform][arch]) {
        throw new Error(`Java runtime not defined for ${platform} ${arch}`);
    }

    const targetInfo = jreConfig.download_url[platform][arch];
    const downloadUrl = targetInfo.url;
    

    const tempDir = app.getPath('temp');
    const fileName = path.basename(downloadUrl);
    const downloadPath = path.join(tempDir, fileName);

    event.reply('launch-status', 'Descargando Java Runtime...');
    await downloadFile(downloadUrl, downloadPath, event); 

    event.reply('launch-status', 'Extrayendo Java...');
    await fs.ensureDir(JRE_DIR);

    if (fileName.endsWith('.zip')) {
        const zip = new StreamZip.async({ file: downloadPath });
        await zip.extract(null, JRE_DIR);
        await zip.close();
    } else {
        
        
        throw new Error("Formato de archivo JRE no soportado (solo zip implementado).");
    }

    
    const items = await fs.readdir(JRE_DIR);
    if (items.length === 1 && (await fs.stat(path.join(JRE_DIR, items[0]))).isDirectory()) {
        const nestedDir = path.join(JRE_DIR, items[0]);
        const nestedItems = await fs.readdir(nestedDir);
        for (const item of nestedItems) {
            await fs.move(path.join(nestedDir, item), path.join(JRE_DIR, item));
        }
        await fs.remove(nestedDir);
    }

    
    await fs.remove(downloadPath);

    return path.join(JRE_DIR, 'bin', JAVA_EXECUTABLE);
}

module.exports = {
    ensureJavaInstalled,
    getJavaExec
};
