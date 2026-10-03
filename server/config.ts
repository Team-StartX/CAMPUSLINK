import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve('server/.env'), quiet: true });
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 8000),
  host: process.env.HOST || '0.0.0.0',
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  database: process.env.DATABASE_URL || '',
  databaseCaPath: process.env.DATABASE_CA_PATH || '',
  localDatabase: process.env.SQLITE_PATH || 'server/data/campuslink.sqlite',
  storage: process.env.STORAGE_PROVIDER || 'local',
  storageDir: process.env.STORAGE_DIR || 'server/data/uploads',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SECRET_KEY || '',
  bucket: process.env.SUPABASE_STORAGE_BUCKET || 'campuslink-private',
  email: process.env.EMAIL_PROVIDER || 'outbox',
  resendKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  ai: process.env.AI_PROVIDER || 'local',
  aiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  modelPath: process.env.ML_MODEL_PATH || 'server/models/placement.json',
  mlApiUrl: process.env.ML_API_URL || 'https://campuslink-ml-demo.onrender.com',
  mlApiToken: process.env.ML_API_TOKEN || '',
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535.');
if (
  config.production &&
  (!config.database || config.email === 'outbox' || config.storage === 'local')
)
  throw new Error('Production requires PostgreSQL, external private storage and email delivery.');
if (config.production) {
  const missing = [
    !process.env.FRONTEND_URL && 'FRONTEND_URL',
    config.storage === 'supabase' && !config.supabaseUrl && 'SUPABASE_URL',
    config.storage === 'supabase' && !config.supabaseKey && 'SUPABASE_SECRET_KEY',
    config.email === 'resend' && !config.resendKey && 'RESEND_API_KEY',
    config.email === 'resend' && !config.emailFrom && 'EMAIL_FROM',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);
}
