import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  FileSpreadsheet,
  KeyRound,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { ExamIdentity, GeneratedExamResult, GeneratedSoalOptions } from '../types';

type ResultTab = 'naskah' | 'kunci' | 'kisi' | 'kartu';

interface ExamResultViewProps {
  result: GeneratedExamResult;
  identity: ExamIdentity;
  isRegenerating: boolean;
  onReset: () => void;
  onRegenerate: () => void;
}

const OPTION_KEYS: Array<keyof GeneratedSoalOptions> = ['A', 'B', 'C', 'D', 'E'];

function getNonEmptyOptions(opsi?: GeneratedSoalOptions): Array<{ key: string; value: string }> {
  if (!opsi) return [];
  return OPTION_KEYS.map((k) => ({
    key: k,
    value: typeof opsi[k] === 'string' ? opsi[k].trim() : '',
  })).filter((entry) => entry.value.length > 0);
}

export function ExamResultView({
  result,
  identity,
  isRegenerating,
  onReset,
  onRegenerate,
}: ExamResultViewProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>('naskah');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const metaJudul = result.meta?.judul?.trim() || identity.judulUjian;
  const metaSekolah = result.meta?.sekolah?.trim() || identity.namaSekolah;
  const metaMapel = result.meta?.mapel?.trim() || identity.mataPelajaran;
  const metaKelas = result.meta?.kelas?.trim() || identity.kelas;
  const soalList = Array.isArray(result.soal) ? result.soal : [];

  const tabs: Array<{ id: ResultTab; label: string; icon: typeof BookOpen }> = [
    { id: 'naskah', label: 'Naskah Soal', icon: BookOpen },
    { id: 'kunci', label: 'Kunci & Pembahasan', icon: KeyRound },
    { id: 'kisi', label: 'Kisi-Kisi', icon: FileSpreadsheet },
    { id: 'kartu', label: 'Kartu Soal', icon: LayoutGrid },
  ];

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-4 sm:p-8'
    : 'space-y-5';

  return (
    <section
      aria-label="Hasil Generator Soal"
      className={containerClasses}
    >
      <div className={isFullscreen ? 'max-w-5xl mx-auto space-y-5' : 'space-y-5'}>
        {/* Header Bar: Navigasi Tab & Tombol Aksi */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
          <div
            role="tablist"
            aria-label="Tampilan dokumen soal"
            className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-mono-tabular">
              Total Butir Soal: <strong className="text-slate-900">{soalList.length}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onReset}
                disabled={isRegenerating}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Buat Lagi</span>
              </button>

              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                <span>{isRegenerating ? 'Menyusun Ulang...' : 'Generate Ulang'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4 shrink-0" />
                    <span>Keluar Layar Penuh</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 shrink-0" />
                    <span>Layar Penuh</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Kotak Peringatan Wajib */}
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900 leading-relaxed"
        >
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <p>
            Wajib ditelaah sebelum dipakai. Naskah ini disusun dengan bantuan AI dan dapat memuat kekeliruan konsep, fakta, atau kunci jawaban. Periksa isi soal, stimulus, opsi, dan kunci serta kesesuaiannya dengan capaian pembelajaran. Tanggung jawab akhir ada pada guru.
          </p>
        </div>

        {/* Konten Tab */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          {activeTab === 'naskah' && (
            <div className="space-y-8">
              {/* Kop Naskah Soal */}
              <div className="border-b border-slate-200 pb-5 space-y-3">
                <div className="text-center space-y-1">
                  <p className="text-xs font-medium text-slate-500">
                    {metaSekolah}
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {metaJudul}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-500">Mata Pelajaran: </span>
                    <span className="font-medium text-slate-900">{metaMapel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Kelas / Fase: </span>
                    <span className="font-medium text-slate-900">
                      {metaKelas} ({identity.fase})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tahun Ajaran: </span>
                    <span className="font-medium text-slate-900 font-mono-tabular">
                      {identity.tahunAjaran || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Alokasi Waktu: </span>
                    <span className="font-medium text-slate-900">
                      {identity.alokasiWaktu || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Daftar Soal */}
              <div className="space-y-7">
                {soalList.map((item, index) => {
                  const number = item.no ?? index + 1;
                  const options = getNonEmptyOptions(item.opsi);
                  const hasStimulus =
                    typeof item.stimulus === 'string' &&
                    item.stimulus.trim().length > 0;

                  return (
                    <article
                      key={`naskah-${number}-${index}`}
                      className="space-y-3 pb-6 border-b border-slate-100 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          Soal No. {number}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.tipe}</span>
                      </div>

                      {hasStimulus && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                          {item.stimulus.trim()}
                        </div>
                      )}

                      <p className="text-sm sm:text-base text-slate-900 leading-relaxed whitespace-pre-line">
                        {item.pertanyaan}
                      </p>

                      {options.length > 0 && (
                        <div className="space-y-2 pl-1">
                          {options.map((opt) => (
                            <div
                              key={opt.key}
                              className="flex items-start gap-2.5 text-sm text-slate-800"
                            >
                              <span className="font-mono-tabular font-semibold text-slate-900 w-5 shrink-0">
                                {opt.key}.
                              </span>
                              <span className="leading-relaxed">{opt.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'kunci' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Kunci Jawaban & Pembahasan
                </h2>
                <p className="text-xs text-slate-500">
                  {metaJudul} · {metaMapel} · Kelas {metaKelas}
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      <th className="py-3 px-4 w-16">No</th>
                      <th className="py-3 px-4 w-44">Kunci</th>
                      <th className="py-3 px-4">Pembahasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {soalList.map((item, index) => {
                      const number = item.no ?? index + 1;
                      return (
                        <tr
                          key={`kunci-${number}-${index}`}
                          className="hover:bg-slate-50/70 align-top"
                        >
                          <td className="py-3 px-4 font-mono-tabular font-semibold text-slate-900">
                            {number}
                          </td>
                          <td className="py-3 px-4 font-medium text-teal-800 whitespace-pre-line">
                            {item.kunci}
                          </td>
                          <td className="py-3 px-4 text-slate-700 leading-relaxed whitespace-pre-line">
                            {item.pembahasan}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'kisi' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Kisi-Kisi Penulisan Soal
                </h2>
                <p className="text-xs text-slate-500">
                  {metaJudul} · {metaMapel} · Kelas {metaKelas}
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      <th className="py-3 px-3.5 w-14">No</th>
                      <th className="py-3 px-3.5 min-w-[160px]">Materi</th>
                      <th className="py-3 px-3.5 min-w-[220px]">Indikator</th>
                      <th className="py-3 px-3.5 w-24">Level (C1-C6)</th>
                      <th className="py-3 px-3.5 w-28">Kesulitan</th>
                      <th className="py-3 px-3.5 w-32">Bentuk</th>
                      <th className="py-3 px-3.5 min-w-[120px]">Kunci</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {soalList.map((item, index) => {
                      const number = item.no ?? index + 1;
                      return (
                        <tr
                          key={`kisi-${number}-${index}`}
                          className="hover:bg-slate-50/70 align-top"
                        >
                          <td className="py-3 px-3.5 font-mono-tabular font-semibold text-slate-900">
                            {number}
                          </td>
                          <td className="py-3 px-3.5 text-slate-800">
                            {identity.topikUtama}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700 leading-relaxed">
                            {item.indikator}
                          </td>
                          <td className="py-3 px-3.5 font-mono-tabular font-medium text-slate-900">
                            {item.level_kognitif}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700">
                            {item.kesulitan}
                          </td>
                          <td className="py-3 px-3.5 text-slate-700">
                            {item.tipe}
                          </td>
                          <td className="py-3 px-3.5 font-medium text-teal-800 whitespace-pre-line">
                            {item.kunci}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'kartu' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Kartu Soal
                </h2>
                <p className="text-xs text-slate-500">
                  {metaJudul} · {metaSekolah}
                </p>
              </div>

              <div className="space-y-6">
                {soalList.map((item, index) => {
                  const number = item.no ?? index + 1;
                  const options = getNonEmptyOptions(item.opsi);
                  const hasStimulus =
                    typeof item.stimulus === 'string' &&
                    item.stimulus.trim().length > 0;

                  return (
                    <div
                      key={`kartu-${number}-${index}`}
                      className="border border-slate-300 rounded-xl overflow-hidden bg-white"
                    >
                      {/* Bagian Atas: Tabel Identitas Kartu Soal */}
                      <div className="bg-slate-50 border-b border-slate-300">
                        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-teal-700" />
                            Kartu Soal Nomor {number}
                          </span>
                          <span className="text-slate-500 font-normal">
                            {item.tipe}
                          </span>
                        </div>

                        <table className="w-full text-xs border-collapse">
                          <tbody className="divide-y divide-slate-200">
                            <tr>
                              <td className="py-2 px-4 font-medium text-slate-600 w-36 bg-slate-100/70">
                                Mata Pelajaran
                              </td>
                              <td className="py-2 px-4 text-slate-900">
                                {metaMapel}
                              </td>
                              <td className="py-2 px-4 font-medium text-slate-600 w-32 bg-slate-100/70">
                                Kelas
                              </td>
                              <td className="py-2 px-4 text-slate-900">
                                {metaKelas}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-4 font-medium text-slate-600 bg-slate-100/70">
                                Level Kognitif
                              </td>
                              <td className="py-2 px-4 font-mono-tabular text-slate-900">
                                {item.level_kognitif}
                              </td>
                              <td className="py-2 px-4 font-medium text-slate-600 bg-slate-100/70">
                                Kesulitan
                              </td>
                              <td className="py-2 px-4 text-slate-900">
                                {item.kesulitan}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-4 font-medium text-slate-600 bg-slate-100/70">
                                Indikator
                              </td>
                              <td className="py-2 px-4 text-slate-900" colSpan={3}>
                                {item.indikator}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-4 font-medium text-slate-600 bg-slate-100/70">
                                Kunci Jawaban
                              </td>
                              <td
                                className="py-2 px-4 font-semibold text-teal-800 whitespace-pre-line"
                                colSpan={3}
                              >
                                {item.kunci}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Bagian Bawah: Teks Soal dan Opsi */}
                      <div className="p-5 space-y-3">
                        {hasStimulus && (
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                            {item.stimulus.trim()}
                          </div>
                        )}

                        <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">
                          {item.pertanyaan}
                        </p>

                        {options.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {options.map((opt) => (
                              <div
                                key={opt.key}
                                className="flex items-start gap-2.5 text-sm text-slate-800"
                              >
                                <span className="font-mono-tabular font-semibold text-slate-900 w-5 shrink-0">
                                  {opt.key}.
                                </span>
                                <span className="leading-relaxed">{opt.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
