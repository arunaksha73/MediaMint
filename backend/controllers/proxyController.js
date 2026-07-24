/**
 * Download proxy — streams an Instagram CDN video through our server.
 * 
 * This is necessary because:
 * 1. Instagram CDN requires specific User-Agent and referer headers
 * 2. Direct CDN URLs can't be used with <a download> across origins
 * 3. We want to force a proper filename on download
 */

const axios = require('axios');

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
            'www.w3schools.com',   // For demo/testing
            'commondatastorage.googleapis.com',  // For demo
        ];
        const urlObj = new URL(decodedUrl);
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

        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Pipe the stream to client
        response.data.pipe(res);

        response.data.on('error', (err) => {
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'Stream error: ' + err.message });
            }
        });

    } catch (error) {
        if (!res.headersSent) {
            next(error);
        }
    }
};

module.exports = { proxyDownload };
