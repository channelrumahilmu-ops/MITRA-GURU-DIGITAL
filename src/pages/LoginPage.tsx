import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertCircle, BookOpenCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, authReady, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (authReady && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Gagal masuk dengan Google.';
      if (msg.includes('popup-closed-by-user')) {
        setErrorMessage('Jendela login ditutup sebelum proses selesai.');
      } else if (msg.includes('popup-blocked')) {
        setErrorMessage(
          'Browser memblokir jendela pop-up. Izinkan pop-up untuk melanjutkan login.'
        );
      } else {
        setErrorMessage('Gagal masuk dengan akun Google. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-teal-700">
            <BookOpenCheck className="w-5 h-5 shrink-0" />
            <span className="font-display text-sm font-semibold tracking-tight">
              RuangGuru Digital
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Masuk ke Ruang Kerja Guru
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Kelola profil pendidik, perangkat administrasi pembelajaran, dan pengaturan Gemini API Key pribadi Anda dalam satu tempat.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting || !authReady}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg
            aria-hidden="true"
            className="w-5 h-5 shrink-0"
            viewBox="0 0 24 24"
          >
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          <span>{submitting ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
        </button>

        <p className="text-xs text-slate-500 text-center leading-relaxed">
          Gunakan akun Google pribadi atau akun Belajar.id Anda untuk masuk secara aman.
        </p>
      </div>
    </div>
  );
}
