# SerenityPoly

Papan monopoli **multiplayer 2–4 pemain** bertema seluruh Indonesia, dengan gaya **neobrutalism**.

> Dari Sabang sampai Jayapura — 22 kota, 8 grup warna, 17 ronde, 4 gelombang ekonomi.

![status](https://img.shields.io/badge/status-playable-brightgreen)
![next](https://img.shields.io/badge/Next.js-16-black)
![license](https://img.shields.io/badge/license-MIT-yellow)

**Live: https://serenitypoly.vercel.app**

## Mode

| Mode | Status | Keterangan |
|---|---|---|
| **Solo vs Bot** | ✅ | 1 manusia + 1–3 bot, tanpa internet |
| **Satu Perangkat** | ✅ | 2–4 pemain bergiliran, layar "oper perangkat" |
| **Online** | ✅ | kode room 6 karakter + link/QR, 2–4 pemain jarak jauh |
| **Papan + HP** | ✅ | buka papan di TV/laptop, semua pemain gabung dari HP lewat QR |
| APK / Windows | ⏳ | butuh toolchain Android SDK / Tauri (belum dibangun) |

### Cara main online

1. Menu → **Online** → isi nama → **Buat Room Online**.
2. Bagikan kode 6 karakter atau link/QR ke pemain lain (`/room/KODE`).
3. Semua pemain menekan **Siap**, host menekan **Mulai Game**.
4. Di dalam game, tombol **💬** membuka **Quick Chat** — 8 frasa preset (tanpa chat bebas), muncul 6 detik di papan dan punya jeda kirim 4 detik.
5. Untuk mode papan: Menu → **Papan + HP** → **Buat Papan Tunggu**, tampilkan di TV/laptop, pemain scan QR dari HP.


## Fitur

- **Aturan klasik lengkap** — lelang wajib, even-build, bank 32 rumah/12 hotel, gadai, penjara, bangkrut ke pemain vs bank.
- **Sistem bertumbuh** — 4 gelombang: Rintisan (R1–5) → Pembangunan (R6–11) → Puncak (R12–15) → Krisis (R16–17), dengan sewa, gaji GO, dan timer yang berubah tiap fase.
- **5 karakter** dengan kelebihan & kelemahan (Saudagar, Arsitek, Diplomat, Bandar, Penjelajah).
- **Misi rahasia**, **pinjaman bank**, **bursa saham grup**, **8 peristiwa nasional**, **Pasar Loak** (kartu aksi), **PBB**, **Dana Solidaritas**, **Giliran Emas**.
- **Rincian perhitungan sewa** transparan (dasar × bangunan × gelombang × peristiwa − dividen − karakter).
- **Bot** yang membeli, membangun, menawar lelang, dan berdagang.
- **4 preset**: Pemula, Klasik, Standar, Penuh.
- **Neobrutalism**: border tebal, hard shadow, tipografi Archivo Black + Space Grotesk + Space Mono.
- **Audio ringan** (WebAudio, tanpa aset), mute 1 klik, tersimpan.
- **Quick Chat online** preset-only: pesan singkat, toast 6 detik, jeda 4 detik, disimpan di DB dengan batas 12 jam.
- Responsif: papan pinch-friendly di HP, tanpa scroll horizontal pada 375 px.

## Keamanan online

- **Identitas kursi** = `playerId` + `token` acak (crypto) + `reconnectKey` terpisah. Token hanya bisa dipulihkan dengan `reconnectKey`, jadi mengetahui id kursi saja tidak cukup untuk membajaknya.
- **Host-only** untuk mulai, rematch, dan tambah/hapus bot. Rematch hanya boleh saat game benar-benar selesai; start memakai klaim atomik agar tidak ada dua game untuk satu room.
- **Redaksi state**: `rng`/`seed`, misi, dan isi kartu tangan pemain lain tidak pernah dikirim ke klien. Klien hanya menerima data privatnya sendiri.
- **Rate limit di DB** (lintas instance serverless): buat room, percobaan reconnect, quick chat.
- Tanpa `DATABASE_URL`, server menolak melayani room (tidak ada fallback diam-diam ke memori yang menyamarkan error DB).

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # produksi
npm start
```

## Verifikasi

```bash
npx tsx scripts/sim.ts 300        # 300 game bot, cek invariant ekonomi & bangunan (exit 1 bila ada error)
npx tsx scripts/feature-test.ts   # 65 tes aturan (bangun, sewa, saham, pinjaman, trade, PBB, krisis, bangkrut)
node scripts/online-test.mjs http://localhost:3000   # E2E API online (room, join, siap, mulai, auth, redaksi, chat)
npm run typecheck
npm run build
```

Hasil terakhir: **300/300 game selesai tanpa error invariant**, **65/65 tes aturan lulus**, **E2E online lulus** (termasuk penolakan klaim kursi tanpa kunci, start/rematch tanpa host, aksi di luar giliran, token salah, redaksi RNG/misi, dan quick chat preset-only + rate limit).

## Arsitektur online

- **Neon Postgres** (`ap-southeast-1`, Singapore) menyimpan room, state game, chat, dan hitungan rate limit sebagai JSONB.
- Aksi dikirim ke `/api/games/[code]`, divalidasi giliran + token kursi, lalu disimpan dengan pengunci versi.
- Klien polling ~1,3 detik (`?since=versi`) — cukup untuk game giliran dan jauh lebih murah dari WebSocket. Poll langsung dipercepat saat tab kembali aktif.
- Papan besar (TV) membaca state yang sama tanpa panel privat, dan boleh menggerakkan bot lewat `hostToken`.
- Quick chat lewat `/api/chats/[code]`: hanya 8 frasa preset, rate limit 4 detik per kursi dihitung dari DB, pesan lama dibersihkan otomatis setelah 12 jam.

## Papan

| Grup | Kota |
|---|---|
| Cokelat | Sabang, Banda Aceh |
| Biru Muda | Medan, Padang, Pekanbaru |
| Pink | Palembang, Bengkulu, Bandar Lampung |
| Oranye | Bogor, Bandung, Semarang |
| Merah | Yogyakarta, Solo, Surabaya |
| Kuning | Malang, Denpasar, Mataram |
| Hijau | Balikpapan, Samarinda, Makassar |
| Biru Tua | Manado, Jayapura |

Transportasi: TransJakarta, KRL, MRT Jakarta, Kapal Pelni. Utilitas: PLN, PDAM.

## Struktur

```
src/engine/         aturan murni (deterministik, tanpa DOM)
src/components/     papan, panel, dialog, UI kit, online game
src/app/            halaman + API route (rooms, games)
src/lib/            db/online helper, format, audio
scripts/            simulasi bot, tes aturan, E2E online, init DB
```

## Lisensi

MIT untuk kode. Aset SVG orisinal CC BY 4.0. Font: Archivo Black, Space Grotesk, Space Mono (OFL).

Nama dan artwork orisinal — tidak memakai materi Hasbro.
