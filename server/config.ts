import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve('server/.env'), quiet: true });
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 8000),
  host: process.env.HOST || '0.0.0.0',
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  developmentOrigins: (process.env.DEV_FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
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
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  speech: process.env.SPEECH_PROVIDER || 'disabled',
  speechModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
  modelPath: process.env.ML_MODEL_PATH || 'server/models/placement.json',
  mlApiUrl: process.env.ML_API_URL || '',
  mlApiToken: process.env.ML_API_TOKEN || '',
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535.');
if (!['local', 'supabase'].includes(config.storage))
  throw new Error('STORAGE_PROVIDER must be local or supabase.');
if (!['outbox', 'resend'].includes(config.email))
  throw new Error('EMAIL_PROVIDER must be outbox or resend.');
if (!['local', 'openai', 'gemini'].includes(config.ai))
  throw new Error('AI_PROVIDER must be local, openai or gemini.');
if (!['disabled', 'openai'].includes(config.speech))
  throw new Error('SPEECH_PROVIDER must be disabled or openai.');
if (config.speech === 'openai' && !config.aiKey)
  throw new Error('OPENAI_API_KEY is required when SPEECH_PROVIDER is openai.');
if (
  config.production &&
  (!config.database || config.email === 'outbox' || config.storage === 'local')
)
  throw new Error('Production requires PostgreSQL, external private storage and email delivery.');
if (config.production) {
  if (config.ai === 'gemini' && !config.geminiKey)
    throw new Error('GEMINI_API_KEY is required when AI_PROVIDER is gemini.');
  const missing = [
    !process.env.FRONTEND_URL && 'FRONTEND_URL',
    config.storage === 'supabase' && !config.supabaseUrl && 'SUPABASE_URL',
    config.storage === 'supabase' && !config.supabaseKey && 'SUPABASE_SECRET_KEY',
    config.email === 'resend' && !config.resendKey && 'RESEND_API_KEY',
    config.email === 'resend' && !config.emailFrom && 'EMAIL_FROM',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);
  function requireHttpsOrigin(value: string, setting: string) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
        throw new Error();
    } catch {
      throw new Error(`${setting} must be an HTTPS origin without a path or trailing slash.`);
    }
  }
  requireHttpsOrigin(config.origin, 'FRONTEND_URL');
  requireHttpsOrigin(config.supabaseUrl, 'SUPABASE_URL');
  try {
    const databaseUrl = new URL(config.database);
    if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) throw new Error();
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  if (config.ai === 'openai' && !config.aiKey)
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER is openai.');
}
