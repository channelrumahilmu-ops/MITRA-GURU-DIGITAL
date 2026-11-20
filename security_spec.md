# Security Specification & Payload-First TDD

## 1. Data Invariants
1. Dokumen profil pada `/users/{userId}` hanya boleh dibaca (`get`) dan ditulis (`create`, `update`) oleh pengguna terautentikasi yang `request.auth.uid == userId` serta memiliki `email_verified == true`.
2. Operasi `list` pada `/users` ditolak sepenuhnya (`allow list: if false`) untuk mencegah enumerasi PII guru.
3. Field `uid` dan `createdAt` bersifat immutable setelah dokumen dibuat.
4. Timestamp `createdAt` dan `updatedAt` harus menggunakan `request.time` (serverTimestamp), bukan nilai dari klien.
5. Tidak ada field bayangan (shadow fields) atau field role/admin yang boleh disisipkan dari klien.
6. API Key Gemini pengguna tidak boleh pernah disimpan di Firestore.

## 2. The "Dirty Dozen" Attack Payloads
1. Unauthenticated read (`request.auth == null`) pada `/users/{uid}` -> PERMISSION_DENIED.
2. Cross-user read (`request.auth.uid != userId`) pada `/users/{otherUid}` -> PERMISSION_DENIED.
3. Collection list scraping (`getDocs(collection(db, 'users'))`) -> PERMISSION_DENIED.
4. Unverified email write (`email_verified == false`) pada `/users/{uid}` -> PERMISSION_DENIED.
5. Identity spoofing saat create (`data.uid != request.auth.uid`) -> PERMISSION_DENIED.
6. Shadow field injection (`isAdmin: true`, `role: 'admin'`) saat create/update -> PERMISSION_DENIED.
7. Oversized string resource poisoning (`namaLengkap` > 120 chars atau `sekolah` > 150 chars) -> PERMISSION_DENIED.
8. Invalid NIP pattern (`nip: "<script>alert(1)</script>"`) -> PERMISSION_DENIED.
9. Client-forged timestamp (`createdAt` != `request.time` saat create) -> PERMISSION_DENIED.
10. Immutable `createdAt` tampering saat update -> PERMISSION_DENIED.
11. Immutable `uid` tampering saat update -> PERMISSION_DENIED.
12. Invalid document ID path (`userId` > 128 chars atau karakter terlarang) -> PERMISSION_DENIED.
