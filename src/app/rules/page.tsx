import Link from "next/link";
import { CHARACTERS, GROUP_COLORS, GROUP_NAMES, GROUP_TILES, TILES, WAVE_LABEL } from "@/engine/data";
import { rp } from "@/lib/format";

export const metadata = { title: "Buku Aturan — SerenityPoly" };

export default function RulesPage() {
  const groups = Object.keys(GROUP_TILES) as Array<keyof typeof GROUP_TILES>;
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="sticker -rotate-2 bg-sun text-xs">Panduan Bermain</span>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Buku Aturan SerenityPoly</h1>
        </div>
        <Link href="/" className="btn text-sm">
          ← Kembali ke Menu
        </Link>
      </div>

      <section className="panel mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Aturan Dasar</h2>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-soft">
          <li>• 2–4 pemain. Modal awal Rp 1.500. Gaji lewat GO mulai Rp 200 dan naik tiap gelombang.</li>
          <li>• Lempar 2 dadu, jalankan bidak, selesaikan petak. Angka dobel = lempar lagi; 3× dobel berturut-turut masuk penjara.</li>
          <li>• Petak tanpa pemilik bisa langsung dibeli; menolak membeli memicu lelang terbuka.</li>
          <li>• Keluar penjara: bayar denda (Rp 50 / Rp 100 untuk Bandar), pakai surat bebas, atau coba lempar dobel. Gagal 3× wajib bayar denda.</li>
          <li>• Bangkrut terjadi bila uang tetap kurang setelah seluruh bangunan dijual dan properti digadaikan.</li>
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl font-extrabold">Bangun &amp; Gadai</h2>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-soft">
          <li>• Membangun rumah membutuhkan seluruh kota dalam satu grup warna (monopoli).</li>
          <li>• Aturan <b>even-build</b>: selisih jumlah rumah antar kota dalam satu grup maksimal 1.</li>
          <li>• Stok bank terbatas: 32 rumah dan 12 hotel untuk seluruh papan.</li>
          <li>• Jual bangunan menerima 50% harga bangun. Gadai menerima 50% harga tanah; menebus membayar 110%.</li>
          <li>• Properti yang digadaikan tidak menghasilkan sewa.</li>
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl font-extrabold">4 Gelombang Ekonomi</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border-[2.5px] border-ink">
          <table className="w-full text-left text-sm">
            <thead className="border-b-[2px] border-ink bg-tint">
              <tr>
                <th className="px-3 py-2 font-display">Gelombang</th>
                <th className="px-3 py-2 font-display">Ronde</th>
                <th className="px-3 py-2 font-display">Sewa</th>
                <th className="px-3 py-2 font-display">Aturan Khusus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              <tr>
                <td className="px-3 py-2 font-bold">{WAVE_LABEL[1].charAt(0) + WAVE_LABEL[1].slice(1).toLowerCase()}</td>
                <td className="px-3 py-2 font-mono">1–5</td>
                <td className="px-3 py-2 font-mono">×1</td>
                <td className="px-3 py-2 text-ink-soft">Maks 3 rumah, hotel terkunci</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-bold">{WAVE_LABEL[2].charAt(0) + WAVE_LABEL[2].slice(1).toLowerCase()}</td>
                <td className="px-3 py-2 font-mono">6–11</td>
                <td className="px-3 py-2 font-mono">×1,5</td>
                <td className="px-3 py-2 text-ink-soft">Hotel terbuka, saham &amp; peristiwa aktif</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-bold">{WAVE_LABEL[3].charAt(0) + WAVE_LABEL[3].slice(1).toLowerCase()}</td>
                <td className="px-3 py-2 font-mono">12–15</td>
                <td className="px-3 py-2 font-mono">×2</td>
                <td className="px-3 py-2 text-ink-soft">PBB 5% nilai tanah per ronde</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-bold">{WAVE_LABEL[4].charAt(0) + WAVE_LABEL[4].slice(1).toLowerCase()}</td>
                <td className="px-3 py-2 font-mono">16–17</td>
                <td className="px-3 py-2 font-mono">×2,5</td>
                <td className="px-3 py-2 text-ink-soft">Pinjaman jatuh tempo, sewa puncak</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl font-extrabold">Saham &amp; Pinjaman</h2>
        <ul className="mt-2.5 space-y-1.5 text-sm text-ink-soft">
          <li>• Saham grup dibeli seharga 20% total nilai tanah grup, maksimal satu saham per grup per pemain.</li>
          <li>• Setiap sewa yang dibayar ke pemilik dipotong 10% untuk tiap pemegang saham (maks Rp 150).</li>
          <li>• Pinjaman maksimal Rp 500 (Gelombang I) atau Rp 800, bunga 10% per ronde (15% untuk Arsitek).</li>
        </ul>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl font-extrabold">Karakter</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CHARACTERS.map((c) => (
            <div key={c.id} className="rounded-2xl border-[2.5px] border-ink bg-tint p-3.5">
              <div className="font-display text-base font-extrabold">{c.name}</div>
              <p className="mt-1 text-xs font-bold text-[#0e8a5a]">+ {c.perk}</p>
              <p className="text-xs font-semibold text-tomato">− {c.flaw}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="font-display text-xl font-extrabold">Daftar Kota di Papan</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="flex items-start gap-3 rounded-2xl border-[2.5px] border-ink bg-white p-3">
              <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-ink" style={{ background: GROUP_COLORS[g] }} />
              <div>
                <div className="font-display text-sm font-extrabold">{GROUP_NAMES[g]}</div>
                <div className="text-xs font-medium text-ink-soft">
                  {GROUP_TILES[g].map((id) => `${TILES[id].name} (${rp(TILES[id].price ?? 0)})`).join(" · ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link href="/" className="btn btn-primary mt-6 w-full text-sm">
        ← Kembali ke Menu Utama
      </Link>
    </main>
  );
}
