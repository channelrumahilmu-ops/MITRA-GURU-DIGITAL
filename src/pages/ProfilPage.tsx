import { useEffect, useState, type FormEvent } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PROFILE_VALIDATION, type ProfileFormValues } from '../types';

type FieldErrors = Partial<Record<keyof ProfileFormValues, string>>;

const EMPTY_FORM: ProfileFormValues = {
  namaLengkap: '',
  nip: '',
  sekolah: '',
  mataPelajaran: '',
  kelas: '',
};

export function ProfilPage() {
  const { user, refreshProfile } = useAuth();
  const [form, setForm] = useState<ProfileFormValues>(EMPTY_FORM);
  const [hasExistingDoc, setHasExistingDoc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user) return;
      setLoading(true);
      setSubmitError(null);
      const docPath = `users/${user.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!active) return;

        if (snap.exists()) {
          const data = snap.data();
          setHasExistingDoc(true);
          setForm({
            namaLengkap: typeof data.namaLengkap === 'string' ? data.namaLengkap : '',
            nip: typeof data.nip === 'string' ? data.nip : '',
            sekolah: typeof data.sekolah === 'string' ? data.sekolah : '',
            mataPelajaran:
              typeof data.mataPelajaran === 'string' ? data.mataPelajaran : '',
            kelas: typeof data.kelas === 'string' ? data.kelas : '',
          });
        } else {
          setHasExistingDoc(false);
          setForm({
            ...EMPTY_FORM,
            namaLengkap: user.displayName ?? '',
          });
        }
      } catch (error) {
        if (!active) return;
        try {
          handleFirestoreError(error, OperationType.GET, docPath);
        } catch (err) {
          setSubmitError(
            err instanceof Error ? err.message : 'Gagal memuat profil pengguna.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  const validate = (values: ProfileFormValues): FieldErrors => {
    const errors: FieldErrors = {};
    const nama = values.namaLengkap.trim();
    const nip = values.nip.trim();
    const sekolah = values.sekolah.trim();
    const mapel = values.mataPelajaran.trim();
    const kelas = values.kelas.trim();

    if (nama.length < PROFILE_VALIDATION.namaLengkap.minLength) {
      errors.namaLengkap = 'Nama lengkap wajib diisi.';
    } else if (nama.length > PROFILE_VALIDATION.namaLengkap.maxLength) {
      errors.namaLengkap = `Maksimal ${PROFILE_VALIDATION.namaLengkap.maxLength} karakter.`;
    }

    if (nip.length > PROFILE_VALIDATION.nip.maxLength) {
      errors.nip = `Maksimal ${PROFILE_VALIDATION.nip.maxLength} karakter.`;
    } else if (!PROFILE_VALIDATION.nip.pattern.test(nip)) {
      errors.nip = 'NIP hanya boleh berisi angka, spasi, atau tanda hubung (-).';
    }

    if (sekolah.length < PROFILE_VALIDATION.sekolah.minLength) {
      errors.sekolah = 'Nama sekolah wajib diisi.';
    } else if (sekolah.length > PROFILE_VALIDATION.sekolah.maxLength) {
      errors.sekolah = `Maksimal ${PROFILE_VALIDATION.sekolah.maxLength} karakter.`;
    }

    if (mapel.length < PROFILE_VALIDATION.mataPelajaran.minLength) {
      errors.mataPelajaran = 'Mata pelajaran wajib diisi.';
    } else if (mapel.length > PROFILE_VALIDATION.mataPelajaran.maxLength) {
      errors.mataPelajaran = `Maksimal ${PROFILE_VALIDATION.mataPelajaran.maxLength} karakter.`;
    }

    if (kelas.length < PROFILE_VALIDATION.kelas.minLength) {
      errors.kelas = 'Kelas wajib diisi.';
    } else if (kelas.length > PROFILE_VALIDATION.kelas.maxLength) {
      errors.kelas = `Maksimal ${PROFILE_VALIDATION.kelas.maxLength} karakter.`;
    }

    return errors;
  };

  const handleChange = (field: keyof ProfileFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const docPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const cleanedEmail = (user.email ?? 'guru@example.com').slice(
      0,
      PROFILE_VALIDATION.email.maxLength
    );
    const cleanedPhoto = user.photoURL
      ? user.photoURL.slice(0, PROFILE_VALIDATION.photoURL.maxLength)
      : undefined;

    try {
      if (hasExistingDoc) {
        await updateDoc(userRef, {
          namaLengkap: form.namaLengkap.trim(),
          nip: form.nip.trim(),
          sekolah: form.sekolah.trim(),
          mataPelajaran: form.mataPelajaran.trim(),
          kelas: form.kelas.trim(),
          email: cleanedEmail,
          ...(cleanedPhoto ? { photoURL: cleanedPhoto } : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          email: cleanedEmail,
          namaLengkap: form.namaLengkap.trim(),
          nip: form.nip.trim(),
          sekolah: form.sekolah.trim(),
          mataPelajaran: form.mataPelajaran.trim(),
          kelas: form.kelas.trim(),
          ...(cleanedPhoto ? { photoURL: cleanedPhoto } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setHasExistingDoc(true);
      }

      await refreshProfile();
      setSubmitSuccess('Profil berhasil disimpan ke Cloud Firestore.');
    } catch (error) {
      try {
        handleFirestoreError(
          error,
          hasExistingDoc ? OperationType.UPDATE : OperationType.CREATE,
          docPath
        );
      } catch {
        setSubmitError(
          'Gagal menyimpan profil. Pastikan akun Anda terverifikasi dan data sesuai batas panjang.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Profil Saya
        </h1>
        <p className="text-sm text-slate-600">
          Lengkapi identitas pendidik Anda. Data ini tersimpan aman pada koleksi pribadi Anda di Cloud Firestore.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="space-y-5 animate-pulse">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-10 w-full bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="namaLengkap"
                className="block text-sm font-medium text-slate-900"
              >
                Nama Lengkap <span className="text-red-600">*</span>
              </label>
              <input
                id="namaLengkap"
                type="text"
                required
                maxLength={PROFILE_VALIDATION.namaLengkap.maxLength}
                value={form.namaLengkap}
                onChange={(e) => handleChange('namaLengkap', e.target.value)}
                placeholder="Contoh: Budi Santoso, S.Pd."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
              />
              {fieldErrors.namaLengkap && (
                <p className="text-xs text-red-700">{fieldErrors.namaLengkap}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="nip"
                className="block text-sm font-medium text-slate-900"
              >
                NIP
              </label>
              <input
                id="nip"
                type="text"
                maxLength={PROFILE_VALIDATION.nip.maxLength}
                value={form.nip}
                onChange={(e) => handleChange('nip', e.target.value)}
                placeholder="Contoh: 19850412 201001 1 012 (kosongkan jika tidak ada)"
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
              />
              {fieldErrors.nip && (
                <p className="text-xs text-red-700">{fieldErrors.nip}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="sekolah"
                className="block text-sm font-medium text-slate-900"
              >
                Sekolah <span className="text-red-600">*</span>
              </label>
              <input
                id="sekolah"
                type="text"
                required
                maxLength={PROFILE_VALIDATION.sekolah.maxLength}
                value={form.sekolah}
                onChange={(e) => handleChange('sekolah', e.target.value)}
                placeholder="Contoh: SMP Negeri 1 Bandung"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
              />
              {fieldErrors.sekolah && (
                <p className="text-xs text-red-700">{fieldErrors.sekolah}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  required
                  maxLength={PROFILE_VALIDATION.mataPelajaran.maxLength}
                  value={form.mataPelajaran}
                  onChange={(e) => handleChange('mataPelajaran', e.target.value)}
                  placeholder="Contoh: Ilmu Pengetahuan Alam"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
                />
                {fieldErrors.mataPelajaran && (
                  <p className="text-xs text-red-700">
                    {fieldErrors.mataPelajaran}
                  </p>
                )}
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
                  required
                  maxLength={PROFILE_VALIDATION.kelas.maxLength}
                  value={form.kelas}
                  onChange={(e) => handleChange('kelas', e.target.value)}
                  placeholder="Contoh: VII / VIII / Fase D"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition-colors"
                />
                {fieldErrors.kelas && (
                  <p className="text-xs text-red-700">{fieldErrors.kelas}</p>
                )}
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {submitSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 shrink-0" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Profil'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
