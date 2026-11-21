import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  Calendar,
  Eye,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { BankSoalRecord, GeneratedSoalOptions } from '../types';

const OPTION_KEYS: Array<keyof GeneratedSoalOptions> = ['A', 'B', 'C', 'D', 'E'];

function getTimestampMs(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const ts = value as Partial<Timestamp> & { seconds?: number; nanoseconds?: number };
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000;
  }
  return 0;
}

function formatCreatedAt(value: unknown): string {
  const ms = getTimestampMs(value);
  if (!ms) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

export function BankSoalPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BankSoalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BankSoalRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBankSoal = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const q = query(
        collection(db, 'bank_soal'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const loaded: BankSoalRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: typeof data.userId === 'string' ? data.userId : user.uid,
          createdAt: data.createdAt,
          meta: {
            judul: data.meta?.judul ?? 'Tanpa Judul',
            sekolah: data.meta?.sekolah ?? '-',
            mapel: data.meta?.mapel ?? '-',
            kelas: data.meta?.kelas ?? '-',
          },
          soal: Array.isArray(data.soal) ? data.soal : [],
        };
      });

      loaded.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt));
      setItems(loaded);
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.LIST, 'bank_soal');
      } catch {
        setErrorMsg('Gagal memuat data Bank Soal dari Firestore.');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchBankSoal();
  }, [fetchBankSoal]);

  useEffect(() => {
    if (!selectedItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setErrorMsg(null);
    const docPath = `bank_soal/${id}`;
    try {
      await deleteDoc(doc(db, 'bank_soal', id));
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      } catch {
        setErrorMsg('Gagal menghapus paket soal dari Bank Soal.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Bank Soal
          </h1>
          <p className="text-sm text-slate-600">
            Arsip paket soal yang telah Anda simpan dari Generator Soal.
          </p>
        </div>

        <Link
          to="/administrasi/generator-soal"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Buat Soal Baru</span>
        </Link>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="h-5 w-2/3 bg-slate-200 rounded" />
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-9 w-32 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-500">
            <Archive className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Belum ada soal tersimpan
            </h2>
            <p className="text-sm text-slate-600">
              Susun soal melalui menu Generator Soal lalu klik &ldquo;Simpan ke Bank Soal&rdquo; untuk mengarsipkannya di sini.
            </p>
          </div>
          <div>
            <Link
              to="/administrasi/generator-soal"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Buka Generator Soal</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5 hover:border-slate-300 transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{item.meta.mapel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Kelas {item.meta.kelas}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular font-medium text-slate-700">
                    {item.soal.length} Soal
                  </span>
                </div>

                <h2 className="font-display text-lg font-semibold text-slate-900 leading-snug">
                  {item.meta.judul}
                </h2>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono-tabular">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{formatCreatedAt(item.createdAt)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>Lihat Detail</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{deletingId === item.id ? 'Menghapus...' : 'Hapus'}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal Detail Paket Soal (Teks Biasa Lengkap) */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-bank-soal-title"
        >
          <div className="w-full max-w-3xl max-h-[88vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="space-y-1 min-w-0">
                <h2
                  id="detail-bank-soal-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  {selectedItem.meta.judul}
                </h2>
                <p className="text-xs text-slate-600">
                  {selectedItem.meta.sekolah} · {selectedItem.meta.mapel} · Kelas{' '}
                  {selectedItem.meta.kelas} ·{' '}
                  <span className="font-mono-tabular">
                    {selectedItem.soal.length} Soal
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Tutup detail soal"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {selectedItem.soal.map((item, idx) => {
                const number = item.no ?? idx + 1;
                const hasStimulus =
                  typeof item.stimulus === 'string' &&
                  item.stimulus.trim().length > 0;
                const options = item.opsi
                  ? OPTION_KEYS.map((k) => ({
                      key: k,
                      value:
                        typeof item.opsi?.[k] === 'string'
                          ? item.opsi[k]!.trim()
                          : '',
                    })).filter((opt) => opt.value.length > 0)
                  : [];

                return (
                  <div
                    key={`${selectedItem.id}-q-${number}-${idx}`}
                    className="pb-6 border-b border-slate-200 last:border-b-0 last:pb-0 space-y-2.5 text-sm text-slate-800"
                  >
                    <div className="text-xs text-slate-500">
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        Soal No. {number}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.tipe}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-tabular">{item.level_kognitif}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{item.kesulitan}</span>
                    </div>

                    {hasStimulus && (
                      <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed whitespace-pre-line">
                        {item.stimulus.trim()}
                      </p>
                    )}

                    <p className="text-slate-900 leading-relaxed whitespace-pre-line">
                      {item.pertanyaan}
                    </p>

                    {options.length > 0 && (
                      <div className="space-y-1 pl-2">
                        {options.map((opt) => (
                          <p key={opt.key} className="leading-relaxed">
                            <span className="font-mono-tabular font-semibold">
                              {opt.key}.{' '}
                            </span>
                            {opt.value}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 space-y-1 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-900">Kunci Jawaban:</strong>{' '}
                        <span className="text-teal-800 font-medium whitespace-pre-line">
                          {item.kunci}
                        </span>
                      </p>
                      <p className="leading-relaxed whitespace-pre-line">
                        <strong className="text-slate-900">Pembahasan:</strong>{' '}
                        {item.pembahasan}
                      </p>
                      <p>
                        <strong className="text-slate-900">Indikator:</strong>{' '}
                        {item.indikator}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
