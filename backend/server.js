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
app.use(cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// Route Mounting
app.use('/api/download', downloadRoutes);

// Proxy download route — streams Instagram CDN videos through our server
app.get('/api/proxy/download', proxyDownload);

// Serve static frontend files individually for security (do not expose backend directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, '../script.js'));
});
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, '../style.css'));
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