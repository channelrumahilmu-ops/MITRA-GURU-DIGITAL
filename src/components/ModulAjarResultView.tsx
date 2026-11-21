import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BANK_MODUL_LIMITS,
  type GeneratedModulAjarResult,
} from '../types';
import { exportModulAjarToPdf, exportModulAjarToWord } from '../utils/export';

interface ModulAjarResultViewProps {
  result: GeneratedModulAjarResult;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

function sanitizeString(value: unknown, fallback: string, maxLength: number): string {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return (cleaned || fallback).slice(0, maxLength);
}

function sanitizeStringArray(
  value: unknown,
  maxItems: number,
  fallbackIfEmpty?: string
): string[] {
  const items = Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
        .slice(0, maxItems)
        .map((item) => item.slice(0, BANK_MODUL_LIMITS.itemStringMaxLength))
    : [];

  if (items.length === 0 && fallbackIfEmpty) {
    return [fallbackIfEmpty];
  }
  return items;
}

export function ModulAjarResultView({
  result,
  isRegenerating,
  onRegenerate,
}: ModulAjarResultViewProps) {
  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savingToBank, setSavingToBank] = useState(false);
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

  const {
    identitas,
    analisis_pembelajaran,
    desain_pembelajaran,
    pengalaman_belajar,
    asesmen,
  } = result;

  const tujuanList = sanitizeStringArray(
    analisis_pembelajaran?.tujuan_pembelajaran,
    BANK_MODUL_LIMITS.analisis.tujuanMaxItems
  );
  const dimensiList = sanitizeStringArray(
    desain_pembelajaran?.dimensi_profil_lulusan,
    BANK_MODUL_LIMITS.desain.dimensiMaxItems
  );
  const metodeList = sanitizeStringArray(
    desain_pembelajaran?.metode_pembelajaran,
    BANK_MODUL_LIMITS.desain.metodeMaxItems
  );
  const pendahuluanList = sanitizeStringArray(
    pengalaman_belajar?.pendahuluan,
    BANK_MODUL_LIMITS.pengalaman.pendahuluanMaxItems
  );
  const kegiatanIntiList = sanitizeStringArray(
    pengalaman_belajar?.kegiatan_inti,
    BANK_MODUL_LIMITS.pengalaman.kegiatanIntiMaxItems
  );
  const penutupList = sanitizeStringArray(
    pengalaman_belajar?.penutup,
    BANK_MODUL_LIMITS.pengalaman.penutupMaxItems
  );

  const handleExportWord = async () => {
    setExportingWord(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const filename = await exportModulAjarToWord(result);
      setActionSuccess(`Dokumen Word berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Export Modul Ajar error:', error);
      setActionError('Gagal mengekspor Modul Ajar ke Word. Silakan coba lagi.');
    } finally {
      setExportingWord(false);
    }
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const filename = exportModulAjarToPdf(result);
      setActionSuccess(`Dokumen PDF berhasil diunduh: ${filename}`);
    } catch (error) {
      console.error('Export Modul Ajar PDF error:', error);
      setActionError('Gagal mengekspor Modul Ajar ke PDF. Silakan coba lagi.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSaveToBankModul = async () => {
    if (!user) {
      setActionError('Sesi pengguna tidak ditemukan. Silakan masuk kembali.');
      return;
    }

    setSavingToBank(true);
    setActionError(null);
    setActionSuccess(null);

    const payload = {
      userId: user.uid,
      createdAt: serverTimestamp(),
      judul_modul: sanitizeString(
        result.judul_modul,
        'Modul Ajar Pembelajaran',
        BANK_MODUL_LIMITS.judulMaxLength
      ),
      identitas: {
        satuan_pendidikan: sanitizeString(
          identitas?.satuan_pendidikan,
          '-',
          BANK_MODUL_LIMITS.identitas.satuanPendidikanMaxLength
        ),
        mata_pelajaran: sanitizeString(
          identitas?.mata_pelajaran,
          '-',
          BANK_MODUL_LIMITS.identitas.mataPelajaranMaxLength
        ),
        kelas_semester: sanitizeString(
          identitas?.kelas_semester,
          '-',
          BANK_MODUL_LIMITS.identitas.kelasSemesterMaxLength
        ),
        fase: sanitizeString(
          identitas?.fase,
          '-',
          BANK_MODUL_LIMITS.identitas.faseMaxLength
        ),
        alokasi_waktu: sanitizeString(
          identitas?.alokasi_waktu,
          '-',
          BANK_MODUL_LIMITS.identitas.alokasiWaktuMaxLength
        ),
        jumlah_pertemuan: sanitizeString(
          identitas?.jumlah_pertemuan,
          '1 Pertemuan',
          BANK_MODUL_LIMITS.identitas.jumlahPertemuanMaxLength
        ),
        penyusun: sanitizeString(
          identitas?.penyusun,
          '-',
          BANK_MODUL_LIMITS.identitas.penyusunMaxLength
        ),
      },
      analisis_pembelajaran: {
        capaian_pembelajaran: sanitizeString(
          analisis_pembelajaran?.capaian_pembelajaran,
          '-',
          BANK_MODUL_LIMITS.analisis.capaianMaxLength
        ),
        topik_materi: sanitizeString(
          analisis_pembelajaran?.topik_materi,
          '-',
          BANK_MODUL_LIMITS.analisis.topikMaxLength
        ),
        tujuan_pembelajaran: sanitizeStringArray(
          analisis_pembelajaran?.tujuan_pembelajaran,
          BANK_MODUL_LIMITS.analisis.tujuanMaxItems,
          '-'
        ),
        karakteristik_murid: (typeof analisis_pembelajaran?.karakteristik_murid === 'string'
          ? analisis_pembelajaran.karakteristik_murid.trim()
          : ''
        ).slice(0, BANK_MODUL_LIMITS.analisis.karakteristikMaxLength),
      },
      desain_pembelajaran: {
        dimensi_profil_lulusan: sanitizeStringArray(
          desain_pembelajaran?.dimensi_profil_lulusan,
          BANK_MODUL_LIMITS.desain.dimensiMaxItems
        ),
        model_pembelajaran: sanitizeString(
          desain_pembelajaran?.model_pembelajaran,
          '-',
          BANK_MODUL_LIMITS.desain.modelMaxLength
        ),
        metode_pembelajaran: sanitizeStringArray(
          desain_pembelajaran?.metode_pembelajaran,
          BANK_MODUL_LIMITS.desain.metodeMaxItems
        ),
      },
      pengalaman_belajar: {
        pendahuluan: sanitizeStringArray(
          pengalaman_belajar?.pendahuluan,
          BANK_MODUL_LIMITS.pengalaman.pendahuluanMaxItems,
          '-'
        ),
        kegiatan_inti: sanitizeStringArray(
          pengalaman_belajar?.kegiatan_inti,
          BANK_MODUL_LIMITS.pengalaman.kegiatanIntiMaxItems,
          '-'
        ),
        penutup: sanitizeStringArray(
          pengalaman_belajar?.penutup,
          BANK_MODUL_LIMITS.pengalaman.penutupMaxItems,
          '-'
        ),
      },
      asesmen: {
        jenis: sanitizeString(
          asesmen?.jenis,
          'Formatif',
          BANK_MODUL_LIMITS.asesmen.jenisMaxLength
        ),
        bentuk_instrumen: sanitizeString(
          asesmen?.bentuk_instrumen,
          '-',
          BANK_MODUL_LIMITS.asesmen.instrumenMaxLength
        ),
      },
    };

    try {
      await addDoc(collection(db, 'bank_modul'), payload);
      setActionSuccess('Berhasil disimpan ke Bank Modul!');
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'bank_modul');
      } catch {
        setActionError(
          'Gagal menyimpan ke Bank Modul. Pastikan koneksi stabil dan akun Anda terverifikasi.'
        );
      }
    } finally {
      setSavingToBank(false);
    }
  };

  const isBusy = isRegenerating || exportingWord || exportingPdf || savingToBank;

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-4 sm:p-8'
    : 'space-y-5';

  return (
    <section
      id="modul-ajar-result"
      aria-label="Hasil Modul Ajar"
      className={wrapperClass}
    >
      <div className={isFullscreen ? 'max-w-5xl mx-auto space-y-5' : 'space-y-5'}>
        {/* Action Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-900">Pratinjau Dokumen Modul Ajar</span>
              <span aria-hidden="true" className="mx-2 text-slate-400">
                ·
              </span>
              <span>{identitas?.mata_pelajaran || '-'}</span>
              <span aria-hidden="true" className="mx-2 text-slate-400">
                ·
              </span>
              <span>{identitas?.fase || '-'}</span>
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
                onClick={() => void handleSaveToBankModul()}
                disabled={isBusy}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {savingToBank ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                <span>{savingToBank ? 'Menyimpan...' : 'Simpan ke Bank Modul'}</span>
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
            Wajib ditelaah sebelum digunakan di kelas. Modul ajar ini disusun dengan bantuan AI. Pastikan kesesuaian alur kegiatan, alokasi waktu, capaian pembelajaran, dan instrumen asesmen dengan karakteristik peserta didik Anda.
          </p>
        </div>

        {/* Printable Document Card */}
        <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8 text-slate-800">
          {/* Document Header */}
          <header className="text-center border-b border-slate-200 pb-6 space-y-1.5">
            <p className="text-xs font-medium text-slate-500 tracking-wide">
              MODUL AJAR / RENCANA PEMBELAJARAN MENDALAM
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
              {result.judul_modul || 'Modul Ajar'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {identitas?.satuan_pendidikan || '-'} · {identitas?.mata_pelajaran || '-'} ·{' '}
              {identitas?.kelas_semester || '-'}
            </p>
          </header>

          {/* A. Identitas Modul */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              A. Identitas Modul
            </h2>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50 w-44">
                      Satuan Pendidikan
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.satuan_pendidikan || '-'}
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50 w-36">
                      Fase
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.fase || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Mata Pelajaran
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.mata_pelajaran || '-'}
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Alokasi Waktu
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.alokasi_waktu || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Kelas / Semester
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.kelas_semester || '-'}
                    </td>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Jumlah Pertemuan
                    </th>
                    <td className="py-2.5 px-4 text-slate-900">
                      {identitas?.jumlah_pertemuan || '-'}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 bg-slate-50">
                      Penyusun
                    </th>
                    <td className="py-2.5 px-4 text-slate-900" colSpan={3}>
                      {identitas?.penyusun || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* B. Analisis Pembelajaran */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              B. Analisis Pembelajaran
            </h2>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-teal-800">
                1. Capaian Pembelajaran (CP)
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {analisis_pembelajaran?.capaian_pembelajaran || '-'}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-teal-800">
                2. Topik / Materi Pembelajaran
              </h3>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                {analisis_pembelajaran?.topik_materi || '-'}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-teal-800">
                3. Tujuan Pembelajaran (TP)
              </h3>
              {tujuanList.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                  {tujuanList.map((item, idx) => (
                    <li key={`tp-${idx}`}>{item}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">-</p>
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-teal-800">
                4. Karakteristik Murid
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {analisis_pembelajaran?.karakteristik_murid?.trim() || 'Umum / heterogen (tidak ada catatan khusus)'}
              </p>
            </div>
          </section>

          {/* C. Desain Pembelajaran */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              C. Desain Pembelajaran
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-teal-800">
                  1. 8 Dimensi Profil Lulusan
                </h3>
                {dimensiList.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                    {dimensiList.map((dim, idx) => (
                      <li key={`dim-${idx}`}>{dim}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">-</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-teal-800">
                    2. Model Pembelajaran
                  </h3>
                  <p className="text-sm font-medium text-slate-900">
                    {desain_pembelajaran?.model_pembelajaran || '-'}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-teal-800">
                    3. Metode Pembelajaran
                  </h3>
                  {metodeList.length > 0 ? (
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {metodeList.map((met, idx) => (
                        <li key={`met-${idx}`}>{met}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">-</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* D. Pengalaman Belajar */}
          <section className="space-y-5">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              D. Pengalaman Belajar
            </h2>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-teal-800">
                1. Kegiatan Pendahuluan
              </h3>
              {pendahuluanList.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                  {pendahuluanList.map((step, idx) => (
                    <li key={`pendahuluan-${idx}`}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">-</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-teal-800">
                2. Kegiatan Inti
              </h3>
              {kegiatanIntiList.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 leading-relaxed">
                  {kegiatanIntiList.map((step, idx) => (
                    <li key={`inti-${idx}`}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">-</p>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-teal-800">
                3. Kegiatan Penutup
              </h3>
              {penutupList.length > 0 ? (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                  {penutupList.map((step, idx) => (
                    <li key={`penutup-${idx}`}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">-</p>
              )}
            </div>
          </section>

          {/* E. Asesmen */}
          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              E. Asesmen
            </h2>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-teal-800">
                1. Jenis Asesmen
              </h3>
              <p className="text-sm font-medium text-slate-900">
                {asesmen?.jenis || '-'}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-sm font-semibold text-teal-800">
                2. Bentuk Instrumen & Teknik Penilaian
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {asesmen?.bentuk_instrumen || '-'}
              </p>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
