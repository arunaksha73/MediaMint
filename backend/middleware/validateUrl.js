const { errorResponse } = require('../utils/response');

const validateUrl = (req, res, next) => {
    const { url } = req.body;

    if (!url) {
        return errorResponse(res, 'URL parameter is required', 400);
    }

    if (typeof url !== 'string' || url.trim() === '') {
        return errorResponse(res, 'URL must be a non-empty string', 400);
    }

    // Validate Instagram URL format (supports /p/, /reel/, /tv/)
    const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?/;
    
    if (!instagramRegex.test(url)) {
        return errorResponse(res, 'Invalid Instagram media URL. Must be a public post, reel, or IGTV link.', 400);
    }

    // Clean URL by stripping query parameters for consistency
    req.body.url = url.split('?')[0];
    next();
};

module.exports = validateUrl;