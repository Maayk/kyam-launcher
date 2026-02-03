const fs = require('fs-extra');
const axios = require('axios');
const { BrowserWindow } = require('electron');

const https = require('https');

const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const agent = new https.Agent({
    keepAlive: true,
    maxSockets: Infinity,
    keepAliveMsecs: 1000,
    family: 4,      // Force IPv4 to avoid IPv6 lookup delays
    noDelay: true   // Disable Nagle's algorithm for lower latency
});

async function downloadFile(url, dest, event) {
    const writer = fs.createWriteStream(dest, { highWaterMark: 64 * 1024 });

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        httpsAgent: agent,
        httpAgent: agent,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://hytale.com/',
            'Origin': 'https://hytale.com',
            'Connection': 'keep-alive'
        }
    });

    const totalLength = parseInt(response.headers['content-length'], 10) || 0;

    console.log('Iniciando descarga...');

    let downloadedLength = 0;
    let lastTime = Date.now();
    let lastLoaded = 0;
    let speed = "0.00 MB/s";
    let lastUpdate = 0;

    const progressMonitor = new Transform({
        transform(chunk, encoding, callback) {
            downloadedLength += chunk.length;
            const now = Date.now();

            if (now - lastUpdate > 500 && totalLength) {
                const timeDiff = (now - lastTime) / 1000;
                const loadedDiff = downloadedLength - lastLoaded;

                if (timeDiff > 0) {
                    const mbps = (loadedDiff / timeDiff) / (1024 * 1024);
                    speed = `${mbps.toFixed(2)} MB/s`;
                }

                lastTime = now;
                lastLoaded = downloadedLength;
                lastUpdate = now;

                const progress = Math.round((downloadedLength / totalLength) * 100);
                const win = BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('download-progress', { percent: progress, speed: speed });
            }

            this.push(chunk);
            callback();
        }
    });

    await pipeline(response.data, progressMonitor, writer);
}

function verifyFileHash(filePath, expectedHash, algorithm = 'sha1') {
    if (!expectedHash) return true;

    return new Promise((resolve, reject) => {
        const hash = require('crypto').createHash(algorithm);
        const stream = fs.createReadStream(filePath);

        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => {
            const calculated = hash.digest('hex');
            resolve(calculated.toLowerCase() === expectedHash.toLowerCase());
        });
    });
}

module.exports = { downloadFile, verifyFileHash };
