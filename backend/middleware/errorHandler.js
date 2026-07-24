const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
    logger.error(`Exception handled: ${err.message}`, err);

    const statusCode = err.statusCode || 500;
    const message = err.isOperational 
        ? err.message 
        : 'Internal Server Error';

    return errorResponse(res, message, statusCode);
};

module.exports = errorHandler;