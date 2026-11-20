import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ApiKeySlots } from '../types';
import {
  deleteApiKeySlotInStorage,
  loadApiKeysFromStorage,
  saveApiKeysToStorage,
} from '../utils/apiKeys';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyModal({ isOpen, onClose }: ApiKeyModalProps) {
  const { setApiKeys } = useAuth();
  const [slots, setSlots] = useState<ApiKeySlots>(['', '', '']);
  const [visible, setVisible] = useState<[boolean, boolean, boolean]>([
    false,
    false,
    false,
  ]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSlots(loadApiKeysFromStorage());
      setVisible([false, false, false]);
      setFeedback(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSlotChange = (index: 0 | 1 | 2, value: string) => {
    setSlots((prev) => {
      const next: ApiKeySlots = [...prev] as ApiKeySlots;
      next[index] = value;
      return next;
    });
    setFeedback(null);
  };

  const toggleVisibility = (index: 0 | 1 | 2) => {
    setVisible((prev) => {
      const next: [boolean, boolean, boolean] = [...prev] as [
        boolean,
        boolean,
        boolean,
      ];
      next[index] = !next[index];
      return next;
    });
  };

  const handleDeleteSlot = (index: 0 | 1 | 2) => {
    const updated = deleteApiKeySlotInStorage(index);
    setSlots(updated);
    setApiKeys(updated);
    setFeedback(`Slot ${index + 1} berhasil dihapus dari browser.`);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const saved = saveApiKeysToStorage(slots);
    setSlots(saved);
    setApiKeys(saved);
    setFeedback('API Key berhasil disimpan di penyimpanan lokal browser (localStorage).');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-teal-700 shrink-0" />
            <h2
              id="api-key-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Pengaturan Gemini API Key (BYOK)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal pengaturan API Key"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <p>
              Semua API key disimpan <strong>hanya di localStorage browser Anda</strong> dan tidak pernah disimpan di database atau server. Sistem akan mencoba mulai dari Slot 1 dan otomatis berpindah ke slot berikutnya jika kuota habis atau kunci tidak valid.
            </p>
          </div>

          <div className="space-y-4">
            {([0, 1, 2] as const).map((idx) => {
              const value = slots[idx];
              const isFilled = value.trim().length > 0;
              return (
                <div
                  key={idx}
                  className="p-4 border border-slate-200 rounded-lg space-y-2.5 bg-white"
                >
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor={`gemini-key-slot-${idx + 1}`}
                      className="text-sm font-medium text-slate-900"
                    >
                      Slot API Key {idx + 1}
                    </label>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          isFilled ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {isFilled ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        {isFilled ? 'Terisi' : 'Kosong'}
                      </span>
                      {isFilled && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(idx)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id={`gemini-key-slot-${idx + 1}`}
                      type={visible[idx] ? 'text' : 'password'}
                      value={value}
                      onChange={(e) => handleSlotChange(idx, e.target.value)}
                      placeholder={`Masukkan Gemini API Key Slot ${idx + 1} (opsional)`}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full pr-11 pl-3.5 py-2.5 text-sm font-mono-tabular bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisibility(idx)}
                      aria-label={
                        visible[idx]
                          ? `Sembunyikan API Key Slot ${idx + 1}`
                          : `Tampilkan API Key Slot ${idx + 1}`
                      }
                      className="absolute right-2 p-1.5 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-200/70 transition-colors cursor-pointer"
                    >
                      {visible[idx] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {feedback && (
            <div
              role="status"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
