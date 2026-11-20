import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  ShoppingBasket,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  BentukSoal,
  ExamIdentity,
  GeneratedExamResult,
  LevelKognitif,
  QuestionSectionItem,
} from '../types';
import { countFilledApiKeys, loadApiKeysFromStorage } from '../utils/apiKeys';
import { generateWithFallback, SOAL_JSON_SCHEMA } from '../utils/gemini';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { ExamResultView } from '../components/ExamResultView';

const BENTUK_SOAL_OPTIONS: BentukSoal[] = [
  'Pilihan Ganda',
  'PG Kompleks',
  'Benar/Salah',
  'Menjodohkan',
  'Isian Singkat',
  'Esai',
];

const FASE_OPTIONS = ['Fase A', 'Fase B', 'Fase C', 'Fase D', 'Fase E', 'Fase F'];

const COGNITIVE_LEVELS: Array<{ id: LevelKognitif; desc: string }> = [
  { id: 'C1', desc: 'Mengingat' },
  { id: 'C2', desc: 'Memahami' },
  { id: 'C3', desc: 'Menerapkan' },
  { id: 'C4', desc: 'Menganalisis' },
  { id: 'C5', desc: 'Mengevaluasi' },
  { id: 'C6', desc: 'Mencipta' },
];

const INITIAL_IDENTITY: ExamIdentity = {
  judulUjian: '',
  namaSekolah: '',
  namaGuru: '',
  tahunAjaran: '2026/2027',
  alokasiWaktu: '90 Menit',
  mataPelajaran: '',
  fase: 'Fase D',
  kelas: '',
  topikUtama: '',
};

function buildExamPrompt(
  identity: ExamIdentity,
  sections: QuestionSectionItem[]
): string {
  const totalQuestions = sections.reduce(
    (sum, s) =>
      sum +
      s.distribusiKesulitan.mudah +
      s.distribusiKesulitan.sedang +
      s.distribusiKesulitan.sulit,
    0
  );

  const sectionInstructions = sections
    .map((sec, idx) => {
      const subtotal =
        sec.distribusiKesulitan.mudah +
        sec.distribusiKesulitan.sedang +
        sec.distribusiKesulitan.sulit;
      const isPG =
        sec.bentukSoal === 'Pilihan Ganda' || sec.bentukSoal === 'PG Kompleks';
      const optionLabels =
        sec.jumlahOpsi === 3
          ? 'A, B, C'
          : sec.jumlahOpsi === 4
            ? 'A, B, C, D'
            : 'A, B, C, D, E';

      return [
        `Bagian ${idx + 1}: ${subtotal} butir soal bentuk "${sec.bentukSoal}".`,
        `- Distribusi tingkat kesulitan: ${sec.distribusiKesulitan.mudah} Mudah, ${sec.distribusiKesulitan.sedang} Sedang, ${sec.distribusiKesulitan.sulit} Sulit.`,
        `- Target level kognitif Bloom: ${sec.targetKognitif.join(', ')}.`,
        `- Stimulus/Bacaan: ${
          sec.gunakanStimulus
            ? 'WAJIB menyertakan teks bacaan/data/kasus kontekstual yang relevan pada field "stimulus" untuk setiap soal pada bagian ini.'
            : 'Tidak perlu stimulus panjang (isi field "stimulus" dengan string kosong "").'
        }`,
        isPG
          ? `- Opsi Jawaban: Berikan tepat ${sec.jumlahOpsi} opsi jawaban pada field "opsi" (${optionLabels}). Untuk huruf opsi yang tidak digunakan (misal D atau E jika hanya ${sec.jumlahOpsi} opsi), isi dengan string kosong "".`
          : `- Opsi Jawaban: Karena bukan soal pilihan ganda, isi semua field opsi (A, B, C, D, E) dengan string kosong "".`,
        sec.bentukSoal === 'PG Kompleks'
          ? '- Catatan PG Kompleks: Dapat memiliki lebih dari satu jawaban benar; tuliskan semua huruf kunci benar di field "kunci" (misal: "A, C") dan jelaskan instruksinya di pertanyaan.'
          : sec.bentukSoal === 'Benar/Salah'
            ? '- Catatan Benar/Salah: Berikan pernyataan yang jelas untuk dinilai Benar atau Salah; isi "kunci" dengan "Benar" atau "Salah".'
            : sec.bentukSoal === 'Menjodohkan'
              ? '- Catatan Menjodohkan: Tuliskan daftar premis (1, 2, 3...) dan pilihan pasangan (A, B, C...) dengan jelas di field "pertanyaan", lalu tuliskan pasangan benarnya di field "kunci".'
              : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `Anda adalah pakar penyusun asesmen pendidikan Kurikulum Merdeka Indonesia yang akurat dan teliti.
Susunlah paket instrumen penilaian lengkap dalam Bahasa Indonesia yang baik dan benar berdasarkan identitas ujian dan struktur soal berikut.

IDENTITAS UJIAN:
- Judul Ujian: ${identity.judulUjian}
- Nama Sekolah: ${identity.namaSekolah}
- Nama Guru: ${identity.namaGuru || '-'}
- Tahun Ajaran: ${identity.tahunAjaran}
- Alokasi Waktu: ${identity.alokasiWaktu}
- Mata Pelajaran: ${identity.mataPelajaran}
- Fase: ${identity.fase}
- Kelas: ${identity.kelas}
- Topik / Materi Utama: ${identity.topikUtama}

STRUKTUR & RINCIAN SOAL (TOTAL ${totalQuestions} SOAL):
${sectionInstructions}

ATURAN OUTPUT JSON KETAT:
1. Hasilkan array "soal" berjumlah TEPAT ${totalQuestions} item, dengan field "no" bernomor urut 1 sampai ${totalQuestions}.
2. Isi field "meta" sesuai identitas ujian: judul, sekolah, mapel, kelas.
3. Setiap item soal wajib memiliki:
   - "no": nomor urut integer (1..${totalQuestions})
   - "tipe": nama bentuk soal persis sesuai bagiannya
   - "stimulus": teks stimulus jika diaktifkan, atau "" jika tidak diaktifkan
   - "pertanyaan": teks pertanyaan yang jelas dan tidak ambigu
   - "opsi": objek { A, B, C, D, E } sesuai aturan di atas
   - "kunci": kunci jawaban yang tegas dan tepat
   - "pembahasan": penjelasan langkah penyelesaian / alasan kebenaran kunci
   - "indikator": indikator pencapaian kompetensi yang terukur (contoh: "Peserta didik mampu...")
   - "level_kognitif": salah satu dari C1, C2, C3, C4, C5, C6 sesuai target bagiannya
   - "kesulitan": salah satu dari "Mudah", "Sedang", atau "Sulit" sesuai distribusi bagiannya.`;
}

export function GeneratorSoalPage() {
  const { user, profile, apiKeys } = useAuth();

  // Bagian A: Identitas Ujian
  const [identity, setIdentity] = useState<ExamIdentity>(INITIAL_IDENTITY);
  const [didPrefill, setDidPrefill] = useState(false);

  // Accordion state
  const [openBagianA, setOpenBagianA] = useState(true);
  const [openBagianB, setOpenBagianB] = useState(true);
  const [openBagianC, setOpenBagianC] = useState(true);

  // Bagian B: Pengaturan Soal draft
  const [bentukSoal, setBentukSoal] = useState<BentukSoal>('Pilihan Ganda');
  const [jumlahOpsi, setJumlahOpsi] = useState<number>(4);
  const [gunakanStimulus, setGunakanStimulus] = useState<boolean>(false);
  const [mudah, setMudah] = useState<number>(2);
  const [sedang, setSedang] = useState<number>(2);
  const [sulit, setSulit] = useState<number>(1);
  const [targetKognitif, setTargetKognitif] = useState<LevelKognitif[]>(['C2', 'C3']);
  const [sectionFeedback, setSectionFeedback] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Bagian C: Keranjang
  const [keranjang, setKeranjang] = useState<QuestionSectionItem[]>([]);

  // Generate State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedExamResult | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Prefill from teacher profile once when available
  useEffect(() => {
    if (didPrefill) return;
    if (profile || user) {
      setIdentity((prev) => ({
        ...prev,
        namaSekolah: prev.namaSekolah || profile?.sekolah || '',
        namaGuru: prev.namaGuru || profile?.namaLengkap || user?.displayName || '',
        mataPelajaran: prev.mataPelajaran || profile?.mataPelajaran || '',
        kelas: prev.kelas || profile?.kelas || '',
      }));
      setDidPrefill(true);
    }
  }, [profile, user, didPrefill]);

  const draftSubtotal = Math.max(0, mudah) + Math.max(0, sedang) + Math.max(0, sulit);
  const isPGType = bentukSoal === 'Pilihan Ganda' || bentukSoal === 'PG Kompleks';

  const totalKeranjangQuestions = useMemo(
    () =>
      keranjang.reduce(
        (acc, item) =>
          acc +
          item.distribusiKesulitan.mudah +
          item.distribusiKesulitan.sedang +
          item.distribusiKesulitan.sulit,
        0
      ),
    [keranjang]
  );

  const filledKeyCount = countFilledApiKeys(apiKeys);

  const handleIdentityChange = (field: keyof ExamIdentity, value: string) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
    setGenerateError(null);
  };

  const toggleKognitif = (level: LevelKognitif) => {
    setSectionError(null);
    setTargetKognitif((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
    );
  };

  const handleAddToCart = () => {
    setSectionError(null);
    setSectionFeedback(null);

    if (draftSubtotal <= 0) {
      setSectionError('Jumlah total soal (Mudah + Sedang + Sulit) minimal harus 1.');
      return;
    }

    if (targetKognitif.length === 0) {
      setSectionError('Pilih minimal 1 target level kognitif (C1–C6).');
      return;
    }

    const sortedLevels = [...targetKognitif].sort();
    const newItem: QuestionSectionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bentukSoal,
      jumlahOpsi: isPGType ? jumlahOpsi : 0,
      gunakanStimulus,
      distribusiKesulitan: {
        mudah: Math.max(0, mudah),
        sedang: Math.max(0, sedang),
        sulit: Math.max(0, sulit),
      },
      targetKognitif: sortedLevels,
    };

    setKeranjang((prev) => [...prev, newItem]);
    setSectionFeedback(
      `${draftSubtotal} soal ${bentukSoal} ditambahkan ke keranjang struktur ujian.`
    );
    setGenerateError(null);
  };

  const handleRemoveCartItem = (id: string) => {
    setKeranjang((prev) => prev.filter((item) => item.id !== id));
  };

  const executeGenerate = async () => {
    setGenerateError(null);

    if (
      !identity.judulUjian.trim() ||
      !identity.namaSekolah.trim() ||
      !identity.mataPelajaran.trim() ||
      !identity.kelas.trim() ||
      !identity.topikUtama.trim()
    ) {
      setOpenBagianA(true);
      setGenerateError(
        'Lengkapi Judul Ujian, Nama Sekolah, Mata Pelajaran, Kelas, dan Topik/Materi Utama pada Bagian A terlebih dahulu.'
      );
      return;
    }

    if (keranjang.length === 0) {
      setOpenBagianC(true);
      setGenerateError(
        'Keranjang struktur ujian masih kosong. Tambahkan minimal 1 bagian soal dari Bagian B.'
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
      const prompt = buildExamPrompt(identity, keranjang);
      const { data } = await generateWithFallback<GeneratedExamResult>(
        prompt,
        SOAL_JSON_SCHEMA,
        storedKeys
      );

      if (!data || !Array.isArray(data.soal) || data.soal.length === 0) {
        throw new Error('Respons AI tidak memuat daftar soal yang valid. Silakan coba lagi.');
      }

      setResult(data);
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : 'Gagal menyusun soal. Silakan periksa API Key dan coba kembali.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetAll = () => {
    setResult(null);
    setKeranjang([]);
    setGenerateError(null);
    setSectionFeedback(null);
    setSectionError(null);
    setIdentity({
      ...INITIAL_IDENTITY,
      namaSekolah: profile?.sekolah || '',
      namaGuru: profile?.namaLengkap || user?.displayName || '',
      mataPelajaran: profile?.mataPelajaran || '',
      kelas: profile?.kelas || '',
    });
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Hasil Generator Soal
            </h1>
            <p className="text-sm text-slate-600">
              {identity.judulUjian} · {identity.mataPelajaran} · Kelas {identity.kelas}
            </p>
          </div>
        </div>

        {generateError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{generateError}</span>
          </div>
        )}

        <ExamResultView
          result={result}
          identity={identity}
          isRegenerating={isGenerating}
          onReset={handleResetAll}
          onRegenerate={() => void executeGenerate()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Generator Soal
          </h1>
          <p className="text-sm text-slate-600">
            Susun naskah soal, kunci & pembahasan, kisi-kisi, dan kartu soal terstruktur menggunakan Gemini API Key pribadi Anda.
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

      {/* Bagian A: Identitas Ujian */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenBagianA((prev) => !prev)}
          aria-expanded={openBagianA}
          className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <div className="space-y-0.5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Bagian A: Identitas Ujian
            </h2>
            <p className="text-xs text-slate-500">
              Informasi judul asesmen, satuan pendidikan, mata pelajaran, dan materi pokok.
            </p>
          </div>
          {openBagianA ? (
            <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          )}
        </button>

        {openBagianA && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="judulUjian"
                className="block text-sm font-medium text-slate-900"
              >
                Judul Ujian <span className="text-red-600">*</span>
              </label>
              <input
                id="judulUjian"
                type="text"
                value={identity.judulUjian}
                onChange={(e) => handleIdentityChange('judulUjian', e.target.value)}
                placeholder="Contoh: Asesmen Sumatif Akhir Semester Ganjil"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="namaSekolah"
                className="block text-sm font-medium text-slate-900"
              >
                Nama Sekolah <span className="text-red-600">*</span>
              </label>
              <input
                id="namaSekolah"
                type="text"
                value={identity.namaSekolah}
                onChange={(e) => handleIdentityChange('namaSekolah', e.target.value)}
                placeholder="Contoh: SMP Negeri 1 Bandung"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="namaGuru"
                className="block text-sm font-medium text-slate-900"
              >
                Nama Guru
              </label>
              <input
                id="namaGuru"
                type="text"
                value={identity.namaGuru}
                onChange={(e) => handleIdentityChange('namaGuru', e.target.value)}
                placeholder="Contoh: Dra. Siti Aminah, M.Pd."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="tahunAjaran"
                className="block text-sm font-medium text-slate-900"
              >
                Tahun Ajaran
              </label>
              <input
                id="tahunAjaran"
                type="text"
                value={identity.tahunAjaran}
                onChange={(e) => handleIdentityChange('tahunAjaran', e.target.value)}
                placeholder="Contoh: 2026/2027"
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="alokasiWaktu"
                className="block text-sm font-medium text-slate-900"
              >
                Alokasi Waktu
              </label>
              <input
                id="alokasiWaktu"
                type="text"
                value={identity.alokasiWaktu}
                onChange={(e) => handleIdentityChange('alokasiWaktu', e.target.value)}
                placeholder="Contoh: 90 Menit"
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
                value={identity.mataPelajaran}
                onChange={(e) => handleIdentityChange('mataPelajaran', e.target.value)}
                placeholder="Contoh: Ilmu Pengetahuan Alam (IPA)"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="fase"
                  className="block text-sm font-medium text-slate-900"
                >
                  Fase
                </label>
                <select
                  id="fase"
                  value={identity.fase}
                  onChange={(e) => handleIdentityChange('fase', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {FASE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="kelas"
                  className="block text-sm font-medium text-slate-900"
                >
                  Kelas <span className="text-red-600">*</span>
                </label>
                <input
                  id="kelas"
                  type="text"
                  value={identity.kelas}
                  onChange={(e) => handleIdentityChange('kelas', e.target.value)}
                  placeholder="Contoh: VIII"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="topikUtama"
                className="block text-sm font-medium text-slate-900"
              >
                Topik / Materi Utama <span className="text-red-600">*</span>
              </label>
              <textarea
                id="topikUtama"
                rows={2}
                value={identity.topikUtama}
                onChange={(e) => handleIdentityChange('topikUtama', e.target.value)}
                placeholder="Contoh: Sistem Pernapasan Manusia, Zat Aditif & Adiktif, serta Tekanan Zat"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>
        )}
      </section>

      {/* Bagian B: Pengaturan Soal */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenBagianB((prev) => !prev)}
          aria-expanded={openBagianB}
          className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <div className="space-y-0.5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Bagian B: Pengaturan Soal (Tambah Bagian Soal)
            </h2>
            <p className="text-xs text-slate-500">
              Tentukan bentuk soal, stimulus, distribusi tingkat kesulitan, dan target kognitif sebelum dimasukkan ke keranjang.
            </p>
          </div>
          {openBagianB ? (
            <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          )}
        </button>

        {openBagianB && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label
                  htmlFor="bentukSoal"
                  className="block text-sm font-medium text-slate-900"
                >
                  Bentuk Soal
                </label>
                <select
                  id="bentukSoal"
                  value={bentukSoal}
                  onChange={(e) => {
                    setBentukSoal(e.target.value as BentukSoal);
                    setSectionError(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {BENTUK_SOAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {isPGType && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="jumlahOpsi"
                    className="block text-sm font-medium text-slate-900"
                  >
                    Jumlah Opsi (Khusus PG)
                  </label>
                  <select
                    id="jumlahOpsi"
                    value={jumlahOpsi}
                    onChange={(e) => setJumlahOpsi(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  >
                    <option value={3}>3 Opsi (A–C)</option>
                    <option value={4}>4 Opsi (A–D)</option>
                    <option value={5}>5 Opsi (A–E)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-900">
                  Gunakan bacaan/stimulus
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gunakanStimulus}
                  onClick={() => setGunakanStimulus((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm border rounded-lg transition-colors cursor-pointer ${
                    gunakanStimulus
                      ? 'bg-teal-50 border-teal-300 text-teal-900'
                      : 'bg-slate-50 border-slate-300 text-slate-700'
                  }`}
                >
                  <span>{gunakanStimulus ? 'Aktif (Pakai Stimulus)' : 'Nonaktif'}</span>
                  <span
                    aria-hidden="true"
                    className={`w-9 h-5 rounded-full transition-colors relative inline-flex items-center px-0.5 ${
                      gunakanStimulus ? 'bg-teal-700' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        gunakanStimulus ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* Distribusi Kesulitan */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">
                  Distribusi Kesulitan
                </span>
                <span className="text-xs font-mono-tabular text-slate-600">
                  Subtotal Bagian: <strong className="text-slate-900">{draftSubtotal}</strong> soal
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="jmlMudah" className="block text-xs font-medium text-slate-600">
                    Mudah
                  </label>
                  <input
                    id="jmlMudah"
                    type="number"
                    min={0}
                    max={50}
                    value={mudah}
                    onChange={(e) => {
                      setMudah(Math.max(0, Number(e.target.value) || 0));
                      setSectionError(null);
                    }}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="jmlSedang" className="block text-xs font-medium text-slate-600">
                    Sedang
                  </label>
                  <input
                    id="jmlSedang"
                    type="number"
                    min={0}
                    max={50}
                    value={sedang}
                    onChange={(e) => {
                      setSedang(Math.max(0, Number(e.target.value) || 0));
                      setSectionError(null);
                    }}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="jmlSulit" className="block text-xs font-medium text-slate-600">
                    Sulit
                  </label>
                  <input
                    id="jmlSulit"
                    type="number"
                    min={0}
                    max={50}
                    value={sulit}
                    onChange={(e) => {
                      setSulit(Math.max(0, Number(e.target.value) || 0));
                      setSectionError(null);
                    }}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  />
                </div>
              </div>
            </div>

            {/* Target Kognitif C1-C6 */}
            <div className="space-y-2.5">
              <span className="block text-sm font-medium text-slate-900">
                Target Kognitif (Taksonomi Bloom C1–C6)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {COGNITIVE_LEVELS.map((lvl) => {
                  const checked = targetKognitif.includes(lvl.id);
                  return (
                    <label
                      key={lvl.id}
                      className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-teal-50 border-teal-300 text-teal-900 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleKognitif(lvl.id)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                      />
                      <span>
                        <strong className="font-mono-tabular">{lvl.id}</strong> · {lvl.desc}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {sectionError && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sectionError}</span>
              </div>
            )}

            {sectionFeedback && (
              <div
                role="status"
                className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{sectionFeedback}</span>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleAddToCart}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-300 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah ke Keranjang</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Bagian C: Struktur Ujian (Keranjang) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenBagianC((prev) => !prev)}
          aria-expanded={openBagianC}
          className="w-full flex items-center justify-between px-6 py-4 text-left border-b border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <ShoppingBasket className="w-5 h-5 text-teal-700 shrink-0" />
            <div className="space-y-0.5">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Bagian C: Struktur Ujian (Keranjang)
              </h2>
              <p className="text-xs text-slate-500 font-mono-tabular">
                {keranjang.length} bagian soal · Total {totalKeranjangQuestions} butir soal
              </p>
            </div>
          </div>
          {openBagianC ? (
            <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          )}
        </button>

        {openBagianC && (
          <div className="p-6 space-y-5">
            {keranjang.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                <Layers className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">
                  Keranjang struktur ujian masih kosong
                </p>
                <p className="text-xs text-slate-500">
                  Atur jenis dan jumlah soal pada Bagian B, lalu klik &ldquo;Tambah ke Keranjang&rdquo;. Anda bisa menggabungkan beberapa bentuk soal sekaligus (misalnya 5 Pilihan Ganda + 2 Esai).
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {keranjang.map((item, idx) => {
                  const subtotal =
                    item.distribusiKesulitan.mudah +
                    item.distribusiKesulitan.sedang +
                    item.distribusiKesulitan.sulit;
                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                          <span className="font-mono-tabular text-teal-800">
                            {idx + 1}.
                          </span>
                          <span>{item.bentukSoal}</span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <span className="font-mono-tabular">{subtotal} Soal</span>
                          {item.jumlahOpsi > 0 && (
                            <>
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                              <span className="text-xs font-normal text-slate-600">
                                {item.jumlahOpsi} Opsi
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-mono-tabular">
                            Mudah: {item.distribusiKesulitan.mudah}, Sedang:{' '}
                            {item.distribusiKesulitan.sedang}, Sulit:{' '}
                            {item.distribusiKesulitan.sulit}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            Kognitif: {item.targetKognitif.join(', ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {item.gunakanStimulus ? 'Dengan Stimulus' : 'Tanpa Stimulus'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {generateError && (
              <div
                role="alert"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
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

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                API Key aktif di browser:{' '}
                <strong className="font-mono-tabular text-slate-900">
                  {filledKeyCount}/3 slot
                </strong>
              </div>

              <button
                type="button"
                onClick={() => void executeGenerate()}
                disabled={isGenerating || keranjang.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Menyusun {totalKeranjangQuestions} Soal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>Generate Semua Soal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
