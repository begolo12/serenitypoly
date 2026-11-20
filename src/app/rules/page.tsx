import Link from "next/link";
import { CHARACTERS, GROUP_COLORS, GROUP_NAMES, GROUP_TILES, TILES, WAVE_LABEL } from "@/engine/data";
import { rp } from "@/lib/format";

export const metadata = { title: "Buku Aturan — SerenityPoly" };

export default function RulesPage() {
  const groups = Object.keys(GROUP_TILES) as Array<keyof typeof GROUP_TILES>;
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl uppercase leading-none">Buku Aturan</h1>
        <Link href="/" className="btn text-xs">
          ← Menu
        </Link>
      </div>

      <section className="panel mt-4 p-4">
        <h2 className="font-display text-lg uppercase">Dasar</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>2–4 pemain. Modal awal Rp 1.500. Gaji lewat GO Rp 200 (naik tiap gelombang).</li>
          <li>Lempar 2 dadu, jalan, selesaikan petak. Dobel = lempar lagi; tiga dobel berturut-turut masuk penjara.</li>
          <li>Petak tanpa pemilik bisa dibeli; menolak membeli memicu lelang terbuka.</li>
          <li>Penjara: bayar Rp 50, pakai surat, atau coba dobel. Gagal tiga kali wajib bayar.</li>
          <li>Bangkrut jika tidak mampu membayar setelah menjual bangunan dan menggadaikan properti.</li>
        </ul>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Bangun & gadai</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Bangun butuh seluruh grup warna. Even-build: selisih rumah antar petak satu grup maksimal 1.</li>
          <li>Bank terbatas: 32 rumah dan 12 hotel untuk seluruh permainan.</li>
          <li>Jual bangunan menerima 50% harga. Gadai menerima 50% harga tanah; tebus membayar 110%.</li>
          <li>Properti tergadai tidak menghasilkan sewa.</li>
        </ul>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Gelombang ekonomi</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-[3px] border-ink text-left text-xs">
            <thead className="bg-muted uppercase">
              <tr>
                <th className="border-b-2 border-ink px-2 py-1">Gelombang</th>
                <th className="border-b-2 border-ink px-2 py-1">Ronde</th>
                <th className="border-b-2 border-ink px-2 py-1">Sewa</th>
                <th className="border-b-2 border-ink px-2 py-1">Aturan khusus</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-ink/20 px-2 py-1 font-bold">{WAVE_LABEL[1]}</td>
                <td className="border-b border-ink/20 px-2 py-1">1–5</td>
                <td className="border-b border-ink/20 px-2 py-1">×1</td>
                <td className="border-b border-ink/20 px-2 py-1">Maks 3 rumah, hotel terkunci</td>
              </tr>
              <tr>
                <td className="border-b border-ink/20 px-2 py-1 font-bold">{WAVE_LABEL[2]}</td>
                <td className="border-b border-ink/20 px-2 py-1">6–11</td>
                <td className="border-b border-ink/20 px-2 py-1">×1,5</td>
                <td className="border-b border-ink/20 px-2 py-1">Hotel terbuka, saham & peristiwa aktif</td>
              </tr>
              <tr>
                <td className="border-b border-ink/20 px-2 py-1 font-bold">{WAVE_LABEL[3]}</td>
                <td className="border-b border-ink/20 px-2 py-1">12–15</td>
                <td className="border-b border-ink/20 px-2 py-1">×2</td>
                <td className="border-b border-ink/20 px-2 py-1">PBB 5% nilai tanah per ronde</td>
              </tr>
              <tr>
                <td className="px-2 py-1 font-bold">{WAVE_LABEL[4]}</td>
                <td className="px-2 py-1">16–17</td>
                <td className="px-2 py-1">×2,5</td>
                <td className="px-2 py-1">Pinjaman jatuh tempo, bangun dilarang</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Saham & pinjaman</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Saham grup dibeli seharga 20% total nilai tanah grup, maksimal satu per grup.</li>
          <li>Setiap sewa yang dibayar ke pemilik dipotong 10% untuk tiap pemegang saham (maks Rp 150).</li>
          <li>Pinjaman maksimal Rp 500 (Gelombang I) atau Rp 800, bunga 10% per ronde.</li>
          <li>Gagal bayar bunga memicu penjualan bangunan, gadai, lalu bangkrut.</li>
        </ul>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Karakter</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CHARACTERS.map((c) => (
            <div key={c.id} className="border-[3px] border-ink p-2">
              <div className="font-display text-sm uppercase">{c.name}</div>
              <p className="text-xs font-bold text-[#0a7a4a]">+ {c.perk}</p>
              <p className="text-xs font-bold text-red">− {c.flaw}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Papan</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="flex items-start gap-2 border-[3px] border-ink p-2">
              <span className="mt-1 h-5 w-5 shrink-0 border-2 border-ink" style={{ background: GROUP_COLORS[g] }} />
              <div>
                <div className="font-display text-xs uppercase">{GROUP_NAMES[g]}</div>
                <div className="text-[11px] font-bold opacity-70">
                  {GROUP_TILES[g].map((id) => `${TILES[id].name} (${rp(TILES[id].price ?? 0)})`).join(" · ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel mt-3 p-4">
        <h2 className="font-display text-lg uppercase">Menang</h2>
        <p className="mt-1 text-sm">
          Menang jika menjadi satu-satunya pemain yang tersisa. Jika Ronde 17 selesai, skor dihitung dari cash + nilai aset +
          200 per grup + 200 per misi − utang.
        </p>
      </section>

      <Link href="/" className="btn mt-6 w-full text-sm">
        ← Kembali ke menu
      </Link>
    </main>
  );
}
