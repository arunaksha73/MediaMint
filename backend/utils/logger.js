const getTimestamp = () => new Date().toISOString();

const info = (message) => {
    console.log(`[INFO] [${getTimestamp()}] ${message}`);
};

const error = (message, err = null) => {
    console.error(`[ERROR] [${getTimestamp()}] ${message}`);
    if (err && err.stack) {
        console.error(err.stack);
    }
};

const warn = (message) => {
    console.warn(`[WARN] [${getTimestamp()}] ${message}`);
};

module.exports = { info, error, warn };