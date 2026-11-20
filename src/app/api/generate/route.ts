import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TRANSIENT_RETRIES = 2;
const FALLBACK_ERROR_MESSAGE = 'Semua API key tidak valid atau kuota habis';

interface GenerateRequestBody {
  apiKeys?: unknown;
  prompt?: unknown;
  jsonSchema?: unknown;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const errObj = error as { status?: unknown; statusCode?: unknown; code?: unknown };
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

function isKeyInvalidOrQuotaExhausted(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === 400 || status === 401 || status === 403 || status === 429) {
    return true;
  }
  const msg = getErrorMessage(error).toUpperCase();
  return (
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API KEY NOT VALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QUOTA')
  );
}

function isTransientOrTimeoutError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined && status >= 500 && status < 600) {
    return true;
  }
  const msg = getErrorMessage(error).toUpperCase();
  return (
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('TIMEOUT') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('FETCH FAILED') ||
    msg.includes('UNAVAILABLE')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithKey(
  currentKey: string,
  prompt: string,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: currentKey,
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

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
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

    return response.text ?? '';
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return Response.json(
      { error: 'Format body JSON tidak valid.' },
      { status: 400 }
    );
  }

  if (typeof body?.prompt !== 'string' || body.prompt.trim().length === 0) {
    return Response.json(
      { error: 'Prompt tidak boleh kosong.' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.apiKeys)) {
    return Response.json(
      { error: FALLBACK_ERROR_MESSAGE },
      { status: 400 }
    );
  }

  const cleanedKeys = body.apiKeys
    .map((key) => (typeof key === 'string' ? key.trim() : ''))
    .filter((key) => key.length > 0);

  if (cleanedKeys.length === 0) {
    return Response.json(
      { error: FALLBACK_ERROR_MESSAGE },
      { status: 400 }
    );
  }

  const prompt = body.prompt.trim();
  const jsonSchema =
    body.jsonSchema && typeof body.jsonSchema === 'object' && !Array.isArray(body.jsonSchema)
      ? (body.jsonSchema as Record<string, unknown>)
      : undefined;

  for (const currentKey of cleanedKeys) {
    let retryCount = 0;

    while (retryCount <= MAX_TRANSIENT_RETRIES) {
      try {
        const resultText = await generateWithKey(currentKey, prompt, jsonSchema);
        return Response.json({ result: resultText }, { status: 200 });
      } catch (error) {
        if (isKeyInvalidOrQuotaExhausted(error)) {
          break;
        }
        if (isTransientOrTimeoutError(error) && retryCount < MAX_TRANSIENT_RETRIES) {
          retryCount += 1;
          await delay(400 * retryCount);
          continue;
        }
        break;
      }
    }
  }

  return Response.json(
    { error: FALLBACK_ERROR_MESSAGE },
    { status: 400 }
  );
}
