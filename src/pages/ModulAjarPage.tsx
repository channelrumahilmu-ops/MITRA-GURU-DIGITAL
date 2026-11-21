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
import type {
  GeneratedModulAjarResult,
  ModulAjarFormValues,
} from '../types';
import { countFilledApiKeys, loadApiKeysFromStorage } from '../utils/apiKeys';
import {
  generateWithFallback,
  MODUL_AJAR_JSON_SCHEMA,
} from '../utils/gemini';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { ModulAjarResultView } from '../components/ModulAjarResultView';

const FASE_OPTIONS = ['Fase A', 'Fase B', 'Fase C', 'Fase D', 'Fase E', 'Fase F'];

const DIMENSI_PROFIL_LULUSAN_OPTIONS = [
  'Keimanan dan Ketakwaan terhadap Tuhan YME',
  'Kewargaan',
  'Penalaran Kritis',
  'Kreativitas',
  'Kolaborasi',
  'Kemandirian',
  'Kesehatan',
  'Komunikasi',
];

const MODEL_PEMBELAJARAN_OPTIONS = [
  'Problem Based Learning',
  'Project Based Learning',
  'Discovery Learning',
  'Inquiry Learning',
  'Cooperative Learning',
  'Contextual Teaching and Learning',
];

const METODE_PEMBELAJARAN_OPTIONS = [
  'Diskusi',
  'Presentasi',
  'Demonstrasi',
  'Praktikum / Eksperimen',
  'Tanya Jawab',
  'Penugasan',
  'Studi Kasus',
  'Simulasi',
];

const ASESMEN_OPTIONS = [
  'Formatif',
  'Sumatif',
  'Diagnostik',
];

const INITIAL_FORM: ModulAjarFormValues = {
  satuanPendidikan: '',
  mataPelajaran: '',
  kelasSemester: '',
  fase: 'Fase D',
  alokasiWaktu: '2 JP x 40 Menit',
  jumlahPertemuan: '1 Pertemuan',
  penyusun: '',
  capaianPembelajaran: '',
  topikMateri: '',
  tujuanPembelajaran: '',
  karakteristikMurid: '',
  dimensiProfilLulusan: ['Penalaran Kritis', 'Kolaborasi'],
  modelPembelajaran: 'Problem Based Learning',
  metodePembelajaran: ['Diskusi', 'Presentasi'],
  asesmen: 'Formatif',
};

function buildModulAjarPrompt(form: ModulAjarFormValues): string {
  const dimensiText =
    form.dimensiProfilLulusan.length > 0
      ? form.dimensiProfilLulusan.join(', ')
      : 'Penalaran Kritis, Kemandirian';
  const metodeText =
    form.metodePembelajaran.length > 0
      ? form.metodePembelajaran.join(', ')
      : 'Diskusi, Tanya Jawab';
  const karakteristikText = form.karakteristikMurid.trim();

  return `Anda adalah seorang ahli penyusun kurikulum dan Modul Ajar / Rencana Pembelajaran Mendalam (RPM) Kurikulum Merdeka Indonesia yang berpengalaman.
Susunlah Modul Ajar yang komprehensif, aplikatif, sistematis, dan siap digunakan guru di kelas dalam Bahasa Indonesia baku berdasarkan data masukan berikut:

BAGIAN A — IDENTITAS:
- Satuan Pendidikan: ${form.satuanPendidikan}
- Mata Pelajaran: ${form.mataPelajaran}
- Kelas / Semester: ${form.kelasSemester}
- Fase: ${form.fase}
- Alokasi Waktu: ${form.alokasiWaktu}
- Jumlah Pertemuan: ${form.jumlahPertemuan}
- Penyusun: ${form.penyusun || '-'}

BAGIAN B — ANALISIS PEMBELAJARAN:
- Capaian Pembelajaran (CP): ${form.capaianPembelajaran}
- Topik / Materi Utama: ${form.topikMateri}
- Tujuan Pembelajaran (TP): ${form.tujuanPembelajaran}
- Karakteristik Murid: ${
    karakteristikText || 'Kelas heterogen umum tanpa catatan khusus.'
  }

BAGIAN C — DESAIN PEMBELAJARAN:
- 8 Dimensi Profil Lulusan: ${dimensiText}
- Model Pembelajaran: ${form.modelPembelajaran}
- Metode Pembelajaran: ${metodeText}

BAGIAN D — ASESMEN:
- Jenis Asesmen yang dipilih: ${form.asesmen}

INSTRUKSI PENYUSUNAN PENGALAMAN BELAJAR & OUTPUT JSON:
Anda WAJIB merancang seluruh rangkaian pengalaman belajar (Kegiatan Pendahuluan, Kegiatan Inti, dan Kegiatan Penutup) secara mandiri dan terperinci berdasarkan CP, TP, Jumlah Pertemuan (${form.jumlahPertemuan}), Model Pembelajaran (${form.modelPembelajaran}), Metode (${metodeText}), serta Karakteristik Murid yang diinput.

1. "judul_modul": Judul modul ajar yang spesifik dan informatif memuat topik/materi serta jenjang/kelas.
2. "identitas": Salin dan rapikan seluruh 7 field identitas (satuan_pendidikan, mata_pelajaran, kelas_semester, fase, alokasi_waktu, jumlah_pertemuan, penyusun).
3. "analisis_pembelajaran":
   - "capaian_pembelajaran": Rumusan CP sesuai input.
   - "topik_materi": Topik/materi pembelajaran.
   - "tujuan_pembelajaran": Array berisi daftar butir Tujuan Pembelajaran yang operasional dan terukur selaras dengan CP serta input TP guru.
   - "karakteristik_murid": Ringkasan karakteristik murid dan strategi diferensiasi singkat yang relevan (atau "Umum / heterogen" jika tidak diisi).
4. "desain_pembelajaran":
   - "dimensi_profil_lulusan": Array dimensi dari 8 Dimensi Profil Lulusan yang dipilih (${dimensiText}).
   - "model_pembelajaran": Nama model pembelajaran yang dipilih.
   - "metode_pembelajaran": Array metode pembelajaran yang diterapkan.
5. "pengalaman_belajar":
   - "pendahuluan": Array langkah-langkah konkret kegiatan pendahuluan (salam, doa, kesiapan belajar, apersepsi kontekstual, pertanyaan pemantik, penyampaian tujuan pembelajaran & alur kegiatan).
   - "kegiatan_inti": Array langkah-langkah detail kegiatan inti yang mengikuti sintaks resmi model "${form.modelPembelajaran}" dan metode "${metodeText}" untuk ${form.jumlahPertemuan}. Apabila terdapat karakteristik murid khusus (misal gaya belajar visual, kinestetik, atau slow learner), integrasikan penyesuaian/diferensiasi pembelajaran secara eksplisit di dalam langkah kegiatan inti!
   - "penutup": Array langkah-langkah kegiatan penutup (umpan balik, kesimpulan bersama, refleksi murid & guru, tindak lanjut/penugasan, doa & salam penutup).
6. "asesmen":
   - "jenis": "${form.asesmen}".
   - "bentuk_instrumen": Penjelasan rinci teknik penilaian, bentuk instrumen (lembar observasi, tes tertulis/kuis, rubrik penilaian kinerja/proyek), serta kriteria pencapaian yang sesuai dengan jenis asesmen "${form.asesmen}" dan karakteristik murid.`;
}

export function ModulAjarPage() {
  const { user, profile, apiKeys } = useAuth();
  const [form, setForm] = useState<ModulAjarFormValues>(INITIAL_FORM);
  const [didPrefill, setDidPrefill] = useState(false);

  const [openA, setOpenA] = useState(true);
  const [openB, setOpenB] = useState(true);
  const [openC, setOpenC] = useState(true);
  const [openD, setOpenD] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedModulAjarResult | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  useEffect(() => {
    if (didPrefill) return;
    if (profile || user) {
      setForm((prev) => ({
        ...prev,
        satuanPendidikan: prev.satuanPendidikan || profile?.sekolah || '',
        mataPelajaran: prev.mataPelajaran || profile?.mataPelajaran || '',
        kelasSemester: prev.kelasSemester || profile?.kelas || '',
        penyusun: prev.penyusun || profile?.namaLengkap || user?.displayName || '',
      }));
      setDidPrefill(true);
    }
  }, [profile, user, didPrefill]);

  const filledKeyCount = countFilledApiKeys(apiKeys);

  const handleFieldChange = <K extends keyof ModulAjarFormValues>(
    field: K,
    value: ModulAjarFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setGenerateError(null);
  };

  const toggleArrayOption = (
    field: 'dimensiProfilLulusan' | 'metodePembelajaran',
    option: string
  ) => {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [field]: next };
    });
    setGenerateError(null);
  };

  const executeGenerate = async () => {
    setGenerateError(null);

    if (
      !form.satuanPendidikan.trim() ||
      !form.mataPelajaran.trim() ||
      !form.kelasSemester.trim() ||
      !form.alokasiWaktu.trim() ||
      !form.jumlahPertemuan.trim()
    ) {
      setOpenA(true);
      setGenerateError(
        'Lengkapi Satuan Pendidikan, Mata Pelajaran, Kelas/Semester, Alokasi Waktu, dan Jumlah Pertemuan pada Bagian A terlebih dahulu.'
      );
      return;
    }

    if (
      !form.capaianPembelajaran.trim() ||
      !form.topikMateri.trim() ||
      !form.tujuanPembelajaran.trim()
    ) {
      setOpenB(true);
      setGenerateError(
        'Lengkapi Capaian Pembelajaran (CP), Topik/Materi, dan Tujuan Pembelajaran (TP) pada Bagian B terlebih dahulu.'
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
      const prompt = buildModulAjarPrompt(form);
      const { data } = await generateWithFallback<GeneratedModulAjarResult>(
        prompt,
        MODUL_AJAR_JSON_SCHEMA,
        storedKeys
      );

      if (!data || !data.identitas || !data.pengalaman_belajar) {
        throw new Error(
          'Respons AI tidak memuat struktur Modul Ajar yang lengkap. Silakan coba lagi.'
        );
      }

      setResult(data);
      requestAnimationFrame(() => {
        const el = document.getElementById('modul-ajar-result');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : 'Gagal menyusun Modul Ajar. Silakan periksa API Key dan coba kembali.'
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
      penyusun: profile?.namaLengkap || user?.displayName || '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Modul Ajar / RPM
          </h1>
          <p className="text-sm text-slate-600">
            Susun Rencana Pembelajaran Mendalam dan Modul Ajar Kurikulum Merdeka. Langkah pembelajaran akan dirancang otomatis menyesuaikan karakteristik murid dan sintaks model pembelajaran.
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

      {/* Form Modul Ajar */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Bagian A: Identitas */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenA((prev) => !prev)}
            aria-expanded={openA}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian A: Identitas
              </h2>
              <p className="text-xs text-slate-500">
                Satuan pendidikan, mata pelajaran, kelas/semester, fase, alokasi waktu, jumlah pertemuan, dan penyusun.
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
              <div className="space-y-1.5">
                <label
                  htmlFor="satuanPendidikan"
                  className="block text-sm font-medium text-slate-900"
                >
                  Satuan Pendidikan <span className="text-red-600">*</span>
                </label>
                <input
                  id="satuanPendidikan"
                  type="text"
                  value={form.satuanPendidikan}
                  onChange={(e) => handleFieldChange('satuanPendidikan', e.target.value)}
                  placeholder="Contoh: SMP Negeri 1 Bandung"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="mataPelajaran"
                  className="block text-sm font-medium text-slate-900"
                >
                  Mata Pelajaran <span className="text-red-600">*</span>
                </label>
                <input
                  id="mataPelajaran"
                  type="text"
                  value={form.mataPelajaran}
                  onChange={(e) => handleFieldChange('mataPelajaran', e.target.value)}
                  placeholder="Contoh: Ilmu Pengetahuan Alam (IPA)"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="kelasSemester"
                  className="block text-sm font-medium text-slate-900"
                >
                  Kelas / Semester <span className="text-red-600">*</span>
                </label>
                <input
                  id="kelasSemester"
                  type="text"
                  value={form.kelasSemester}
                  onChange={(e) => handleFieldChange('kelasSemester', e.target.value)}
                  placeholder="Contoh: VIII / Ganjil"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="faseModul"
                  className="block text-sm font-medium text-slate-900"
                >
                  Fase
                </label>
                <select
                  id="faseModul"
                  value={form.fase}
                  onChange={(e) => handleFieldChange('fase', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {FASE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="alokasiWaktu"
                  className="block text-sm font-medium text-slate-900"
                >
                  Alokasi Waktu <span className="text-red-600">*</span>
                </label>
                <input
                  id="alokasiWaktu"
                  type="text"
                  value={form.alokasiWaktu}
                  onChange={(e) => handleFieldChange('alokasiWaktu', e.target.value)}
                  placeholder="Contoh: 2 JP x 40 Menit"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="jumlahPertemuan"
                  className="block text-sm font-medium text-slate-900"
                >
                  Jumlah Pertemuan <span className="text-red-600">*</span>
                </label>
                <input
                  id="jumlahPertemuan"
                  type="text"
                  value={form.jumlahPertemuan}
                  onChange={(e) => handleFieldChange('jumlahPertemuan', e.target.value)}
                  placeholder="Contoh: 2 Pertemuan"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="penyusun"
                  className="block text-sm font-medium text-slate-900"
                >
                  Penyusun
                </label>
                <input
                  id="penyusun"
                  type="text"
                  value={form.penyusun}
                  onChange={(e) => handleFieldChange('penyusun', e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>
          )}
        </section>

        {/* Bagian B: Analisis Pembelajaran */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenB((prev) => !prev)}
            aria-expanded={openB}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian B: Analisis Pembelajaran
              </h2>
              <p className="text-xs text-slate-500">
                Capaian Pembelajaran (CP), topik materi pokok, Tujuan Pembelajaran (TP), dan karakteristik murid.
              </p>
            </div>
            {openB ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          {openB && (
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="capaianPembelajaran"
                  className="block text-sm font-medium text-slate-900"
                >
                  Capaian Pembelajaran (CP) <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="capaianPembelajaran"
                  rows={3}
                  value={form.capaianPembelajaran}
                  onChange={(e) => handleFieldChange('capaianPembelajaran', e.target.value)}
                  placeholder="Salin atau ringkas Capaian Pembelajaran sesuai fase..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="topikMateri"
                  className="block text-sm font-medium text-slate-900"
                >
                  Topik / Materi <span className="text-red-600">*</span>
                </label>
                <input
                  id="topikMateri"
                  type="text"
                  value={form.topikMateri}
                  onChange={(e) => handleFieldChange('topikMateri', e.target.value)}
                  placeholder="Contoh: Sistem Pernapasan Manusia dan Gangguan Kesehatan"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tujuanPembelajaran"
                  className="block text-sm font-medium text-slate-900"
                >
                  Tujuan Pembelajaran (TP) <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="tujuanPembelajaran"
                  rows={3}
                  value={form.tujuanPembelajaran}
                  onChange={(e) => handleFieldChange('tujuanPembelajaran', e.target.value)}
                  placeholder="Contoh: Peserta didik mampu mengidentifikasi organ pernapasan manusia dan menganalisis mekanisme pernapasan dada dan perut."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="karakteristikMurid"
                  className="block text-sm font-medium text-slate-900"
                >
                  Karakteristik Murid{' '}
                  <span className="text-xs font-normal text-slate-500">(Opsional)</span>
                </label>
                <textarea
                  id="karakteristikMurid"
                  rows={2}
                  value={form.karakteristikMurid}
                  onChange={(e) => handleFieldChange('karakteristikMurid', e.target.value)}
                  placeholder="Contoh: Sebagian besar murid visual, ada 2 murid slow learner"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>
          )}
        </section>

        {/* Bagian C: Desain Pembelajaran */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenC((prev) => !prev)}
            aria-expanded={openC}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian C: Desain Pembelajaran
              </h2>
              <p className="text-xs text-slate-500">
                8 Dimensi Profil Lulusan, model pembelajaran, dan metode pembelajaran.
              </p>
            </div>
            {openC ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          {openC && (
            <div className="p-6 space-y-6">
              {/* 8 Dimensi Profil Lulusan */}
              <div className="space-y-2.5">
                <span className="block text-sm font-medium text-slate-900">
                  8 Dimensi Profil Lulusan
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {DIMENSI_PROFIL_LULUSAN_OPTIONS.map((dim) => {
                    const checked = form.dimensiProfilLulusan.includes(dim);
                    return (
                      <label
                        key={dim}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 border rounded-lg text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArrayOption('dimensiProfilLulusan', dim)}
                          className="rounded border-slate-300 text-teal-700 focus:ring-teal-700 shrink-0"
                        />
                        <span>{dim}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Model Pembelajaran */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modelPembelajaran"
                  className="block text-sm font-medium text-slate-900"
                >
                  Model Pembelajaran
                </label>
                <select
                  id="modelPembelajaran"
                  value={form.modelPembelajaran}
                  onChange={(e) => handleFieldChange('modelPembelajaran', e.target.value)}
                  className="w-full md:max-w-md px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {MODEL_PEMBELAJARAN_OPTIONS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Metode Pembelajaran */}
              <div className="space-y-2.5">
                <span className="block text-sm font-medium text-slate-900">
                  Metode Pembelajaran
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {METODE_PEMBELAJARAN_OPTIONS.map((metode) => {
                    const checked = form.metodePembelajaran.includes(metode);
                    return (
                      <label
                        key={metode}
                        className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-xs sm:text-sm cursor-pointer transition-colors ${
                          checked
                            ? 'bg-teal-50 border-teal-300 text-teal-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleArrayOption('metodePembelajaran', metode)}
                          className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                        />
                        <span>{metode}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Bagian D: Asesmen */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenD((prev) => !prev)}
            aria-expanded={openD}
            className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
          >
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian D: Asesmen
              </h2>
              <p className="text-xs text-slate-500">
                Pilih jenis asesmen pembelajaran; langkah kegiatan pendahuluan, inti, dan penutup akan disusun otomatis oleh AI.
              </p>
            </div>
            {openD ? (
              <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
            )}
          </button>

          {openD && (
            <div className="p-6 space-y-1.5">
              <label
                htmlFor="jenisAsesmen"
                className="block text-sm font-medium text-slate-900"
              >
                Jenis Asesmen
              </label>
              <select
                id="jenisAsesmen"
                value={form.asesmen}
                onChange={(e) => handleFieldChange('asesmen', e.target.value)}
                className="w-full md:max-w-md px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                {ASESMEN_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
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
                  <span>Menyusun Modul Ajar...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Generate Modul Ajar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Tampilan Hasil di bawah form */}
      {result && (
        <ModulAjarResultView
          result={result}
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
