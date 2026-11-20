import express, { type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TRANSIENT_RETRIES = 2;

interface GenerateRequestBody {
  apiKeys?: unknown;
  prompt?: unknown;
  jsonSchema?: unknown;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const errObj = error as { status?: unknown; code?: unknown; statusCode?: unknown };
  if (typeof errObj.status === 'number') return errObj.status;
  if (typeof errObj.statusCode === 'number') return errObj.statusCode;
  if (typeof errObj.code === 'number') return errObj.code;
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function isKeyOrQuotaFailure(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 400 || status === 401 || status === 403 || status === 429) {
    return true;
  }
  const msg = getErrorMessage(error).toUpperCase();
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API KEY NOT VALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QUOTA') ||
    msg.includes('403') ||
    msg.includes('429')
  );
}

function isTransientFailure(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 500 && status < 600) {
    return true;
  }
  const msg = getErrorMessage(error).toUpperCase();
  return (
    msg.includes('TIMEOUT') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('FETCH FAILED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiWithTimeout(
  apiKey: string,
  prompt: string,
  jsonSchema?: Record<string, unknown>
): Promise<{ text: string; data?: unknown }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const config =
    jsonSchema && typeof jsonSchema === 'object'
      ? {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema,
        }
      : undefined;

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('REQUEST_TIMEOUT'));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        ...(config ? { config } : {}),
      }),
      timeoutPromise,
    ]);

    const text = response.text ?? '';
    if (jsonSchema && text) {
      try {
        return { text, data: JSON.parse(text) };
      } catch {
        return { text };
      }
    }
    return { text };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/generate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as GenerateRequestBody;

    if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      res.status(400).json({ error: 'Prompt tidak boleh kosong.' });
      return;
    }

    if (!Array.isArray(body.apiKeys)) {
      res.status(400).json({ error: 'Daftar API key tidak valid.' });
      return;
    }

    const validKeys = body.apiKeys
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    if (validKeys.length === 0) {
      res.status(400).json({ error: 'Semua API key tidak valid atau kuota habis' });
      return;
    }

    const prompt = body.prompt.trim();
    const jsonSchema =
      body.jsonSchema && typeof body.jsonSchema === 'object' && !Array.isArray(body.jsonSchema)
        ? (body.jsonSchema as Record<string, unknown>)
        : undefined;

    for (let keyIdx = 0; keyIdx < validKeys.length; keyIdx++) {
      const currentKey = validKeys[keyIdx];
      let attempt = 0;

      while (attempt <= MAX_TRANSIENT_RETRIES) {
        try {
          const outcome = await callGeminiWithTimeout(currentKey, prompt, jsonSchema);
          res.status(200).json({
            result: outcome.text,
            ...(outcome.data !== undefined ? { data: outcome.data } : {}),
          });
          return;
        } catch (error) {
          if (isKeyOrQuotaFailure(error)) {
            break;
          }
          if (isTransientFailure(error) && attempt < MAX_TRANSIENT_RETRIES) {
            attempt += 1;
            await sleep(400 * attempt);
            continue;
          }
          break;
        }
      }
    }

    res.status(400).json({ error: 'Semua API key tidak valid atau kuota habis' });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
