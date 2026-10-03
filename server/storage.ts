import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config';
import { requireCondition } from './errors';
function storageHeaders(): Record<string, string> {
  return {
    apikey: config.supabaseKey,
    ...(config.supabaseKey.startsWith('eyJ')
      ? { Authorization: `Bearer ${config.supabaseKey}` }
      : {}),
  };
}
export function detectFile(buffer: Buffer): string | undefined {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  return undefined;
}
function safePath(key: string) {
  requireCondition(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key), 400, 'Invalid storage key.');
  const base = path.resolve(config.storageDir),
    file = path.resolve(base, key);
  requireCondition(file.startsWith(base + path.sep), 400, 'Invalid storage path.');
  return file;
}
export async function uploadFile(owner: string, buffer: Buffer, mime: string) {
  const key = `${owner}/${randomUUID()}`;
  if (config.storage === 'supabase') {
    requireCondition(
      config.supabaseUrl && config.supabaseKey,
      503,
      'File storage is not configured.',
    );
    const response = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${config.bucket}/${key}`,
      {
        method: 'POST',
        headers: {
          ...storageHeaders(),
          'Content-Type': mime,
          'x-upsert': 'false',
        },
        body: new Uint8Array(buffer),
        signal: AbortSignal.timeout(30000),
      },
    );
    requireCondition(response.ok, 502, 'File storage upload failed.');
  } else {
    const file = safePath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer, { flag: 'wx' });
  }
  return key;
}
export async function downloadFile(key: string) {
  if (config.storage === 'supabase') {
    const response = await fetch(
      `${config.supabaseUrl}/storage/v1/object/authenticated/${config.bucket}/${key}`,
      {
        headers: storageHeaders(),
        signal: AbortSignal.timeout(20000),
      },
    );
    requireCondition(response.ok, 404, 'File is unavailable.');
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFile(safePath(key));
}
export async function deleteFile(key: string) {
  if (config.storage === 'supabase') {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.bucket}`, {
      method: 'DELETE',
      headers: {
        ...storageHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [key] }),
      signal: AbortSignal.timeout(20000),
    });
    requireCondition(response.ok, 502, 'File deletion failed.');
  } else
    await fs.unlink(safePath(key)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
}
