import { GoogleGenAI, Type, type Schema } from '@google/genai';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TRANSIENT_RETRIES = 2;
const ALL_KEYS_FAILED_ERROR = 'Semua API key tidak valid atau kuota habis';

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

function isKeyOrQuotaError(error: unknown): boolean {
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

function isTransientServerError(error: unknown): boolean {
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
    msg.includes('FETCH FAILED') ||
    msg.includes('UNAVAILABLE')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const SOAL_JSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: {
        judul: { type: Type.STRING },
        sekolah: { type: Type.STRING },
        mapel: { type: Type.STRING },
        kelas: { type: Type.STRING },
      },
      required: ['judul', 'sekolah', 'mapel', 'kelas'],
    },
    soal: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          no: { type: Type.INTEGER },
          tipe: { type: Type.STRING },
          stimulus: { type: Type.STRING },
          pertanyaan: { type: Type.STRING },
          opsi: {
            type: Type.OBJECT,
            properties: {
              A: { type: Type.STRING },
              B: { type: Type.STRING },
              C: { type: Type.STRING },
              D: { type: Type.STRING },
              E: { type: Type.STRING },
            },
          },
          kunci: { type: Type.STRING },
          pembahasan: { type: Type.STRING },
          indikator: { type: Type.STRING },
          level_kognitif: { type: Type.STRING },
          kesulitan: { type: Type.STRING },
        },
        required: [
          'no',
          'tipe',
          'stimulus',
          'pertanyaan',
          'kunci',
          'pembahasan',
          'indikator',
          'level_kognitif',
          'kesulitan',
        ],
      },
    },
  },
  required: ['meta', 'soal'],
};

async function invokeGeminiWithTimeout(
  apiKey: string,
  prompt: string,
  jsonSchema?: Schema
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

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
        config: jsonSchema
          ? {
              responseMimeType: 'application/json',
              responseSchema: jsonSchema,
            }
          : undefined,
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

export async function generateWithFallback<T = unknown>(
  prompt: string,
  jsonSchema: Schema | undefined,
  apiKeys: string[]
): Promise<{ text: string; data: T | null }> {
  const cleanedKeys = apiKeys
    .map((key) => (typeof key === 'string' ? key.trim() : ''))
    .filter((key) => key.length > 0);

  if (cleanedKeys.length === 0) {
    throw new Error(
      'Belum ada Gemini API Key yang terisi. Silakan masukkan API Key pada menu Pengaturan API Key.'
    );
  }

  let lastNonKeyError: string | null = null;

  for (const currentKey of cleanedKeys) {
    let retryCount = 0;

    while (retryCount <= MAX_TRANSIENT_RETRIES) {
      try {
        const text = await invokeGeminiWithTimeout(currentKey, prompt, jsonSchema);
        if (jsonSchema) {
          const parsed = JSON.parse(text) as T;
          return { text, data: parsed };
        }
        return { text, data: null };
      } catch (error) {
        if (isKeyOrQuotaError(error)) {
          break;
        }
        if (isTransientServerError(error) && retryCount < MAX_TRANSIENT_RETRIES) {
          retryCount += 1;
          await sleep(500 * retryCount);
          continue;
        }
        lastNonKeyError =
          error instanceof Error ? error.message : 'Gagal memproses respons AI.';
        break;
      }
    }
  }

  if (lastNonKeyError && !lastNonKeyError.includes('TIMEOUT')) {
    throw new Error(ALL_KEYS_FAILED_ERROR);
  }

  throw new Error(ALL_KEYS_FAILED_ERROR);
}
