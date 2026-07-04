import Joi from 'joi';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Normalise: support both MONGO_URI and MONGODB_URI
if (!process.env.MONGO_URI && process.env.MONGODB_URI) {
  process.env.MONGO_URI = process.env.MONGODB_URI;
}

export interface Config {
  env:    string;
  port:   number;
  isDev:  boolean;
  isProd: boolean;
  isTest: boolean;
  mongo:  { uri: string };
  jwt: {
    secret:           string;
    expiresIn:        string;
    refreshSecret:    string;
    refreshExpiresIn: string;
  };
  sessionSecret: string;
  cors:      { allowedOrigins: string[] };
  cloudinary: { name: string; key: string; secret: string };
  gemini:     { apiKey: string };
  smtp: {
    host:  string;
    port:  number;
    user:  string;
    pass:  string;
    from:  string;
  };
  google: {
    clientId:     string;
    clientSecret: string;
    callbackUrl:  string;
  };
  clientUrl: string;
}

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(5000),

  MONGO_URI: Joi.string().required(),

  JWT_SECRET:             Joi.string().min(32).required(),
  JWT_EXPIRES_IN:         Joi.string().default('15m'),
  JWT_REFRESH_SECRET:     Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  SESSION_SECRET: Joi.string().min(32).required(),

  ALLOWED_ORIGINS: Joi.string().default('http://localhost:5173'),

  CLOUDINARY_CLOUD_NAME: Joi.string().optional().allow(''),
  CLOUDINARY_API_KEY:    Joi.string().optional().allow(''),
  CLOUDINARY_API_SECRET: Joi.string().optional().allow(''),

  GEMINI_API_KEY: Joi.string().optional().allow(''),

  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  SMTP_FROM: Joi.string().default('noreply@intellmeet.com'),

  GOOGLE_CLIENT_ID:     Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  GOOGLE_CALLBACK_URL:  Joi.string().default('http://localhost:5000/api/v1/auth/google/callback'),

  CLIENT_URL: Joi.string().default('http://localhost:5173'),
}).unknown(true);

const { error, value: env } = schema.validate(process.env);

if (error) {
  console.error(`\n[CONFIG ERROR] Environment validation failed:\n  ${error.message}\n`);
  process.exit(1);
}

// Reject placeholder secrets in production
if (env.NODE_ENV === 'production') {
  const placeholders = ['replace-with', 'your-secret', 'changeme', 'example', 'placeholder'];
  const sensitiveKeys = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET', 'GEMINI_API_KEY', 'CLOUDINARY_API_SECRET', 'GOOGLE_CLIENT_SECRET'];
  for (const key of sensitiveKeys) {
    const val: string = (env[key] ?? '').toLowerCase();
    if (placeholders.some((p) => val.includes(p))) {
      console.error(`\n[CONFIG ERROR] ${key} contains a placeholder value — set a real secret in production.\n`);
      process.exit(1);
    }
  }
}

const config: Config = {
  env:    env.NODE_ENV,
  port:   env.PORT,
  isDev:  env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  mongo:  { uri: env.MONGO_URI },

  jwt: {
    secret:           env.JWT_SECRET,
    expiresIn:        env.JWT_EXPIRES_IN,
    refreshSecret:    env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  sessionSecret: env.SESSION_SECRET,

  cors: {
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()),
  },

  cloudinary: {
    name:   env.CLOUDINARY_CLOUD_NAME ?? '',
    key:    env.CLOUDINARY_API_KEY    ?? '',
    secret: env.CLOUDINARY_API_SECRET ?? '',
  },

  gemini:    { apiKey: env.GEMINI_API_KEY ?? '' },

  smtp: {
    host: env.SMTP_HOST ?? '',
    port: env.SMTP_PORT,
    user: env.SMTP_USER ?? '',
    pass: env.SMTP_PASS ?? '',
    from: env.SMTP_FROM,
  },

  google: {
    clientId:     env.GOOGLE_CLIENT_ID     ?? '',
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:  env.GOOGLE_CALLBACK_URL,
  },

  clientUrl: env.CLIENT_URL,
};

export default config;
module.exports = config;
module.exports.default = config;
