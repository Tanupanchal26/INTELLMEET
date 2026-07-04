"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const xss = require('xss-clean');
const hpp_1 = __importDefault(require("hpp"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RedisStore } = require('connect-redis');
const ioredis_1 = __importDefault(require("ioredis"));
const mongoose_1 = __importDefault(require("mongoose"));
const prom_client_1 = __importDefault(require("prom-client"));
const env_1 = __importDefault(require("./config/env"));
const requestId = require('./middleware/requestId.middleware');
const httpLogger_middleware_1 = __importDefault(require("./middleware/httpLogger.middleware"));
const rateLimit_middleware_1 = require("./middleware/rateLimit.middleware");
const notFound = require('./middleware/notFound.middleware');
const error_middleware_1 = __importDefault(require("./middleware/error.middleware"));
const passport_1 = __importDefault(require("./config/passport"));
const index_1 = __importDefault(require("./routes/v1/index"));
const { initSentry, sentryRequestHandler, sentryErrorHandler } = require('./config/sentry');
const app = (0, express_1.default)();
initSentry(app);
app.use(sentryRequestHandler());
app.use(requestId);
// Trust the first proxy hop (nginx) so express-rate-limit sees real client IPs
app.set('trust proxy', 1);
const safeClientUrl = (env_1.default.clientUrl ?? '').trim().replace(/[\r\n\0]/g, '');
const connectSrcDirectives = ["'self'"];
if (safeClientUrl) {
    connectSrcDirectives.push(safeClientUrl, safeClientUrl.replace(/^http/, 'ws'));
}
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://lh3.googleusercontent.com'],
            connectSrc: connectSrcDirectives,
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
}));
const corsOptions = {
    origin: (origin, cb) => {
        // Allow same-origin / server-to-server requests (no Origin header)
        if (!origin)
            return cb(null, true);
        if (env_1.default.cors.allowedOrigins.includes(origin))
            return cb(null, true);
        return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(httpLogger_middleware_1.default);
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
app.use((0, cookie_parser_1.default)());
let redisClient = null;
try {
    if (process.env.REDIS_URL) {
        redisClient = new ioredis_1.default(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false });
        redisClient.on('error', (err) => console.warn('[Redis] connection error:', err.message));
    }
}
catch (e) {
    console.warn('[Redis] failed to initialize, sessions will use memory store');
}
app.use((0, express_session_1.default)({
    store: redisClient ? new RedisStore({ client: redisClient }) : undefined,
    secret: env_1.default.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: 'none', maxAge: 10 * 60 * 1000 },
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use((0, express_mongo_sanitize_1.default)());
app.use(xss());
app.use((0, hpp_1.default)());
app.use('/api', rateLimit_middleware_1.apiLimiter);
prom_client_1.default.collectDefaultMetrics();
app.get('/health', async (_req, res) => {
    const mongo = mongoose_1.default.connection.readyState === 1;
    const status = mongo ? 'ok' : 'degraded';
    res.status(status === 'ok' ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        requestId: res.locals.requestId,
        dependencies: { mongo },
    });
});
// /metrics — restricted to internal/admin access only
app.get('/metrics', (req, res, next) => {
    const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const clientIp = (req.ip ?? '').replace('::ffff:', '');
    const adminKey = req.headers['x-metrics-key'];
    const validKey = process.env.METRICS_SECRET_KEY;
    if (!allowedIPs.includes(clientIp) && (!validKey || adminKey !== validKey)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
}, async (_req, res) => {
    res.set('Content-Type', prom_client_1.default.register.contentType);
    res.end(await prom_client_1.default.register.metrics());
});
app.use('/api/v1', index_1.default);
app.use('/api', (req, res, next) => {
    if (req.url.startsWith('/v1'))
        return next();
    res.redirect(301, `/api/v1${req.url}`);
});
app.use(notFound);
app.use(sentryErrorHandler());
app.use(error_middleware_1.default);
exports.default = app;
module.exports = app;
module.exports.default = app;
