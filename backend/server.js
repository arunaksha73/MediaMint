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

// Trust Railway/Render reverse proxy so express-rate-limit gets real client IPs
app.set('trust proxy', 1);

// Security & Optimization Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — allow all origins (this is a public read-only API)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting to all requests
app.use(rateLimiter);

// Request Logging Middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// ── Health check — used by Railway/Render to verify the service is running
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', ts: Date.now() }));

// ── API Routes (must be before the static file handler)
app.use('/api/download', downloadRoutes);
app.get('/api/proxy/download', proxyDownload);

// ── 404 JSON handler for unknown /api/* paths
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ── Serve static frontend (only when the frontend is NOT hosted separately)
// __dirname is backend/ — the HTML lives one level up (repo root)
const STATIC_ROOT = path.resolve(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'index.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'style.css')));

// ── 404 handler for all other routes
app.use((req, res, next) => {
    const error = new Error(`Route Not Found: ${req.originalUrl}`);
    error.statusCode = 404;
    error.isOperational = true;
    next(error);
});

// ── Centralized Error Handler (must be last)
app.use(errorHandler);

// ── Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server initialized.');
    logger.info(`Environment: ${config.env}`);
    logger.info(`Listening on port: ${PORT}`);
});

// ── Global crash guards — prevent silent process exits in production
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception — shutting down', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    process.exit(1);
});