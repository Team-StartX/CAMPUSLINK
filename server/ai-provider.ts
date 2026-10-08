import { config } from './config';

export function hasAiConsent(account: { aiConsent?: boolean; aiConsentProvider?: string }) {
  return Boolean(account.aiConsent && (account.aiConsentProvider || 'openai') === config.ai);
}

export function aiConfigured() {
  return config.ai === 'gemini'
    ? Boolean(config.geminiKey)
    : config.ai === 'openai' && Boolean(config.aiKey);
}

export function aiLabel() {
  return config.ai === 'gemini' ? 'Google Gemini' : 'OpenAI';
}

export async function generateStructured(options: {
  name: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}) {
  if (!aiConfigured()) throw new Error('AI provider is not configured.');
  const gemini = config.ai === 'gemini';
  const response = await fetch(
    gemini
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`
      : 'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      headers: gemini
        ? { 'x-goog-api-key': config.geminiKey, 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${config.aiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify(
        gemini
          ? {
              store: false,
              systemInstruction: { parts: [{ text: options.instructions }] },
              contents: [{ role: 'user', parts: [{ text: options.input }] }],
              generationConfig: {
                maxOutputTokens: options.maxTokens + 2048,
                responseMimeType: 'application/json',
                responseJsonSchema: options.schema,
              },
            }
          : {
              model: config.aiModel,
              store: false,
              max_output_tokens: options.maxTokens,
              instructions: options.instructions,
              input: options.input,
              text: {
                format: {
                  type: 'json_schema',
                  name: options.name,
                  strict: true,
                  schema: options.schema,
                },
              },
            },
      ),
    },
  );
  if (!response.ok)
    throw new Error('AI provider request failed. Local analysis is still available.');
  const body = await response.json();
  let text: string | undefined;
  if (gemini) {
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('AI response was incomplete.');
    text = candidate.content?.parts
      ?.filter(
        (part: { thought?: boolean; text?: string }) =>
          !part.thought && typeof part.text === 'string',
      )
      .map((part: { text: string }) => part.text)
      .join('');
  } else {
    if (body.status === 'incomplete') throw new Error('AI response was incomplete.');
    text = body.output
      ?.flatMap((item: { content?: unknown[] }) => item.content || [])
      .find((item: { type: string }) => item.type === 'output_text')?.text;
  }
  if (!text) throw new Error('AI provider returned no usable feedback.');
  return JSON.parse(text) as unknown;
}
