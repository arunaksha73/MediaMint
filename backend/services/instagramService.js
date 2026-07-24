/**
 * Service to handle media extraction from Instagram URLs using yt-dlp.
 * yt-dlp is a reliable, actively maintained tool that handles Instagram's
 * bot detection and extracts direct CDN video/image URLs.
 */

const { execFile } = require('child_process');
const path = require('path');

// yt-dlp executable path (installed via pip for the current user)
const YT_DLP_PATHS = [
    // Confirmed install path on this machine
    'C:\\Users\\dasam\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python313\\Scripts\\yt-dlp.exe',
    'yt-dlp',  // if on PATH
    path.join(
        process.env.LOCALAPPDATA || '',
        'Packages',
        'PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0',
        'LocalCache', 'local-packages', 'Python313', 'Scripts', 'yt-dlp.exe'
    ),
    path.join(process.env.APPDATA || '', '..', 'Local', 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Packages',
        'PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0',
        'LocalCache', 'local-packages', 'Python313', 'Scripts', 'yt-dlp.exe'),
];

function runYtDlp(args) {
    return new Promise((resolve, reject) => {
        let tried = 0;

        function tryNext() {
            if (tried >= YT_DLP_PATHS.length) {
                return reject(new Error('yt-dlp not found. Please ensure it is installed via: pip install yt-dlp'));
            }
            const exe = YT_DLP_PATHS[tried++];
            execFile(exe, args, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err && (err.code === 'ENOENT' || err.message.includes('not recognized'))) {
                    return tryNext();
                }
                if (err) return reject(new Error(stderr || err.message));
                resolve(stdout.trim());
            });
        }

        tryNext();
    });
}

/**
 * Format seconds to mm:ss
 */
function formatDuration(seconds) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format bytes to human readable size
 */
function formatFilesize(bytes) {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const fetchMediaDetails = async (url) => {
    // Use yt-dlp to extract media info as JSON
    const jsonStr = await runYtDlp([
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url
    ]);

    let info;
    try {
        info = JSON.parse(jsonStr);
    } catch (e) {
        throw new Error('Failed to parse media information from Instagram.');
    }

    // Determine media type
    const ext = (info.ext || 'mp4').toLowerCase();
    const isVideo = ['mp4', 'mov', 'webm', 'm4v'].includes(ext);
    const type = isVideo ? 'reel' : 'post';

    // Get direct download URL (best quality)
    const downloadUrl = info.url || (info.formats && info.formats[info.formats.length - 1]?.url);

    if (!downloadUrl) {
        throw new Error('Could not extract a direct download URL. The post may be private.');
    }

    // Get thumbnail
    const thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails[0]?.url) || null;

    // Quality info
    let quality = null;
    if (info.height) quality = `${info.height}p`;
    else if (info.format_note) quality = info.format_note;

    return {
        title: info.title || info.description || `Instagram ${type === 'reel' ? 'Reel' : 'Post'}`,
        type,
        thumbnail,
        duration: formatDuration(info.duration),
        quality,
        downloadUrl,
        author: info.uploader || info.channel || null,
        username: info.uploader_id || null,
        timestamp: info.upload_date
            ? new Date(
                info.upload_date.slice(0, 4) + '-' +
                info.upload_date.slice(4, 6) + '-' +
                info.upload_date.slice(6, 8)
              ).toISOString()
            : new Date().toISOString(),
        filesize: formatFilesize(info.filesize || info.filesize_approx),
        // Pass along the raw yt-dlp http headers so our proxy can forward them
        httpHeaders: info.http_headers || {},
    };
};

module.exports = { fetchMediaDetails };