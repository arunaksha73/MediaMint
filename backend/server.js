const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config/app');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const downloadRoutes = require('./routes/download');
const { proxyDownload } = require('./controllers/proxyController');

const app = express();

// Security & Optimization Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS — allow all origins so the Vercel frontend can always reach this Render backend.
// This is a public read-only API (no auth tokens, no user data), so wildcard is safe.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (req.method === 'OPTIONS') {
        // Handle preflight immediately — don't pass to route handlers
        return res.sendStatus(204);
    }
    next();
});
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all requests
app.use(rateLimiter);

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Health check — returns instantly, used to wake up Render's free-tier instance
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));


// Route Mounting – must be before static file handlers so API requests are caught
app.use('/api/download', downloadRoutes);
app.get('/api/proxy/download', proxyDownload);

// Serve static frontend files individually for security (do not expose backend directory)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, '../script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, '../style.css')));

// 404 JSON handler for any unknown API path
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// 404 Handler for undefined routes
app.use((req, res, next) => {
    const error = new Error(`Route Not Found: ${req.originalUrl}`);
    error.statusCode = 404;
    error.isOperational = true;
    next(error);
});

// Centralized Error Handling
app.use(errorHandler);

// Start Server
app.listen(config.port, () => {
    logger.info(`Server initialized.`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Listening on port: ${config.port}`);
});