import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { GeneratedLkpdResult, LkpdFormValues } from '../types';
import { countFilledApiKeys, loadApiKeysFromStorage } from '../utils/apiKeys';
import { generateWithFallback, LKPD_JSON_SCHEMA } from '../utils/gemini';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { LkpdResultView } from '../components/LkpdResultView';

const JENIS_KEGIATAN_OPTIONS = [
  'Diskusi kelompok',
  'Praktikum',
  'Penugasan mandiri',
  'Studi kasus',
  'Observasi & Eksplorasi',
  'Proyek Mini',
];

const DIFERENSIASI_OPTIONS = [
  'Tidak ada',
  'Berdasarkan kesiapan',
  'Berdasarkan minat',
  'Berdasarkan profil belajar',
];

const INITIAL_FORM: LkpdFormValues = {
  judulLkpd: '',
  satuanPendidikan: '',
  mataPelajaran: '',
  kelasSemester: '',
  topikMateri: '',
  tujuanPembelajaran: '',
  jenisKegiatan: 'Diskusi kelompok',
  jumlahKegiatan: 1,
  durasiPengerjaan: '45 menit',
  diferensiasi: 'Tidak ada',
  catatanTambahan: '',
};

function buildLkpdPrompt(form: LkpdFormValues): string {
  const jumlah = Math.max(1, Math.min(5, Math.floor(form.jumlahKegiatan) || 1));
  const needsObservationTable =
    form.jenisKegiatan === 'Praktikum' ||
    form.jenisKegiatan === 'Observasi & Eksplorasi' ||
    form.jenisKegiatan === 'Studi kasus';

  return `Anda adalah seorang guru ahli sekaligus perancang perangkat pembelajaran Kurikulum Merdeka Indonesia yang berpengalaman menyusun Lembar Kerja Peserta Didik (LKPD) berkualitas tinggi.

Susunlah satu dokumen LKPD lengkap, sistematis, komunikatif untuk peserta didik, dan siap cetak dalam Bahasa Indonesia baku berdasarkan informasi berikut:

BAGIAN A — IDENTITAS & TUJUAN:
- Judul LKPD: ${form.judulLkpd}
- Satuan Pendidikan: ${form.satuanPendidikan}
- Mata Pelajaran: ${form.mataPelajaran}
- Kelas / Semester: ${form.kelasSemester}
- Topik / Materi: ${form.topikMateri}
- Tujuan Pembelajaran: ${form.tujuanPembelajaran}

BAGIAN B — PENGATURAN AKTIVITAS:
- Jenis Kegiatan: ${form.jenisKegiatan}
- Jumlah Kegiatan: ${jumlah} kegiatan
- Durasi Pengerjaan: ${form.durasiPengerjaan}
- Strategi Diferensiasi: ${form.diferensiasi}
- Catatan Tambahan Guru: ${form.catatanTambahan.trim() || 'Tidak ada catatan khusus'}

INSTRUKSI PENYUSUNAN OUTPUT JSON:
1. "judul": Gunakan atau sempurnakan judul LKPD ("${form.judulLkpd}") agar jelas dan menarik bagi siswa.
2. "identitas": Salin dan rapikan field "sekolah", "mata_pelajaran", "kelas", "topik", dan "tujuan".
3. "petunjuk_umum": Berikan petunjuk pengerjaan LKPD yang jelas dan berurutan bagi siswa (misalnya membaca doa, menuliskan identitas diri/kelompok, memperhatikan alokasi waktu ${form.durasiPengerjaan}, mengikuti langkah kerja secara cermat, serta menjaga keselamatan/ketertiban).
4. "kegiatan": Buat array berisi TEPAT ${jumlah} objek kegiatan sesuai jenis "${form.jenisKegiatan}". Setiap objek memiliki:
   - "judul_kegiatan": Judul aktivitas yang spesifik terhadap materi "${form.topikMateri}".
   - "langkah_kerja": Array berisi langkah-langkah kerja yang sangat jelas, operasional, terurut, mudah dipahami siswa, serta memuat pertanyaan pemantik / instruksi analisis yang perlu dijawab siswa. ${
     form.diferensiasi !== 'Tidak ada'
       ? `Integrasikan strategi diferensiasi "${form.diferensiasi}" secara eksplisit pada aktivitas atau pilihan tugas siswa.`
       : ''
   } ${
    form.catatanTambahan.trim()
      ? `Perhatikan catatan khusus guru berikut: "${form.catatanTambahan.trim()}".`
      : ''
  }
   - "tabel_data": ${
     needsObservationTable
       ? 'Wajib sertakan template tabel pengamatan/pencatatan data dalam format tabel Markdown berpemisah pipa (contoh: "| No | Aspek yang Diamati | Hasil Pengamatan | Keterangan |\\n| --- | --- | --- | --- |\\n| 1 | | | |\\n| 2 | | | |\\n| 3 | | | |"). Biarkan sel hasil kosong agar dapat diisi siswa.'
       : 'Opsional. Isi dengan tabel Markdown berpemisah pipa apabila aktivitas membutuhkan tabel pengumpulan data/perbandingan, atau isi string kosong "" jika tidak diperlukan.'
   }
5. "rubrik_penilaian": Buat array berisi 4 hingga 6 aspek penilaian yang relevan dengan jenis kegiatan "${form.jenisKegiatan}" dan topik "${form.topikMateri}". Setiap item wajib berisi "aspek", "indikator" pencapaian yang terukur, dan "skor_maksimal" (bilangan bulat, sehingga total skor maksimal berjumlah 100 atau kelipatan yang proporsional).`;
}

export function LkpdPage() {
  const { profile, apiKeys } = useAuth();
  const [form, setForm] = useState<LkpdFormValues>(INITIAL_FORM);
  const [didPrefill, setDidPrefill] = useState(false);

  const [openA, setOpenA] = useState(true);
  const [openB, setOpenB] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedLkpdResult | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  useEffect(() => {
    if (didPrefill) return;
    if (profile) {
      setForm((prev) => ({
        ...prev,
        satuanPendidikan: prev.satuanPendidikan || profile.sekolah || '',
        mataPelajaran: prev.mataPelajaran || profile.mataPelajaran || '',
        kelasSemester: prev.kelasSemester || profile.kelas || '',
      }));
      setDidPrefill(true);
    }
  }, [profile, didPrefill]);

  const filledKeyCount = countFilledApiKeys(apiKeys);

  const handleFieldChange = <K extends keyof LkpdFormValues>(
    field: K,
    value: LkpdFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setGenerateError(null);
  };

  const executeGenerate = async () => {
    setGenerateError(null);

    if (
      !form.judulLkpd.trim() ||
      !form.satuanPendidikan.trim() ||
      !form.mataPelajaran.trim() ||
      !form.kelasSemester.trim() ||
      !form.topikMateri.trim() ||
      !form.tujuanPembelajaran.trim()
    ) {
      setOpenA(true);
      setGenerateError(
        'Lengkapi seluruh data Identitas & Tujuan pada Bagian A terlebih dahulu.'
      );
      return;
    }

    if (!form.durasiPengerjaan.trim() || form.jumlahKegiatan < 1) {
      setOpenB(true);
      setGenerateError(
        'Pastikan Jumlah Kegiatan minimal 1 dan Durasi Pengerjaan telah diisi pada Bagian B.'
      );
      return;
    }

    const storedKeys = loadApiKeysFromStorage();
    if (countFilledApiKeys(storedKeys) === 0) {
      setGenerateError(
        'Belum ada Gemini API Key yang tersimpan di browser Anda. Tambahkan minimal 1 API Key terlebih dahulu.'
      );
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = buildLkpdPrompt(form);
      const { data } = await generateWithFallback<GeneratedLkpdResult>(
        prompt,
        LKPD_JSON_SCHEMA,
        storedKeys
      );

      if (
        !data ||
        !data.identitas ||
        !Array.isArray(data.kegiatan) ||
        data.kegiatan.length === 0
      ) {
        throw new Error(
          'Respons AI tidak memuat struktur LKPD yang lengkap. Silakan coba lagi.'
        );
      }

      setResult(data);
      requestAnimationFrame(() => {
        const el = document.getElementById('lkpd-result');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : 'Gagal menyusun LKPD. Silakan periksa API Key dan coba kembali.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeGenerate();
  };

  const handleReset = () => {
    setResult(null);
    setGenerateError(null);
    setForm({
      ...INITIAL_FORM,
      satuanPendidikan: profile?.sekolah || '',
      mataPelajaran: profile?.mataPelajaran || '',
      kelasSemester: profile?.kelas || '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Generator LKPD
          </h1>
          <p className="text-sm text-slate-600">
            Rancang Lembar Kerja Peserta Didik lengkap dengan tujuan pembelajaran, langkah kerja terstruktur, ruang jawaban siswa, dan rubrik penilaian.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setApiKeyModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <KeyRound className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Pengaturan API Key</span>
          <span className="font-mono-tabular text-xs text-slate-500">
            {filledKeyCount}/3
          </span>
        </button>
      </div>

      {/* Form Generator LKPD */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Bagian A: Identitas & Tujuan */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenA((prev) => !prev)}
            aria-expanded={openA}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian A: Identitas & Tujuan
              </h2>
              <p className="text-xs text-slate-500">
                Judul LKPD, satuan pendidikan, mata pelajaran, kelas/semester, topik/materi, dan tujuan pembelajaran.
              </p>
            </div>
            {openA ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          {openA && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="judulLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Judul LKPD <span className="text-red-600">*</span>
                </label>
                <input
                  id="judulLkpd"
                  type="text"
                  value={form.judulLkpd}
                  onChange={(e) => handleFieldChange('judulLkpd', e.target.value)}
                  placeholder="Contoh: LKPD Sistem Reproduksi"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="satuanPendidikanLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Satuan Pendidikan <span className="text-red-600">*</span>
                </label>
                <input
                  id="satuanPendidikanLkpd"
                  type="text"
                  value={form.satuanPendidikan}
                  onChange={(e) => handleFieldChange('satuanPendidikan', e.target.value)}
                  placeholder="Contoh: SMP Negeri 1 Bandung"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="mataPelajaranLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Mata Pelajaran <span className="text-red-600">*</span>
                </label>
                <input
                  id="mataPelajaranLkpd"
                  type="text"
                  value={form.mataPelajaran}
                  onChange={(e) => handleFieldChange('mataPelajaran', e.target.value)}
                  placeholder="Contoh: Ilmu Pengetahuan Alam (IPA)"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="kelasSemesterLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Kelas / Semester <span className="text-red-600">*</span>
                </label>
                <input
                  id="kelasSemesterLkpd"
                  type="text"
                  value={form.kelasSemester}
                  onChange={(e) => handleFieldChange('kelasSemester', e.target.value)}
                  placeholder="Contoh: IX / Ganjil"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="topikMateriLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Topik / Materi <span className="text-red-600">*</span>
                </label>
                <input
                  id="topikMateriLkpd"
                  type="text"
                  value={form.topikMateri}
                  onChange={(e) => handleFieldChange('topikMateri', e.target.value)}
                  placeholder="Contoh: Organ Reproduksi Manusia dan Pembelahan Sel"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="tujuanPembelajaranLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Tujuan Pembelajaran <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="tujuanPembelajaranLkpd"
                  rows={3}
                  value={form.tujuanPembelajaran}
                  onChange={(e) => handleFieldChange('tujuanPembelajaran', e.target.value)}
                  placeholder="Contoh: Peserta didik mampu mengidentifikasi organ-organ penyusun sistem reproduksi manusia beserta fungsinya melalui pengamatan dan diskusi kelompok."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>
          )}
        </section>

        {/* Bagian B: Pengaturan Aktivitas */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenB((prev) => !prev)}
            aria-expanded={openB}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian B: Pengaturan Aktivitas
              </h2>
              <p className="text-xs text-slate-500">
                Jenis kegiatan, jumlah kegiatan, durasi pengerjaan, diferensiasi, dan catatan tambahan.
              </p>
            </div>
            {openB ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          {openB && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="jenisKegiatan"
                  className="block text-sm font-medium text-slate-900"
                >
                  Jenis Kegiatan
                </label>
                <select
                  id="jenisKegiatan"
                  value={form.jenisKegiatan}
                  onChange={(e) => handleFieldChange('jenisKegiatan', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {JENIS_KEGIATAN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="jumlahKegiatan"
                  className="block text-sm font-medium text-slate-900"
                >
                  Jumlah Kegiatan
                </label>
                <input
                  id="jumlahKegiatan"
                  type="number"
                  min={1}
                  max={5}
                  value={form.jumlahKegiatan}
                  onChange={(e) =>
                    handleFieldChange(
                      'jumlahKegiatan',
                      Math.max(1, Math.min(5, Number(e.target.value) || 1))
                    )
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="durasiPengerjaan"
                  className="block text-sm font-medium text-slate-900"
                >
                  Durasi Pengerjaan <span className="text-red-600">*</span>
                </label>
                <input
                  id="durasiPengerjaan"
                  type="text"
                  value={form.durasiPengerjaan}
                  onChange={(e) => handleFieldChange('durasiPengerjaan', e.target.value)}
                  placeholder="Contoh: 45 menit"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="diferensiasiLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Diferensiasi
                </label>
                <select
                  id="diferensiasiLkpd"
                  value={form.diferensiasi}
                  onChange={(e) => handleFieldChange('diferensiasi', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {DIFERENSIASI_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="catatanTambahanLkpd"
                  className="block text-sm font-medium text-slate-900"
                >
                  Catatan Tambahan{' '}
                  <span className="text-xs font-normal text-slate-500">(Opsional)</span>
                </label>
                <textarea
                  id="catatanTambahanLkpd"
                  rows={2}
                  value={form.catatanTambahan}
                  onChange={(e) => handleFieldChange('catatanTambahan', e.target.value)}
                  placeholder="Contoh: Sediakan alat peraga sederhana atau sesuaikan bahasa untuk siswa slow learner"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>
          )}
        </section>

        {/* Error & Submit Bar */}
        {generateError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
            {filledKeyCount === 0 && (
              <button
                type="button"
                onClick={() => setApiKeyModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-red-300 text-red-800 font-medium rounded-md hover:bg-red-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Isi API Key
              </button>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            API Key aktif di browser:{' '}
            <strong className="font-mono-tabular text-slate-900">
              {filledKeyCount}/3 slot
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset Form</span>
            </button>

            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Menyusun LKPD...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Buat LKPD</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Tampilan Hasil di bawah form */}
      {result && (
        <LkpdResultView
          result={result}
          durasiPengerjaan={form.durasiPengerjaan}
          isRegenerating={isGenerating}
          onRegenerate={() => void executeGenerate()}
        />
      )}

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
