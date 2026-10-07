import type { Express } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config';
import { HttpError, requireCondition } from './errors';

export const speechConfigured = () => config.speech === 'openai' && Boolean(config.aiKey);
function audioFormat(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm';
  if (buffer.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE')
    return 'wav';
  return undefined;
}
export async function transcribeAudio(buffer: Buffer) {
  requireCondition(
    speechConfigured(),
    503,
    'Voice transcription is not configured. You can type a response instead.',
  );
  const format = audioFormat(buffer);
  requireCondition(
    format,
    415,
    'Unsupported recording format. Record audio again in a supported browser.',
  );
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)]), `practice.${format}`);
  form.append('model', config.speechModel);
  form.append('language', 'en');
  form.append('response_format', 'json');
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.aiKey}` },
      body: form,
      signal: AbortSignal.timeout(45000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new HttpError(
        503,
        'Voice transcription is temporarily unavailable. Please try again or type your response.',
      );
    const body = await response.text();
    requireCondition(
      body.length <= 65536,
      502,
      'The transcription service returned an invalid response.',
    );
    const result = z
      .object({ text: z.string().trim().min(1).max(6000) })
      .safeParse(JSON.parse(body));
    requireCondition(
      result.success,
      422,
      'No usable speech was recognized. Try a shorter recording or type your response.',
    );
    return result.data.text;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      'Voice transcription could not be completed. Please try again or type your response.',
    );
  }
}
export function mountSpeech(app: Express) {
  const base = '/api/v1/voice';
  app.get(`${base}/capabilities`, (_req, res) =>
    res.json({ available: speechConfigured(), provider: speechConfigured() ? 'openai' : null }),
  );
  const limit = rateLimit({
    windowMs: 60000,
    limit: 4,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
  });
  app.post(
    `${base}/transcriptions`,
    limit,
    (_req, res, next) => {
      try {
        const actor = res.locals.account;
        requireCondition(
          actor.role === 'student' && actor.approved,
          403,
          'Student access required.',
        );
        requireCondition(
          speechConfigured(),
          503,
          'Voice transcription is not configured. You can type a response instead.',
        );
        next();
      } catch (error) {
        next(error);
      }
    },
    upload.single('file'),
    async (req, res) => {
      requireCondition(
        req.body.consent === 'true',
        400,
        'Allow audio transcription before sending a recording.',
      );
      requireCondition(
        req.file && req.file.size > 0,
        400,
        'Record some audio before transcribing.',
      );
      const text = await transcribeAudio(req.file.buffer);
      // Audio remains in request memory only; it is never placed in document storage.
      res.json({ text });
    },
  );
}
