/**
 * Service to handle media extraction from Instagram URLs using yt-dlp.
 * yt-dlp is a reliable, actively maintained tool that handles Instagram's
 * bot detection and extracts direct CDN video/image URLs.
 *
 * Cross-platform strategy:
 *  1. Try `python -m yt_dlp` (works everywhere pip is available)
 *  2. Try `python3 -m yt_dlp` (Linux/macOS alias)
 *  3. Try `yt-dlp` binary on PATH (when installed as a system binary)
 *  4. Fallback to known Windows paths (local dev only)
 */

const { execFile, spawn } = require('child_process');
const path = require('path');

/**
 * Run yt-dlp using one of several strategies:
 *  - `python -m yt_dlp`  → most portable (pip install yt-dlp)
 *  - `python3 -m yt_dlp` → Linux/macOS
 *  - `yt-dlp` binary     → system PATH (binary install)
 */
function runYtDlp(args) {
    return new Promise((resolve, reject) => {
        // Each entry: [executable, ...prefixArgs]
        const strategies = [
            ['python',  ['-m', 'yt_dlp']],
            ['python3', ['-m', 'yt_dlp']],
            ['yt-dlp',  []],
            // Windows local-dev fallback
            [
                path.join(
                    process.env.LOCALAPPDATA || '',
                    'Packages',
                    'PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0',
                    'LocalCache', 'local-packages', 'Python313', 'Scripts', 'yt-dlp.exe'
                ),
                []
            ],
        ];

        let tried = 0;

        function tryNext() {
            if (tried >= strategies.length) {
                return reject(new Error(
                    'yt-dlp not found. Install it with: pip install yt-dlp'
                ));
            }

            const [exe, prefix] = strategies[tried++];
            const fullArgs = [...prefix, ...args];

            execFile(
                exe,
                fullArgs,
                { timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
                (err, stdout, stderr) => {
                    if (err) {
                        // ENOENT = binary not found → try next strategy
                        // 'not recognized' = Windows CMD equivalent of ENOENT
                        if (
                            err.code === 'ENOENT' ||
                            (err.message && err.message.includes('not recognized')) ||
                            (err.message && err.message.includes('No module named'))
                        ) {
                            return tryNext();
                        }
                        // Real error (e.g. yt-dlp itself returned non-zero)
                        return reject(new Error(stderr || err.message));
                    }
                    resolve(stdout.trim());
                }
            );
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

    // Get direct download URL (best quality combined video + audio format)
    let downloadUrl = null;
    if (isVideo && info.formats && info.formats.length > 0) {
        const combinedFormats = info.formats.filter(f =>
            f.url &&
            f.vcodec !== 'none' &&
            f.acodec !== 'none' &&
            f.ext === 'mp4'
        );

        if (combinedFormats.length > 0) {
            // Sort by height (resolution) descending — pick best quality
            combinedFormats.sort((a, b) => (b.height || 0) - (a.height || 0));
            downloadUrl = combinedFormats[0].url;
        }
    }

    // Fallback if no combined format was found or if it's a photo/post
    if (!downloadUrl) {
        downloadUrl = info.url || (info.formats && info.formats[info.formats.length - 1]?.url);
    }

    if (!downloadUrl) {
        const err = new Error('Could not extract a direct download URL. The post may be private.');
        err.name = 'MediaRetrievalError';
        throw err;
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