import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import type { GeneratedLkpdResult } from '../types';
import {
  exportLkpdToPdf,
  exportLkpdToWord,
  parsePipeTable,
} from '../utils/export';

interface LkpdResultViewProps {
  result: GeneratedLkpdResult;
  durasiPengerjaan?: string;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

export function LkpdResultView({
  result,
  durasiPengerjaan,
  isRegenerating,
  onRegenerate,
}: LkpdResultViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

  const { identitas, petunjuk_umum, kegiatan, rubrik_penilaian } = result;
  const safeKegiatan = Array.isArray(kegiatan) ? kegiatan : [];
  const safeRubrik = Array.isArray(rubrik_penilaian) ? rubrik_penilaian : [];
  const totalSkor = safeRubrik.reduce(
    (sum, item) => sum + (Number.isFinite(item.skor_maksimal) ? Number(item.skor_maksimal) : 0),
    0
  );

  const petunjukLines = (petunjuk_umum || '-')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const handleExportWord = async () => {
    setExportingWord(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const filename = await exportLkpdToWord(result, durasiPengerjaan);
      setActionSuccess(`Dokumen Word berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Export LKPD Word error:', error);
      setActionError('Gagal mengekspor LKPD ke Word. Silakan coba lagi.');
    } finally {
      setExportingWord(false);
    }
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const filename = exportLkpdToPdf(result, durasiPengerjaan);
      setActionSuccess(`Dokumen PDF berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Export LKPD PDF error:', error);
      setActionError('Gagal mengekspor LKPD ke PDF. Silakan coba lagi.');
    } finally {
      setExportingPdf(false);
    }
  };

  const isBusy = isRegenerating || exportingWord || exportingPdf;

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-4 sm:p-8'
    : 'space-y-5';

  return (
    <section
      id="lkpd-result"
      aria-label="Hasil Generator LKPD"
      className={wrapperClass}
    >
      <div className={isFullscreen ? 'max-w-5xl mx-auto space-y-5' : 'space-y-5'}>
        {/* Action Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-900">Pratinjau Dokumen LKPD</span>
              <span aria-hidden="true" className="mx-2 text-slate-400">
                ·
              </span>
              <span>{identitas?.mata_pelajaran || '-'}</span>
              <span aria-hidden="true" className="mx-2 text-slate-400">
                ·
              </span>
              <span>{identitas?.kelas || '-'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                <span>{isRegenerating ? 'Menyusun Ulang...' : 'Generate Ulang'}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportWord()}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {exportingWord ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 shrink-0" />
                )}
                <span>{exportingWord ? 'Mengekspor...' : 'Ekspor Word'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Download className="w-4 h-4 shrink-0" />
                )}
                <span>{exportingPdf ? 'Mengekspor...' : 'Ekspor PDF'}</span>
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

          {actionError && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div
              role="status"
              className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>

        {/* Mandatory Review Notice */}
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900 leading-relaxed"
        >
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <p>
            Wajib ditelaah sebelum dibagikan ke peserta didik. LKPD ini disusun dengan bantuan AI. Pastikan langkah kerja, tabel pengamatan, serta kriteria rubrik penilaian telah sesuai dengan kebutuhan kelas Anda.
          </p>
        </div>

        {/* Printable Document Card */}
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-800">
          {/* Document Header */}
          <header className="text-center border-b border-slate-200 pb-6 space-y-1.5">
            <p className="text-xs font-medium text-slate-500 tracking-wide">
              LEMBAR KERJA PESERTA DIDIK (LKPD)
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {result.judul || 'Lembar Kerja Peserta Didik'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {identitas?.sekolah || '-'} · {identitas?.mata_pelajaran || '-'} ·{' '}
              {identitas?.kelas || '-'}
            </p>
          </header>

          {/* A. Identitas */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Identitas
            </h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50 w-44">
                      Satuan Pendidikan
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.sekolah || '-'}
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50 w-40">
                      Mata Pelajaran
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.mata_pelajaran || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Kelas / Semester
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.kelas || '-'}
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Durasi Pengerjaan
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {durasiPengerjaan?.trim() || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Topik / Materi
                    </th>
                    <td className="py-2.5 px-4 text-slate-900" colSpan={3}>
                      {identitas?.topik || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Nama Siswa / Kelompok
                    </th>
                    <td className="py-2.5 px-4 text-slate-400">
                      ....................................................
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Tanggal
                    </th>
                    <td className="py-2.5 px-4 text-slate-400">
                      ....................................
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* B. Tujuan Pembelajaran */}
          <section className="space-y-2.5">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Tujuan Pembelajaran
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {identitas?.tujuan || '-'}
            </p>
          </section>

          {/* C. Petunjuk Umum */}
          <section className="space-y-2.5">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Petunjuk Umum
            </h2>
            <div className="space-y-1.5 text-sm text-slate-700 leading-relaxed">
              {petunjukLines.map((line, idx) => (
                <p key={`petunjuk-${idx}`}>{line}</p>
              ))}
            </div>
          </section>

          {/* D. Kegiatan */}
          <section className="space-y-6">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Kegiatan
            </h2>

            {safeKegiatan.length > 0 ? (
              <div className="space-y-8">
                {safeKegiatan.map((keg, idx) => {
                  const steps = Array.isArray(keg.langkah_kerja)
                    ? keg.langkah_kerja.filter((s) => typeof s === 'string' && s.trim().length > 0)
                    : [];
                  const parsedTable = parsePipeTable(keg.tabel_data);

                  return (
                    <div key={`kegiatan-${idx}`} className="space-y-4">
                      <h3 className="font-display text-base font-semibold text-teal-800">
                        Kegiatan {idx + 1}: {keg.judul_kegiatan || `Aktivitas ${idx + 1}`}
                      </h3>

                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-900">
                          Langkah Kerja:
                        </p>
                        {steps.length > 0 ? (
                          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 leading-relaxed">
                            {steps.map((step, stepIdx) => (
                              <li key={`step-${idx}-${stepIdx}`}>{step}</li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-sm text-slate-500">-</p>
                        )}
                      </div>

                      {parsedTable ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-900">
                            Tabel Data / Pengamatan:
                          </p>
                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  {parsedTable.headers.map((header, hIdx) => (
                                    <th
                                      key={`th-${idx}-${hIdx}`}
                                      className="py-2.5 px-3 font-semibold text-slate-800 border-r last:border-r-0 border-slate-200"
                                    >
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {parsedTable.rows.map((row, rIdx) => (
                                  <tr key={`tr-${idx}-${rIdx}`}>
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={`td-${idx}-${rIdx}-${cIdx}`}
                                        className="py-3 px-3 text-slate-700 border-r last:border-r-0 border-slate-200 align-top min-w-[90px]"
                                      >
                                        {cell || '\u00A0'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        keg.tabel_data &&
                        keg.tabel_data.trim().length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold text-slate-900">
                              Data / Catatan Pengamatan:
                            </p>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 whitespace-pre-line">
                              {keg.tabel_data.trim()}
                            </div>
                          </div>
                        )
                      )}

                      {/* Ruang Kosong Penulisan Jawaban Siswa */}
                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-slate-600">
                          Ruang Jawaban / Hasil Pengamatan Siswa:
                        </p>
                        <div
                          aria-label="Ruang kosong untuk jawaban siswa"
                          className="border border-slate-300 rounded-lg bg-slate-50/40 px-4 py-4 space-y-6"
                        >
                          <div className="border-b border-dashed border-slate-300 h-4" />
                          <div className="border-b border-dashed border-slate-300 h-4" />
                          <div className="border-b border-dashed border-slate-300 h-4" />
                          <div className="border-b border-dashed border-slate-300 h-4" />
                          <div className="border-b border-dashed border-slate-300 h-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">-</p>
            )}
          </section>

          {/* E. Rubrik Penilaian */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Rubrik Penilaian
            </h2>
            {safeRubrik.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold text-slate-700 w-12 text-center">
                        No
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-slate-700 w-52">
                        Aspek Penilaian
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-slate-700">
                        Indikator Penilaian
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-slate-700 w-32 text-center">
                        Skor Maksimal
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {safeRubrik.map((item, idx) => (
                      <tr key={`rubrik-${idx}`}>
                        <td className="py-3 px-3 text-center font-mono-tabular font-semibold text-slate-900 align-top">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 align-top">
                          {item.aspek || '-'}
                        </td>
                        <td className="py-3 px-4 text-slate-700 leading-relaxed align-top">
                          {item.indikator || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono-tabular font-semibold text-slate-900 align-top">
                          {item.skor_maksimal ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200">
                      <td
                        colSpan={3}
                        className="py-2.5 px-4 text-right font-semibold text-slate-900"
                      >
                        Total Skor Maksimal
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono-tabular font-bold text-teal-800">
                        {totalSkor}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">-</p>
            )}
          </section>
        </article>
      </div>
    </section>
  );
}
