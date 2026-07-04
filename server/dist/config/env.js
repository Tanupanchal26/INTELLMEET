"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const joi_1 = __importDefault(require("joi"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
// Normalise: support both MONGO_URI and MONGODB_URI
if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
    process.env.MONGO_URI = process.env.MONGODB_URI;
}
const schema = joi_1.default.object({
    NODE_ENV: joi_1.default.string()
        .valid('development', 'staging', 'production', 'test')
        .default('development'),
    PORT: joi_1.default.number().default(5000),
    MONGO_URI: joi_1.default.string().required(),
    JWT_SECRET: joi_1.default.string().min(32).required(),
    JWT_EXPIRES_IN: joi_1.default.string().default('15m'),
    JWT_REFRESH_SECRET: joi_1.default.string().min(32).required(),
    JWT_REFRESH_EXPIRES_IN: joi_1.default.string().default('7d'),
    SESSION_SECRET: joi_1.default.string().min(32).required(),
    ALLOWED_ORIGINS: joi_1.default.string().default('http://localhost:5173'),
    CLOUDINARY_CLOUD_NAME: joi_1.default.string().optional().allow(''),
    CLOUDINARY_API_KEY: joi_1.default.string().optional().allow(''),
    CLOUDINARY_API_SECRET: joi_1.default.string().optional().allow(''),
    OPENAI_API_KEY: joi_1.default.string().optional().allow(''),
    SMTP_HOST: joi_1.default.string().optional().allow(''),
    SMTP_PORT: joi_1.default.number().default(587),
    SMTP_USER: joi_1.default.string().optional().allow(''),
    SMTP_PASS: joi_1.default.string().optional().allow(''),
    SMTP_FROM: joi_1.default.string().default('noreply@intellmeet.com'),
    GOOGLE_CLIENT_ID: joi_1.default.string().optional().allow(''),
    GOOGLE_CLIENT_SECRET: joi_1.default.string().optional().allow(''),
    GOOGLE_CALLBACK_URL: joi_1.default.string().default('http://localhost:5000/api/v1/auth/google/callback'),
    CLIENT_URL: joi_1.default.string().default('http://localhost:5173'),
}).unknown(true);
const { error, value: env } = schema.validate(process.env);
if (error) {
    console.error(`\n[CONFIG ERROR] Environment validation failed:\n  ${error.message}\n`);
    process.exit(1);
}
// Reject placeholder secrets in production
if (env.NODE_ENV === 'production') {
    const placeholders = ['replace-with', 'your-secret', 'changeme', 'example', 'placeholder'];
    const sensitiveKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET', 'OPENAI_API_KEY', 'CLOUDINARY_API_SECRET', 'GOOGLE_CLIENT_SECRET'];
    for (const key of sensitiveKeys) {
        const val = (env[key] ?? '').toLowerCase();
        if (placeholders.some((p) => val.includes(p))) {
            console.error(`\n[CONFIG ERROR] ${key} contains a placeholder value — set a real secret in production.\n`);
            process.exit(1);
        }
    }
}
const config = {
    env: env.NODE_ENV,
    port: env.PORT,
    isDev: env.NODE_ENV === 'development',
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    mongo: { uri: env.MONGO_URI },
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        refreshSecret: env.JWT_REFRESH_SECRET,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    sessionSecret: env.SESSION_SECRET,
    cors: {
        allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    },
    cloudinary: {
        name: env.CLOUDINARY_CLOUD_NAME ?? '',
        key: env.CLOUDINARY_API_KEY ?? '',
        secret: env.CLOUDINARY_API_SECRET ?? '',
    },
    openai: { apiKey: env.OPENAI_API_KEY ?? '' },
    smtp: {
        host: env.SMTP_HOST ?? '',
        port: env.SMTP_PORT,
        user: env.SMTP_USER ?? '',
        pass: env.SMTP_PASS ?? '',
        from: env.SMTP_FROM,
    },
    google: {
        clientId: env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
        callbackUrl: env.GOOGLE_CALLBACK_URL,
    },
    clientUrl: env.CLIENT_URL,
};
exports.default = config;
module.exports = config;
module.exports.default = config;
