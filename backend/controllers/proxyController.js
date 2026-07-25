/**
 * Download proxy — streams an Instagram CDN video through our server.
 * 
 * This is necessary because:
 * 1. Instagram CDN requires specific User-Agent and referer headers
 * 2. Direct CDN URLs can't be used with <a download> across origins
 * 3. We want to force a proper filename on download
 */

const axios = require('axios');
const logger = require('../utils/logger');

const proxyDownload = async (req, res, next) => {
    try {
        const { url, filename } = req.query;

        if (!url) {
            return res.status(400).json({ success: false, error: 'No URL provided' });
        }

        // Decode the URL
        const decodedUrl = decodeURIComponent(url);

        // Only allow Instagram CDN domains for security
        const allowed = [
            'cdninstagram.com',
            'fbcdn.net',
            'instagram.com',
            'www.w3schools.com',                   // For demo/testing
            'commondatastorage.googleapis.com',    // For demo
        ];

        let urlObj;
        try {
            urlObj = new URL(decodedUrl);
        } catch (_) {
            return res.status(400).json({ success: false, error: 'Invalid URL format' });
        }

        const isAllowed = allowed.some(domain => urlObj.hostname.endsWith(domain));

        if (!isAllowed) {
            return res.status(403).json({ success: false, error: 'Domain not allowed for proxy download' });
        }

        // Stream the file from CDN → client
        const response = await axios.get(decodedUrl, {
            responseType: 'stream',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.instagram.com/',
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
            },
            maxRedirects: 5,
        });

        // Determine filename
        const safeFilename = (filename || 'instagram_reel').replace(/[^a-z0-9_.-]/gi, '_') + '.mp4';

        // Determine content type
        const upstreamType = response.headers['content-type'] || '';
        const contentType  = safeFilename.endsWith('.mp4') ? 'video/mp4'
                           : safeFilename.endsWith('.jpg') ? 'image/jpeg'
                           : upstreamType || 'application/octet-stream';

        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`);
        res.setHeader('Content-Type', contentType);
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        // Prevent range requests from bypassing Content-Disposition on iOS
        res.setHeader('Accept-Ranges', 'none');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Pipe the stream to client
        response.data.pipe(res);

        response.data.on('error', (err) => {
            logger.error(`Proxy stream error: ${err.message}`);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Stream error: ' + err.message });
            }
        });

    } catch (error) {
        logger.error(`Proxy controller error: ${error.message}`);
        if (!res.headersSent) {
            next(error);
        }
    }
};

module.exports = { proxyDownload };

