# SerenityPoly Design Theme — Soft Pop Neo-Brutalism (Dudul Bansos Style)

Tema visual resmi yang disimpan untuk seluruh proyek ini terinspirasi dari **https://bansos.dudul.dev/#usage**, yaitu gaya **Soft Pop Neo-Brutalism / Playful Sticker Bento UI**.

## Ciri Khas & Aturan Desain

1. **Tipografi**
   - **Display (`--font-display`)**: `Bricolage Grotesque` (weight `800`, `font-variation-settings: "opsz" 96`) dengan letter-spacing rapat (`-0.5px` hingga `-3px`).
   - **Body & UI (`--font-body`)**: `DM Sans` (`400`, `500`, `600`, `700`, `800`).
   - **Angka, Uang, Kode (`--font-mono`)**: `JetBrains Mono` (`tabular-nums`).
   - **Gaya Penulisan**: Gunakan **Sentence case** yang ramah dan jelas pada judul, kartu, tombol, dan penjelasan. Huruf kapital semua (`uppercase tracking-[1.5px]`) hanya dipakai pada label kecil (*eyebrow*) atau tag status singkat.

2. **Palet Warna**
   - **Background Utama**: `#FFFFFF` (`--color-bg`) & Tint Bento `#F2F5FF` (`--color-tint`)
   - **Ink / Border**: `#16142B` (`--color-ink`), Soft Ink `#55536E` (`--color-ink-soft`)
   - **Tomato (Aksi Utama / Highlight)**: `#FF5A3C` & pale `#FFE4DD`
   - **Sun (Energi / Poin / Stiker)**: `#FFD23F` & pale `#FFF4C7`
   - **Electric Blue (Info / Sekunder / Papan)**: `#2F5BFF` & pale `#DFE6FF`
   - **Mint (Sukses / Aktif / Online)**: `#2FD592` & pale `#D5F7E8`
   - **Divider**: `rgba(22, 20, 43, 0.12)`

3. **Bentuk, Border & Bayangan**
   - **Tanpa drop-shadow kotak hitam kasar (`6px 6px 0 #000`)**.
   - Pakai border tebal bersih `border-[2.5px]` atau `border-[3px] border-ink`.
   - Sudut membulat besar (*squircle*): `rounded-[22px]` – `rounded-[28px]` pada kartu/panel, `rounded-2xl` pada sub-kartu dan input, dan `rounded-full` pada tombol, pill, serta badge status.
   - Aksen stiker miring (`-rotate-2`, `rotate-2`, `rounded-[10px]` / `rounded-xl`) untuk lencana penting seperti fase gelombang, label unggulan, atau pengumuman.

4. **Animasi**
   - Kurva halus `--ease-out-soft: cubic-bezier(0.2, 0.8, 0.2, 1)`.
   - Hover tombol: naik halus `-1px` / brightness ringan; klik: `scale(0.97)`.
   - Kemunculan dialog/elemen: `pop`, `rise`, `stamp`, `pulse-dot`, dan lompatan bidak `token-arc`.
