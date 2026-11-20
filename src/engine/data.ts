import type {
  CardDef,
  CharacterDef,
  EventDef,
  GroupId,
  MissionDef,
  Preset,
  ShopCardDef,
  Tile,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

export const GROUP_COLORS: Record<GroupId, string> = {
  brown: "#B67C52",
  lightblue: "#66CCFF",
  pink: "#FF78C4",
  orange: "#FF9240",
  red: "#FF5A3C",
  yellow: "#FFD23F",
  green: "#2FD592",
  darkblue: "#2F5BFF",
};

export const GROUP_NAMES: Record<GroupId, string> = {
  brown: "Cokelat",
  lightblue: "Biru Muda",
  pink: "Pink",
  orange: "Oranye",
  red: "Merah",
  yellow: "Kuning",
  green: "Hijau",
  darkblue: "Biru Tua",
};

export const PLAYER_COLORS = ["#FF5A3C", "#2F5BFF", "#FFD23F", "#2FD592"];

export const TOKENS = ["🛺", "🛵", "⛵", "🚆", "🚲", "🚚", "🐴", "🚌"];

const R = {
  r60: [2, 10, 30, 90, 160, 250],
  r100: [6, 30, 90, 270, 400, 550],
  r120: [8, 40, 100, 300, 450, 600],
  r140: [10, 50, 150, 450, 625, 750],
  r160: [12, 60, 180, 500, 700, 900],
  r180: [14, 70, 200, 550, 750, 950],
  r200: [16, 80, 220, 600, 800, 1000],
  r220: [18, 90, 250, 700, 875, 1050],
  r240: [20, 100, 300, 750, 925, 1100],
  r260: [22, 110, 330, 800, 975, 1150],
  r280: [24, 120, 360, 850, 1025, 1200],
  r300: [26, 130, 390, 900, 1100, 1275],
  r320: [28, 150, 450, 1000, 1200, 1400],
  r350: [35, 175, 500, 1100, 1300, 1500],
  r400: [50, 200, 600, 1400, 1700, 2000],
};

function prop(
  id: number,
  name: string,
  short: string,
  group: GroupId,
  price: number,
  rents: number[],
  houseCost: number,
  icon: string,
): Tile {
  return { id, type: "property", name, short, group, price, rents, houseCost, icon };
}

export const TILES: Tile[] = [
  { id: 0, type: "go", name: "GO", short: "GO", icon: "🏁" },
  prop(1, "Sabang", "Sabang", "brown", 60, R.r60, 50, "🌊"),
  { id: 2, type: "community", name: "Dana Umum", short: "Dana", icon: "🎁" },
  prop(3, "Banda Aceh", "B.Aceh", "brown", 60, R.r60, 50, "🕌"),
  { id: 4, type: "tax", name: "PBB", short: "PBB", icon: "🧾", tax: 200 },
  { id: 5, type: "transport", name: "TransJakarta", short: "TransJkt", icon: "🚌", price: 200 },
  prop(6, "Medan", "Medan", "lightblue", 100, R.r100, 50, "🏙️"),
  { id: 7, type: "chance", name: "Kesempatan", short: "Kesempatan", icon: "❓" },
  prop(8, "Padang", "Padang", "lightblue", 100, R.r100, 50, "🍜"),
  prop(9, "Pekanbaru", "Pekanbaru", "lightblue", 120, R.r120, 50, "🏢"),
  { id: 10, type: "jail", name: "Penjara", short: "Penjara", icon: "🚔" },
  prop(11, "Palembang", "Palembang", "pink", 140, R.r140, 100, "🌉"),
  { id: 12, type: "utility", name: "PLN", short: "PLN", icon: "⚡", price: 150 },
  prop(13, "Bengkulu", "Bengkulu", "pink", 140, R.r140, 100, "🌺"),
  prop(14, "Bandar Lampung", "Lampung", "pink", 160, R.r160, 100, "⚓"),
  { id: 15, type: "transport", name: "KRL Commuter", short: "KRL", icon: "🚆", price: 200 },
  prop(16, "Bogor", "Bogor", "orange", 180, R.r180, 100, "🌿"),
  { id: 17, type: "community", name: "Dana Umum", short: "Dana", icon: "🎁" },
  prop(18, "Bandung", "Bandung", "orange", 180, R.r180, 100, "🎨"),
  prop(19, "Semarang", "Semarang", "orange", 200, R.r200, 100, "🏛️"),
  { id: 20, type: "free", name: "Parkir Gratis", short: "Parkir", icon: "🅿️" },
  prop(21, "Yogyakarta", "Jogja", "red", 220, R.r220, 150, "🛕"),
  { id: 22, type: "chance", name: "Kesempatan", short: "Kesempatan", icon: "❓" },
  prop(23, "Solo", "Solo", "red", 220, R.r220, 150, "🧵"),
  prop(24, "Surabaya", "Surabaya", "red", 240, R.r240, 150, "🦈"),
  { id: 25, type: "transport", name: "MRT Jakarta", short: "MRT", icon: "🚇", price: 200 },
  prop(26, "Malang", "Malang", "yellow", 260, R.r260, 150, "🍎"),
  prop(27, "Denpasar", "Denpasar", "yellow", 260, R.r260, 150, "🏖️"),
  { id: 28, type: "utility", name: "PDAM", short: "PDAM", icon: "💧", price: 150 },
  prop(29, "Mataram", "Mataram", "yellow", 280, R.r280, 150, "🌾"),
  { id: 30, type: "gotojail", name: "Masuk Penjara", short: "Masuk", icon: "👮" },
  prop(31, "Balikpapan", "Balikpapan", "green", 300, R.r300, 200, "🛢️"),
  prop(32, "Samarinda", "Samarinda", "green", 300, R.r300, 200, "🛶"),
  { id: 33, type: "community", name: "Dana Umum", short: "Dana", icon: "🎁" },
  prop(34, "Makassar", "Makassar", "green", 320, R.r320, 200, "⛵"),
  { id: 35, type: "transport", name: "Kapal Pelni", short: "Pelni", icon: "🚢", price: 200 },
  { id: 36, type: "chance", name: "Kesempatan", short: "Kesempatan", icon: "❓" },
  prop(37, "Manado", "Manado", "darkblue", 350, R.r350, 200, "🌋"),
  { id: 38, type: "tax", name: "Pajak Hiburan", short: "Hiburan", icon: "🎫", tax: 100 },
  prop(39, "Jayapura", "Jayapura", "darkblue", 400, R.r400, 200, "🦜"),
];

export const GROUP_TILES: Record<GroupId, number[]> = TILES.reduce(
  (acc, t) => {
    if (t.group) acc[t.group].push(t.id);
    return acc;
  },
  {
    brown: [],
    lightblue: [],
    pink: [],
    orange: [],
    red: [],
    yellow: [],
    green: [],
    darkblue: [],
  } as Record<GroupId, number[]>,
);

export const CARDS: CardDef[] = [
  { id: "c1", deck: "chance", text: "THR cair! Terima Rp 200.", kind: "money", amount: 200 },
  { id: "c2", deck: "chance", text: "Macet di Sudirman. Mundur 3 petak.", kind: "move_rel", amount: -3 },
  { id: "c3", deck: "chance", text: "Mudik ke kampung halaman. Maju ke GO.", kind: "move_to", target: 0 },
  { id: "c4", deck: "chance", text: "Kena tilang. Bayar Rp 50.", kind: "money", amount: -50 },
  { id: "c5", deck: "chance", text: "Menang undian RT. Terima Rp 100.", kind: "money", amount: 100 },
  { id: "c6", deck: "chance", text: "Perbaikan jalan: bayar Rp 40 per rumah.", kind: "repairs", per: 40 },
  { id: "c7", deck: "chance", text: "Ojek online gratis. Maju 2 petak.", kind: "move_rel", amount: 2 },
  { id: "c8", deck: "chance", text: "Gempa kecil: bayar Rp 25 per rumah.", kind: "repairs", per: 25 },
  { id: "c9", deck: "chance", text: "Kerja di luar kota. Maju ke transportasi terdekat.", kind: "nearest_transport" },
  { id: "c10", deck: "chance", text: "Surat bebas penjara. Simpan kartunya.", kind: "free" },
  { id: "d1", deck: "community", text: "Dana desa cair. Terima Rp 150.", kind: "money", amount: 150 },
  { id: "d2", deck: "community", text: "Iuran sampah. Bayar Rp 30.", kind: "money", amount: -30 },
  { id: "d3", deck: "community", text: "Warisan keluarga. Terima Rp 250.", kind: "money", amount: 250 },
  { id: "d4", deck: "community", text: "Biaya dokter. Bayar Rp 80.", kind: "money", amount: -80 },
  { id: "d5", deck: "community", text: "Kembali ke Penjara.", kind: "jail" },
  { id: "d6", deck: "community", text: "Semua pemain membayar Rp 25 ke kamu.", kind: "collect_all", amount: 25 },
  { id: "d7", deck: "community", text: "Kamu traktir semua pemain Rp 20.", kind: "pay_all", amount: 20 },
  { id: "d8", deck: "community", text: "Naik angkot gratis. Maju 1 petak.", kind: "move_rel", amount: 1 },
  { id: "d9", deck: "community", text: "Pajak kendaraan. Bayar Rp 60.", kind: "money", amount: -60 },
  { id: "d10", deck: "community", text: "Surat bebas penjara. Simpan kartunya.", kind: "free" },
];

export const MISSIONS: MissionDef[] = [
  { id: "m_groups", title: "Sultan Tanah", desc: "Kuasai 3 grup warna penuh." },
  { id: "m_transport", title: "Raja Logistik", desc: "Miliki 2 transportasi." },
  { id: "m_trades", title: "Negosiator", desc: "Selesaikan 3 transaksi dagang." },
  { id: "m_houses", title: "Pengembang", desc: "Punya 5 rumah dalam satu grup." },
  { id: "m_cash", title: "Tajir Mendadak", desc: "Simpan cash ≥ Rp 2.000 pada Ronde 11+." },
  { id: "m_go", title: "Sering Mudik", desc: "Lewati GO 4 kali." },
  { id: "m_auction", title: "Pemenang Lelang", desc: "Menangkan 2 lelang." },
  { id: "m_hotel", title: "Hotel Pertama", desc: "Punya hotel sebelum Ronde 12." },
];

export const EVENTS: EventDef[] = [
  {
    id: "ev_inflasi",
    title: "Inflasi",
    text: "Semua sewa naik 25%.",
    rounds: 2,
    effects: [{ kind: "rent_mult", mult: 1.25, roundsLeft: 2, label: "Inflasi +25% sewa" }],
  },
  {
    id: "ev_resesi",
    title: "Resesi",
    text: "Semua pemain bayar 5% cash (maks 300). Pasar Loak tutup.",
    rounds: 1,
    effects: [{ kind: "shop_closed", roundsLeft: 1, label: "Pasar Loak tutup" }],
  },
  {
    id: "ev_banjir",
    title: "Banjir",
    text: "Satu grup kota tidak menghasilkan sewa.",
    rounds: 1,
    effects: [],
  },
  {
    id: "ev_festival",
    title: "Festival Nusantara",
    text: "Semua pemain menerima Rp 100.",
    rounds: 0,
    effects: [],
  },
  {
    id: "ev_kemarau",
    title: "Kemarau Panjang",
    text: "Biaya bangun naik 50%.",
    rounds: 2,
    effects: [{ kind: "build_mult", mult: 1.5, roundsLeft: 2, label: "Bangun +50%" }],
  },
  {
    id: "ev_boom",
    title: "Boom Properti",
    text: "Harga beli properti diskon 20%.",
    rounds: 1,
    effects: [{ kind: "buy_discount", mult: 0.8, roundsLeft: 1, label: "Diskon beli 20%" }],
  },
  {
    id: "ev_demo",
    title: "Demonstrasi",
    text: "Tidak ada lelang dan tidak ada trade ronde ini.",
    rounds: 1,
    effects: [
      { kind: "no_auction", roundsLeft: 1, label: "Lelang tutup" },
      { kind: "no_trade", roundsLeft: 1, label: "Trade tutup" },
    ],
  },
  {
    id: "ev_krisis",
    title: "Krisis Global",
    text: "Bunga pinjaman dan PBB dua kali lipat.",
    rounds: 2,
    effects: [
      { kind: "interest_mult", mult: 2, roundsLeft: 2, label: "Bunga ×2" },
      { kind: "tax_mult", mult: 2, roundsLeft: 2, label: "PBB ×2" },
    ],
  },
];

export const SHOP_CARDS: ShopCardDef[] = [
  { id: "s_jail", name: "Surat Bebas Penjara", desc: "Keluar penjara tanpa bayar.", priceEarly: 150, priceLate: 250, kind: "jail_free" },
  { id: "s_promo", name: "Promosi", desc: "Sewa 1 propertimu ×3 selama 1 ronde.", priceEarly: 200, priceLate: 300, kind: "promo" },
  { id: "s_audit", name: "Audit Pajak", desc: "Ambil 10% cash 1 lawan (maks Rp 200).", priceEarly: 200, priceLate: 300, kind: "audit" },
  { id: "s_legal", name: "Legalitas Cepat", desc: "Bangun 1 rumah tanpa syarat even-build.", priceEarly: 250, priceLate: 350, kind: "legalitas" },
  { id: "s_sogok", name: "Sogok", desc: "Batalkan 1 efek peristiwa yang merugikanmu.", priceEarly: 200, priceLate: 300, kind: "sogok" },
  { id: "s_operasi", name: "Operasi Pasar", desc: "Paksa properti lawan (tanpa bangunan) masuk lelang.", priceEarly: 500, priceLate: 500, kind: "operasi" },
];

export const CHARACTERS: CharacterDef[] = [
  { id: "saudagar", name: "Saudagar", perk: "Menang lelang diskon 15%", flaw: "Sewa diterima −10%" },
  { id: "arsitek", name: "Arsitek", perk: "Biaya bangun −25%", flaw: "Bunga pinjaman 15%" },
  { id: "diplomat", name: "Diplomat", perk: "1× veto tawaran dagang", flaw: "Gaji GO −50" },
  { id: "bandar", name: "Bandar", perk: "Mulai +Rp 300, rebate lelang 10%", flaw: "Denda penjara Rp 100" },
  { id: "penjelajah", name: "Penjelajah", perk: "Gaji GO +50%", flaw: "PBB dibayar ×1,5" },
];

export const BOT_NAMES = ["Bot Randi", "Bot Sari", "Bot Dito", "Bot Nia"];

export const PRESET_FEATURES: Record<
  Preset,
  {
    waves: boolean;
    characters: boolean;
    missions: boolean;
    loans: boolean;
    shares: boolean;
    events: boolean;
    shop: boolean;
    tax: boolean;
    solidarity: boolean;
    golden: boolean;
  }
> = {
  klasik: {
    waves: true,
    characters: false,
    missions: false,
    loans: false,
    shares: false,
    events: false,
    shop: false,
    tax: false,
    solidarity: false,
    golden: false,
  },
  standar: {
    waves: true,
    characters: true,
    missions: true,
    loans: true,
    shares: true,
    events: true,
    shop: false,
    tax: false,
    solidarity: true,
    golden: false,
  },
  penuh: {
    waves: true,
    characters: true,
    missions: true,
    loans: true,
    shares: true,
    events: true,
    shop: true,
    tax: true,
    solidarity: true,
    golden: true,
  },
  pemula: {
    waves: true,
    characters: false,
    missions: false,
    loans: false,
    shares: false,
    events: false,
    shop: false,
    tax: false,
    solidarity: true,
    golden: false,
  },
};

export const WAVE_LABEL: Record<number, string> = {
  1: "RINTISAN",
  2: "PEMBANGUNAN",
  3: "PUNCAK",
  4: "KRISIS",
};

export const WAVE_MULT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2, 4: 2.5 };
export const WAVE_GO: Record<number, number> = { 1: 200, 2: 250, 3: 300, 4: 350 };
export const WAVE_TIMER: Record<number, number> = { 1: 60, 2: 45, 3: 40, 4: 30 };
