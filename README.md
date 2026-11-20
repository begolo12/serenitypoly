# SerenityPoly

Papan monopoli **multiplayer 2–4 pemain** bertema seluruh Indonesia, dengan gaya **neobrutalism**.

> Dari Sabang sampai Jayapura — 22 kota, 8 grup warna, 17 ronde, 4 gelombang ekonomi.

![status](https://img.shields.io/badge/status-playable-brightgreen)
![next](https://img.shields.io/badge/Next.js-16-black)
![license](https://img.shields.io/badge/license-MIT-yellow)

## Mode yang tersedia

| Mode | Status | Keterangan |
|---|---|---|
| **Solo vs Bot** | ✅ | 1 manusia + 1–3 bot, tanpa internet |
| **Satu Perangkat** | ✅ | 2–4 pemain bergiliran, layar "oper perangkat" |
| Papan + HP (kontroler QR) | ⏳ | butuh server online |
| Online jarak jauh | ⏳ | butuh Neon + deploy |

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
- Responsif: papan pinch-friendly di HP, tanpa scroll horizontal pada 390 px.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # produksi
npm start
```

## Verifikasi

```bash
npx tsx scripts/sim.ts 300        # 300 game bot, cek invariant ekonomi & bangunan
npx tsx scripts/feature-test.ts   # 27 tes aturan (bangun, sewa, saham, pinjaman, trade, PBB, krisis)
npm run typecheck
npm run build
```

Hasil terakhir: **300/300 game selesai tanpa error invariant**, **27/27 tes aturan lulus**.

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
src/components/     papan, panel, dialog, UI kit
src/app/            halaman Next.js (menu, play, rules)
scripts/            simulasi bot + tes aturan
```

## Lisensi

MIT untuk kode. Aset SVG orisinal CC BY 4.0. Font: Archivo Black, Space Grotesk, Space Mono (OFL).

Nama dan artwork orisinal — tidak memakai materi Hasbro.
