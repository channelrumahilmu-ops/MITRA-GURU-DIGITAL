import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileSpreadsheet,
  FolderKanban,
  KeyRound,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { countFilledApiKeys } from '../utils/apiKeys';
import { ApiKeyModal } from '../components/ApiKeyModal';

const MODULES = [
  {
    title: 'Modul Ajar/RPM',
    description: 'Penyusunan Rencana Pembelajaran Mendalam dan Modul Ajar terstruktur.',
    path: '/administrasi/modul-ajar',
    icon: BookOpen,
    available: false,
  },
  {
    title: 'Analisis CP, TP dan ATP',
    description: 'Pemetaan Capaian Pembelajaran menjadi Tujuan dan Alur Tujuan Pembelajaran.',
    path: '/administrasi/analisis-cp',
    icon: Compass,
    available: false,
  },
  {
    title: 'Generator LKPD',
    description: 'Perancangan Lembar Kerja Peserta Didik beserta rubrik penilaian.',
    path: '/administrasi/lkpd',
    icon: FileSpreadsheet,
    available: false,
  },
  {
    title: 'Modul Kokurikuler',
    description: 'Perencanaan proyek dan kegiatan kokurikuler lintas disiplin.',
    path: '/administrasi/kokurikuler',
    icon: FolderKanban,
    available: false,
  },
  {
    title: 'Generator Soal',
    description: 'Penyusunan instrumen evaluasi formatif dan sumatif.',
    path: '/administrasi/generator-soal',
    icon: ClipboardList,
    available: true,
  },
  {
    title: 'Bank Soal',
    description: 'Arsip soal terklasifikasi berdasarkan mata pelajaran dan kelas.',
    path: '/administrasi/bank-soal',
    icon: Archive,
    available: false,
  },
] as const;

export function DashboardPage() {
  const { user, profile, profileLoading, apiKeys } = useAuth();
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  const filledKeys = countFilledApiKeys(apiKeys);
  const teacherName =
    profile?.namaLengkap?.trim() ||
    user?.displayName ||
    user?.email ||
    'Bapak/Ibu Guru';

  const isProfileComplete = Boolean(
    profile?.namaLengkap &&
      profile?.sekolah &&
      profile?.mataPelajaran &&
      profile?.kelas
  );

  return (
    <div className="space-y-8">
      <section className="space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Selamat Datang, {teacherName}
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Fondasi ruang kerja administrasi guru sudah siap. Lengkapi profil pengajar dan atur Gemini API Key Anda sebelum menggunakan fitur generator.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">
                Data Pendidik · Firestore
              </span>
              {profileLoading ? (
                <span className="text-xs text-slate-500">Memuat...</span>
              ) : isProfileComplete ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Profil Lengkap
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Perlu Dilengkapi
                </span>
              )}
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Profil Saya
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isProfileComplete && profile
                ? `${profile.mataPelajaran} · ${profile.kelas} · ${profile.sekolah}`
                : 'Simpan nama lengkap, NIP, sekolah, mata pelajaran, dan kelas Anda sebagai identitas dokumen administrasi.'}
            </p>
          </div>
          <div>
            <Link
              to="/profil"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>{isProfileComplete ? 'Ubah Profil' : 'Lengkapi Profil'}</span>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">
                Penyimpanan Lokal Browser · BYOK
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium font-mono-tabular ${
                  filledKeys > 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                {filledKeys}/3 Slot Terisi
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Pengaturan Gemini API Key
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {filledKeys > 0
                ? `${filledKeys} slot API key aktif siap digunakan dengan rotasi cadangan otomatis apabila kuota habis.`
                : 'Belum ada API key yang tersimpan di browser Anda. Tambahkan minimal 1 Gemini API Key agar siap digunakan.'}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setApiKeyModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>Kelola API Key</span>
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Menu Administrasi Pembelajaran
          </h2>
          <span className="text-xs font-mono-tabular text-slate-500">
            6 Modul
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                to={mod.path}
                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-teal-600/50 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Icon className="w-5 h-5 text-teal-700 shrink-0" />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition-colors shrink-0" />
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-900">
                    {mod.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {mod.description}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium ${
                    mod.available ? 'text-teal-700' : 'text-slate-500'
                  }`}
                >
                  {mod.available ? 'Tersedia' : 'Segera hadir'}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
