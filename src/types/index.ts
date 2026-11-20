export interface UserProfile {
  uid: string;
  email: string;
  namaLengkap: string;
  nip: string;
  sekolah: string;
  mataPelajaran: string;
  kelas: string;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProfileFormValues {
  namaLengkap: string;
  nip: string;
  sekolah: string;
  mataPelajaran: string;
  kelas: string;
}

export type ApiKeySlots = [string, string, string];

/**
 * Batas validasi yang disinkronkan persis dengan firebase-blueprint.json dan firestore.rules
 */
export const PROFILE_VALIDATION = {
  namaLengkap: {
    minLength: 1,
    maxLength: 120,
  },
  nip: {
    minLength: 0,
    maxLength: 30,
    pattern: /^[0-9\s\-]*$/,
  },
  sekolah: {
    minLength: 1,
    maxLength: 150,
  },
  mataPelajaran: {
    minLength: 1,
    maxLength: 100,
  },
  kelas: {
    minLength: 1,
    maxLength: 60,
  },
  email: {
    minLength: 3,
    maxLength: 254,
  },
  photoURL: {
    maxLength: 500,
  },
} as const;

export type BentukSoal =
  | 'Pilihan Ganda'
  | 'PG Kompleks'
  | 'Benar/Salah'
  | 'Menjodohkan'
  | 'Isian Singkat'
  | 'Esai';

export type LevelKognitif = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6';

export interface ExamIdentity {
  judulUjian: string;
  namaSekolah: string;
  namaGuru: string;
  tahunAjaran: string;
  alokasiWaktu: string;
  mataPelajaran: string;
  fase: string;
  kelas: string;
  topikUtama: string;
}

export interface QuestionSectionItem {
  id: string;
  bentukSoal: BentukSoal;
  jumlahOpsi: number;
  gunakanStimulus: boolean;
  distribusiKesulitan: {
    mudah: number;
    sedang: number;
    sulit: number;
  };
  targetKognitif: LevelKognitif[];
}

export interface GeneratedSoalOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  E?: string;
}

export interface GeneratedSoalItem {
  no: number;
  tipe: string;
  stimulus: string;
  pertanyaan: string;
  opsi?: GeneratedSoalOptions;
  kunci: string;
  pembahasan: string;
  indikator: string;
  level_kognitif: string;
  kesulitan: string;
}

export interface GeneratedExamMeta {
  judul: string;
  sekolah: string;
  mapel: string;
  kelas: string;
}

export interface GeneratedExamResult {
  meta: GeneratedExamMeta;
  soal: GeneratedSoalItem[];
}
