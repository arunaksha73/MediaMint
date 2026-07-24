require('dotenv').config();

// CORS_ORIGIN can be a comma-separated list for multiple allowed origins
// e.g. "https://media-mint.vercel.app,https://media-mint.onrender.com"
const rawCorsOrigin = process.env.CORS_ORIGIN || '*';
const corsOriginParsed = rawCorsOrigin.includes(',')
    ? rawCorsOrigin.split(',').map(s => s.trim())
    : rawCorsOrigin;

module.exports = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    corsOrigin: corsOriginParsed,
};