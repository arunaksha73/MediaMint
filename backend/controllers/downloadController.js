const instagramService = require('../services/instagramService');
const { successResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getMedia = async (req, res, next) => {
    try {
        const { url } = req.body;
        logger.info(`Processing download request for URL: ${url}`);

        const mediaData = await instagramService.fetchMediaDetails(url);

        logger.info(`Successfully retrieved media data for: ${url}`);
        return successResponse(res, mediaData, 200);

    } catch (error) {
        logger.error(`Error processing URL: ${error.message}`);
        
        // Mark known service errors as operational to pass the message to the client
        if (error.name === 'MediaRetrievalError') {
            error.statusCode = 422;
            error.isOperational = true;
        }
        
        next(error);
    }
};

module.exports = { getMedia };