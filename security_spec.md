# Security Specification & Payload-First TDD

## 1. Data Invariants
1. Dokumen profil pada `/users/{userId}` hanya boleh dibaca (`get`) dan ditulis (`create`, `update`) oleh pengguna terautentikasi yang `request.auth.uid == userId` serta memiliki `email_verified == true`.
2. Operasi `list` pada `/users` ditolak sepenuhnya (`allow list: if false`) untuk mencegah enumerasi PII guru.
3. Field `uid` dan `createdAt` bersifat immutable setelah dokumen dibuat.
4. Timestamp `createdAt` dan `updatedAt` harus menggunakan `request.time` (serverTimestamp), bukan nilai dari klien.
5. Tidak ada field bayangan (shadow fields) atau field role/admin yang boleh disisipkan dari klien.
6. API Key Gemini pengguna tidak boleh pernah disimpan di Firestore.
7. Dokumen pada `/bank_soal/{soalId}` hanya boleh dibaca (`get`, `list`), dibuat (`create`), dan dihapus (`delete`) oleh pemiliknya (`userId == request.auth.uid`).
8. Query `list` pada `/bank_soal` wajib dibatasi secara langsung oleh rule `resource.data.userId == request.auth.uid`.
9. Field `soal` pada `/bank_soal` dibatasi maksimal 100 item (`size() >= 1 && size() <= 100`) dan elemen pertamanya diverifikasi bertipe `map`.

## 2. The "Dirty Dozen" Attack Payloads
1. Unauthenticated read (`request.auth == null`) pada `/users/{uid}` atau `/bank_soal/{id}` -> PERMISSION_DENIED.
2. Cross-user read (`request.auth.uid != userId`) pada `/users/{otherUid}` atau `/bank_soal/{otherDoc}` -> PERMISSION_DENIED.
3. Collection list scraping (`getDocs(collection(db, 'users'))`) -> PERMISSION_DENIED.
4. Unbounded list query (`getDocs(collection(db, 'bank_soal'))` tanpa `where('userId', '==', uid)`) -> PERMISSION_DENIED.
5. Unverified email write (`email_verified == false`) pada `/users/{uid}` atau `/bank_soal/{id}` -> PERMISSION_DENIED.
6. Identity spoofing saat create (`data.uid != request.auth.uid` atau `data.userId != request.auth.uid`) -> PERMISSION_DENIED.
7. Shadow field injection (`isAdmin: true`, `role: 'admin'`) saat create/update -> PERMISSION_DENIED.
8. Oversized string resource poisoning (`namaLengkap` > 120 chars atau `meta.judul` > 200 chars) -> PERMISSION_DENIED.
9. Oversized array / invalid element pada `bank_soal.soal` (`soal: []` atau `soal.size() > 100` atau `soal: ["raw"]`) -> PERMISSION_DENIED.
10. Client-forged timestamp (`createdAt` != `request.time` saat create) -> PERMISSION_DENIED.
11. Immutable `createdAt` atau `uid` tampering saat update -> PERMISSION_DENIED.
12. Invalid document ID path (`soalId` > 128 chars atau karakter terlarang) -> PERMISSION_DENIED.
