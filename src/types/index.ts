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

export interface BankSoalRecord {
  id: string;
  userId: string;
  createdAt?: unknown;
  meta: GeneratedExamMeta;
  soal: GeneratedSoalItem[];
}

export const BANK_SOAL_LIMITS = {
  meta: {
    judulMaxLength: 200,
    sekolahMaxLength: 200,
    mapelMaxLength: 150,
    kelasMaxLength: 100,
  },
  maxSoalCount: 100,
  pertanyaanMaxLength: 10000,
} as const;

export interface ModulAjarFormValues {
  satuanPendidikan: string;
  mataPelajaran: string;
  kelasSemester: string;
  fase: string;
  alokasiWaktu: string;
  jumlahPertemuan: string;
  penyusun: string;
  capaianPembelajaran: string;
  topikMateri: string;
  tujuanPembelajaran: string;
  karakteristikMurid: string;
  dimensiProfilLulusan: string[];
  modelPembelajaran: string;
  metodePembelajaran: string[];
  asesmen: string;
}

export interface GeneratedModulAjarResult {
  judul_modul: string;
  identitas: {
    satuan_pendidikan: string;
    mata_pelajaran: string;
    kelas_semester: string;
    fase: string;
    alokasi_waktu: string;
    jumlah_pertemuan: string;
    penyusun: string;
  };
  analisis_pembelajaran: {
    capaian_pembelajaran: string;
    topik_materi: string;
    tujuan_pembelajaran: string[];
    karakteristik_murid: string;
  };
  desain_pembelajaran: {
    dimensi_profil_lulusan: string[];
    model_pembelajaran: string;
    metode_pembelajaran: string[];
  };
  pengalaman_belajar: {
    pendahuluan: string[];
    kegiatan_inti: string[];
    penutup: string[];
  };
  asesmen: {
    jenis: string;
    bentuk_instrumen: string;
  };
}

export const BANK_MODUL_LIMITS = {
  judulMaxLength: 250,
  identitas: {
    satuanPendidikanMaxLength: 200,
    mataPelajaranMaxLength: 150,
    kelasSemesterMaxLength: 100,
    faseMaxLength: 50,
    alokasiWaktuMaxLength: 120,
    jumlahPertemuanMaxLength: 100,
    penyusunMaxLength: 150,
  },
  analisis: {
    capaianMaxLength: 5000,
    topikMaxLength: 500,
    tujuanMaxItems: 30,
    karakteristikMaxLength: 3000,
  },
  desain: {
    dimensiMaxItems: 10,
    modelMaxLength: 150,
    metodeMaxItems: 20,
  },
  pengalaman: {
    pendahuluanMaxItems: 30,
    kegiatanIntiMaxItems: 50,
    penutupMaxItems: 30,
  },
  asesmen: {
    jenisMaxLength: 100,
    instrumenMaxLength: 5000,
  },
  itemStringMaxLength: 3000,
} as const;

export interface LkpdFormValues {
  judulLkpd: string;
  satuanPendidikan: string;
  mataPelajaran: string;
  kelasSemester: string;
  topikMateri: string;
  tujuanPembelajaran: string;
  jenisKegiatan: string;
  jumlahKegiatan: number;
  durasiPengerjaan: string;
  diferensiasi: string;
  catatanTambahan: string;
}

export interface GeneratedLkpdKegiatan {
  judul_kegiatan: string;
  langkah_kerja: string[];
  tabel_data?: string;
}

export interface GeneratedLkpdRubrikItem {
  aspek: string;
  indikator: string;
  skor_maksimal: number;
}

export interface GeneratedLkpdResult {
  judul: string;
  identitas: {
    sekolah: string;
    mata_pelajaran: string;
    kelas: string;
    topik: string;
    tujuan: string;
  };
  petunjuk_umum: string;
  kegiatan: GeneratedLkpdKegiatan[];
  rubrik_penilaian: GeneratedLkpdRubrikItem[];
}


