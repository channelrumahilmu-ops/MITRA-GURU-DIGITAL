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
