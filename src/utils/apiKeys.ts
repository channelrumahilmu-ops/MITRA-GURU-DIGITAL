import type { ApiKeySlots } from '../types';

const STORAGE_KEY = 'ruangguru_gemini_api_keys_v1';

export function loadApiKeysFromStorage(): ApiKeySlots {
  if (typeof window === 'undefined') {
    return ['', '', ''];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return ['', '', ''];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ['', '', ''];
    return [
      typeof parsed[0] === 'string' ? parsed[0] : '',
      typeof parsed[1] === 'string' ? parsed[1] : '',
      typeof parsed[2] === 'string' ? parsed[2] : '',
    ];
  } catch {
    return ['', '', ''];
  }
}

export function saveApiKeysToStorage(keys: ApiKeySlots): ApiKeySlots {
  const sanitized: ApiKeySlots = [
    keys[0].trim(),
    keys[1].trim(),
    keys[2].trim(),
  ];
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function deleteApiKeySlotInStorage(slotIndex: 0 | 1 | 2): ApiKeySlots {
  const current = loadApiKeysFromStorage();
  const updated: ApiKeySlots = [...current] as ApiKeySlots;
  updated[slotIndex] = '';
  return saveApiKeysToStorage(updated);
}

export function countFilledApiKeys(keys: ApiKeySlots): number {
  return keys.filter((k) => k.trim().length > 0).length;
}
