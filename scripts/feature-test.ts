import { applyAction, applyCard, buildCost, rentFor } from "../src/engine/actions";
import { botAction } from "../src/engine/bot";
import { createGame, defaultSettings } from "../src/engine/create";
import { CARDS, GROUP_TILES, SHOP_CARDS, TILES } from "../src/engine/data";
import type { GameState, Settings } from "../src/engine/types";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function fresh(preset: Settings["preset"] = "penuh", players = 2): GameState {
  const s = createGame(
    { ...defaultSettings(), preset, players, turnTimer: 0 },
    Array.from({ length: players }, (_, i) => ({ name: `P${i}`, isBot: false })),
    42,
  );
  s.turnIndex = 0;
  s.phase = "post_roll";
  return s;
}

console.log("Grup & bangun");
{
  let s = fresh();
  const me = s.players[0];
  me.cash = 5000;
  // ambil grup merah
  for (const id of GROUP_TILES.red) {
    s.tiles[id].owner = me.id;
    me.properties.push(id);
  }
  const before = me.cash;
  s = applyAction(s, { type: "BUILD", tile: GROUP_TILES.red[0] });
  ok("bangun diizinkan saat grup lengkap", s.tiles[GROUP_TILES.red[0]].houses === 1);
  ok("biaya terpotong", s.players[0].cash < before);
  const cost = buildCost(s, GROUP_TILES.red[0], s.players[0]);
  s = applyAction(s, { type: "BUILD", tile: GROUP_TILES.red[0] });
  s = applyAction(s, { type: "BUILD", tile: GROUP_TILES.red[0] });
  ok("even-build menahan rumah kedua sebelum grup lain", s.tiles[GROUP_TILES.red[0]].houses === 1, `houses=${s.tiles[GROUP_TILES.red[0]].houses}`);
  ok("biaya rumah sesuai karakter", cost === 110 || cost === 150, `cost=${cost}`);

  const s2 = applyAction(s, { type: "MORTGAGE", tile: GROUP_TILES.red[0] });
  ok("gadai ditolak bila ada bangunan", s2.tiles[GROUP_TILES.red[0]].mortgaged === false);

  const s3 = applyAction(s, { type: "SELL_HOUSE", tile: GROUP_TILES.red[0] });
  ok("jual rumah menurunkan houses", s3.tiles[GROUP_TILES.red[0]].houses === 0);
}

console.log("Sewa & gelombang");
{
  let s = fresh();
  const owner = s.players[0];
  const payer = s.players[1];
  const id = GROUP_TILES.red[0];
  s.tiles[id].owner = owner.id;
  owner.properties.push(id);
  const r1 = rentFor(s, id, 7, owner, payer);
  s.wave = 3;
  const r3 = rentFor(s, id, 7, owner, payer);
  ok("sewa naik di gelombang 3", r3.final > r1.final, `${r1.final} -> ${r3.final}`);

  s.tiles[id].mortgaged = true;
  // mortgage tidak menghasilkan sewa: dicek via preview di UI; pastikan resolve melewati
  s.tiles[id].mortgaged = false;

  const rentBefore = payer.cash;
  s.tiles[id].owner = owner.id;
  s.players[1].cash = 5000;
  const b = rentFor(s, id, 7, owner, payer);
  ok("rincian sewa punya catatan", b.notes.length > 0 && b.final >= 10);
  ok("sewa dasar tidak negatif", b.final > 0, `final=${b.final}`);
}

console.log("Saham");
{
  let s = fresh("penuh", 3);
  const payer = s.players[0];
  const owner = s.players[1];
  const holder = s.players[2];
  holder.cash = 5000;
  s.turnIndex = 2;
  s.round = 7;
  s.wave = 2;
  s = applyAction(s, { type: "BUY_SHARE", group: "red" });
  ok("beli saham berhasil", s.players[2].shares.includes("red"));
  const id = GROUP_TILES.red[0];
  s.tiles[id].owner = owner.id;
  owner.properties.push(id);
  s.tiles[id].houses = 5;
  const withShare = rentFor(s, id, 7, owner, payer);
  ok("dividen memotong sewa", withShare.shareCut > 0, JSON.stringify(withShare));
  const selfPaid = rentFor(s, id, 7, owner, holder);
  ok(
    "pemegang saham yang membayar sewa tidak kehilangan nilainya",
    selfPaid.shareCut === 0 && selfPaid.final > withShare.final,
    `${withShare.final} vs ${selfPaid.final}`,
  );
}

console.log("Pinjaman");
{
  let s = fresh("penuh");
  s.wave = 1;
  const me = s.players[0];
  s = applyAction(s, { type: "TAKE_LOAN", amount: 500 });
  ok("pinjaman masuk", s.players[0].cash === me.cash + 500);
  const total = s.players[0].loans.reduce((a, l) => a + l.principal, 0);
  ok("pokok tercatat", total === 500, `total=${total}`);
  const s2 = applyAction(s, { type: "REPAY_LOAN" });
  ok("pelunasan", s2.players[0].loans.length === 0);
}

console.log("Toko");
{
  let s = fresh("penuh");
  s.wave = 3;
  s.shop = [SHOP_CARDS[0].id];
  const me = s.players[0];
  me.cash = 5000;
  s = applyAction(s, { type: "BUY_SHOP", card: SHOP_CARDS[0].id });
  ok("beli surat penjara jadi kartu", s.players[0].jailCards === 1);
  s.players[0].inJail = true;
  s.phase = "jail";
  s = applyAction(s, { type: "USE_JAIL_CARD" });
  ok("pakai surat keluar penjara", s.players[0].inJail === false && s.players[0].jailCards === 0);
}

console.log("Trade");
{
  let s = fresh("standar");
  const a = s.players[0];
  const b = s.players[1];
  a.cash = 1000;
  b.cash = 1000;
  s.tiles[1].owner = b.id;
  b.properties.push(1);
  s = applyAction(s, {
    type: "TRADE_OFFER",
    offer: { from: a.id, to: b.id, giveCash: 300, giveProps: [], giveCards: 0, wantCash: 0, wantProps: [1], wantCards: 0 },
  });
  ok("tawaran tersimpan", s.trade !== null);
  s = applyAction(s, { type: "TRADE_RESPOND", accept: true });
  ok("tukar properti", s.tiles[1].owner === a.id);
  ok("uang berpindah", s.players[0].cash === 700 && s.players[1].cash === 1300, `${s.players[0].cash}/${s.players[1].cash}`);
  ok("statistik trade naik", s.players[0].stats.trades === 1);
}

console.log("Penjara & dobel");
{
  let s = fresh();
  s.players[0].inJail = true;
  s.phase = "jail";
  s = applyAction(s, { type: "PAY_JAIL" });
  ok("bayar denda keluar", s.players[0].inJail === false && s.players[0].cash === 1450);
}

console.log("Bangkrut & kemenangan");
{
  let s = fresh("klasik");
  s.players[0].cash = 10;
  s.players[1].cash = 5000;
  s = applyAction(s, { type: "SURRENDER" });
  ok("menyerah = bangkrut", s.players[0].bankrupt === true);
  ok("pemenang ditentukan", s.phase === "game_over" && s.winner === s.players[1].id);
}

console.log("PBB & peristiwa");
{
  let s = fresh("penuh");
  s.round = 11;
  const me = s.players[0];
  s.tiles[37].owner = me.id;
  me.properties.push(37);
  me.cash = 3000;
  const before = me.cash;
  s.turnIndex = 1;
  s = applyAction(s, { type: "END_TURN" });
  ok("ronde naik ke 12", s.round === 12, `round=${s.round}`);
  ok("PBB memotong cash", s.players[0].cash < before, `${before} -> ${s.players[0].cash}`);
}

console.log("Krisis");
{
  let s = fresh("standar");
  s.round = 16;
  s.wave = 4;
  s.turnIndex = 1;
  s.players[0].loans.push({ id: "x", principal: 400, rate: 0.1 });
  const before = s.players[0].cash;
  s = applyAction(s, { type: "END_TURN" });
  ok("pinjaman jatuh tempo di krisis", s.players[0].loans.length === 0);
  ok("cash berkurang", s.players[0].cash < before);
}

console.log("Perbaikan v2.0 (Dividen, Banjir, Parkir Pot, Diplomat, Hotel & Bot)");
{
  // 1. Dividen saham, jual hotel aman saat bank terbatas, banjir & roll nyata
  let s = fresh("penuh", 3);
  s.wave = 2;
  const owner = s.players[0];
  const payer = s.players[1];
  const holder = s.players[2];
  holder.character = "bandar";
  payer.character = "arsitek";
  owner.character = "penjelajah";
  const tileId = GROUP_TILES.red[0];
  s.tiles[tileId].owner = owner.id;
  owner.properties.push(tileId);
  s.tiles[tileId].houses = 5;
  holder.shares.push("red");
  payer.cash = 3000;
  const rb = rentFor(s, tileId, 7, owner, payer);
  ok("dividen tercatat di breakdown", (rb.dividends?.length ?? 0) === 1 && rb.shareCut > 0);

  // Guard hotel downgrade saat housesBank terbatas (turn masih P0 = owner)
  s.housesBank = 1;
  s.hotelsBank = 5;
  s.turnIndex = 0;
  const sSold = applyAction(s, { type: "SELL_HOUSE", tile: tileId });
  ok("jual hotel saat bank rumah terbatas tetap aman", sSold.housesBank === 0 && sSold.hotelsBank === 6 && sSold.tiles[tileId].houses === 1, `hb=${sSold.housesBank},ht=${sSold.hotelsBank},h=${sSold.tiles[tileId].houses}`);

  // Roll nyata: pastikan pemegang saham benar-benar menerima dividen saat payer mendarat
  s.players[1].position = tileId - 4;
  s.turnIndex = 1;
  s.phase = "await_roll";
  let rolled: GameState | null = null;
  for (let probe = 1; probe < 500; probe++) {
    const cand = structuredClone(s);
    cand.rng = probe;
    const res = applyAction(cand, { type: "ROLL" });
    if (res.dice && res.dice[0] + res.dice[1] === 4 && res.dice[0] !== res.dice[1]) {
      rolled = res;
      break;
    }
  }
  ok("dividen saham benar-benar cair ke pemegang saham", rolled !== null && rolled.players[2].cash > holder.cash, `before=${holder.cash},after=${rolled?.players[2].cash}`);

  // 2. Banjir menjadikan sewa strictly Rp 0
  s.effects.push({ id: "fl", kind: "no_rent_group", group: "red", roundsLeft: 1, label: "Banjir red" });
  const flooded = rentFor(s, tileId, 7, owner, payer);
  ok("banjir bikin sewa 0 rupiah", flooded.final === 0 && (flooded.dividends?.length ?? 0) === 0, `final=${flooded.final}`);

  // 3. Free Parking Pot & Tax -> Pot -> Free tile (20)
  let sp = fresh("standar", 2);
  sp.settings.freeParkingPot = true;
  sp.players[0].cash = 1000;
  sp.players[0].inJail = true;
  sp.phase = "jail";
  sp = applyAction(sp, { type: "PAY_JAIL" });
  const potAfterBail = sp.freeParkingPot ?? 0;
  ok("denda masuk ke pot Parkir Gratis", potAfterBail > 0, `pot=${potAfterBail}`);
  sp.players[0].position = 16;
  sp.turnIndex = 0;
  sp.phase = "await_roll";
  let parkRes: GameState | null = null;
  for (let probe = 1; probe < 500; probe++) {
    const cand = structuredClone(sp);
    cand.rng = probe;
    const res = applyAction(cand, { type: "ROLL" });
    if (res.dice && res.dice[0] + res.dice[1] === 4 && res.dice[0] !== res.dice[1]) {
      parkRes = res;
      break;
    }
  }
  ok("jackpot Parkir Gratis cair saat mendarat di petak 20", parkRes !== null && (parkRes.freeParkingPot ?? -1) === 0 && parkRes.players[0].cash >= 950 + potAfterBail);

  // 4. Diplomat 1x bebas sewa besar
  let sd = fresh("standar", 2);
  sd.players[0].character = "diplomat";
  sd.players[0].diplomatVetoUsed = false;
  sd.players[0].cash = 1500;
  sd.players[1].character = "bandar";
  sd.tiles[GROUP_TILES.red[0]].owner = sd.players[1].id;
  sd.players[1].properties.push(GROUP_TILES.red[0]);
  sd.tiles[GROUP_TILES.red[0]].houses = 3;
  sd.players[0].position = GROUP_TILES.red[0] - 4;
  sd.phase = "await_roll";
  let dipRes: GameState | null = null;
  for (let probe = 1; probe < 500; probe++) {
    const cand = structuredClone(sd);
    cand.rng = probe;
    const res = applyAction(cand, { type: "ROLL" });
    if (res.dice && res.dice[0] + res.dice[1] === 4 && res.dice[0] !== res.dice[1]) {
      dipRes = res;
      break;
    }
  }
  ok("diplomat bebas sewa besar 1x", dipRes !== null && dipRes.players[0].diplomatVetoUsed === true && dipRes.players[0].cash === 1500);

  // 5. Bot Trade Cash Check fix (wantCash vs giveCash)
  let sb = fresh("standar", 2);
  sb.players[1].isBot = true;
  sb.players[1].cash = 500;
  sb.tiles[GROUP_TILES.darkblue[0]].owner = sb.players[1].id;
  sb.players[1].properties.push(GROUP_TILES.darkblue[0]);
  sb.trade = {
    from: sb.players[0].id,
    to: sb.players[1].id,
    giveCash: 900,
    giveProps: [],
    giveCards: 0,
    wantCash: 0,
    wantProps: [GROUP_TILES.darkblue[0]],
    wantCards: 0,
  };
  const act = botAction(sb);
  ok("bot menerima tawaran dagang menguntungkan walau giveCash > target.cash", act?.type === "TRADE_RESPOND" && act.accept === true, JSON.stringify(act));
}

console.log("Validasi trade");
{
  const s = fresh("standar");
  const a = s.players[0];
  const b = s.players[1];
  a.cash = 1000;
  b.cash = 1000;
  const base = {
    from: a.id,
    to: b.id,
    giveCash: 0,
    giveProps: [] as number[],
    giveCards: 0,
    wantCash: 0,
    wantProps: [] as number[],
    wantCards: 0,
  };

  const negGive = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveCash: -100 } });
  ok("TRADE_OFFER giveCash negatif ditolak", negGive === s && negGive.trade === null);
  ok(
    "cash kedua pihak tidak berubah saat giveCash negatif",
    negGive.players[0].cash === 1000 && negGive.players[1].cash === 1000,
  );

  const negWant = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, wantCash: -50 } });
  ok("TRADE_OFFER wantCash negatif ditolak", negWant === s && negWant.trade === null);
  ok(
    "cash kedua pihak tidak berubah saat wantCash negatif",
    negWant.players[0].cash === 1000 && negWant.players[1].cash === 1000,
  );

  const frac = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveCash: 100.5 } });
  ok("TRADE_OFFER cash desimal ditolak", frac === s && frac.trade === null);

  const nan = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveCash: Number.NaN } });
  ok("TRADE_OFFER cash NaN ditolak", nan === s && nan.trade === null);

  s.tiles[3].owner = b.id;
  b.properties.push(3);
  const notOwned = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveProps: [3] } });
  ok("TRADE_OFFER menyerahkan properti milik lawan ditolak", notOwned === s && notOwned.trade === null);

  const unowned = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, wantProps: [6] } });
  ok("TRADE_OFFER meminta properti tak bertuan ditolak", unowned === s && unowned.trade === null);

  const dup = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, wantProps: [3, 3] } });
  ok("TRADE_OFFER properti duplikat ditolak", dup === s && dup.trade === null);

  const cards = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveCards: 1 } });
  ok("TRADE_OFFER berisi kartu ditolak", cards === s && cards.trade === null);

  const good = applyAction(s, { type: "TRADE_OFFER", offer: { ...base, giveCash: 100, wantProps: [3] } });
  ok(
    "TRADE_OFFER sah diterima dan menaikkan version",
    good !== s && good.trade !== null && good.version === s.version + 1,
  );
}

console.log("DISMISS wajib lelang");
{
  const s = fresh("standar");
  s.players[0].cash = 2000;
  s.offer = { tile: 1, price: 60, rent: 10, rentFull: 120 };
  s.phase = "post_roll";
  const d = applyAction(s, { type: "DISMISS" });
  ok("DISMISS memicu lelang", d.auction !== null && d.auction?.tile === 1);
  ok("DISMISS tidak menutup tawaran tanpa lelang", d.offer === null && d.phase === "auction");
  ok("DISMISS tidak memotong cash pembeli", d.players[0].cash === 2000);
}

console.log("Bangkrut di awal ronde");
{
  const s = fresh("klasik", 2);
  s.turnIndex = 1;
  s.round = 5;
  s.players[0].cash = 0;
  s.players[0].loans.push({ id: "x", principal: 400, rate: 0.1 });
  const g = applyAction(s, { type: "END_TURN" });
  ok(
    "bangkrut karena bunga di startRound mengakhiri game",
    g.phase === "game_over" && g.winner === g.players[1].id,
    `phase=${g.phase} winner=${g.winner}`,
  );
}

console.log("Pemain bangkrut");
{
  const s = fresh("penuh", 2);
  const p0 = s.players[0];
  p0.bankrupt = true;
  p0.cash = 0;
  p0.properties = [];
  s.phase = "await_roll";
  const loan = applyAction(s, { type: "TAKE_LOAN", amount: 500 });
  ok("pemain bangkrut tidak bisa TAKE_LOAN", loan === s && loan.players[0].cash === 0);
  const golden = applyAction(s, { type: "DECLARE_GOLDEN" });
  ok("pemain bangkrut tidak bisa Giliran Emas", golden === s && golden.players[0].goldenActive === false);
  const next = applyAction(s, { type: "END_TURN" });
  ok(
    "END_TURN tetap maju sehingga tidak deadlock",
    next !== s && next.turnIndex === 1 && next.phase === "await_roll",
    `turn=${next.turnIndex} phase=${next.phase}`,
  );
}

console.log("Giliran Emas & sewa");
{
  const s = fresh("penuh", 2);
  const owner = s.players[0];
  const payer = s.players[1];
  const id = GROUP_TILES.red[0];
  s.tiles[id].owner = owner.id;
  owner.properties.push(id);
  payer.goldenActive = false;
  const plain = rentFor(s, id, 7, owner, payer);
  payer.goldenActive = true;
  const paid = rentFor(s, id, 7, owner, payer);
  ok("Giliran Emas tidak menggandakan sewa yang dibayar", paid.final === plain.final, `${plain.final} vs ${paid.final}`);
  payer.goldenActive = false;
  owner.goldenActive = true;
  const earned = rentFor(s, id, 7, owner, payer);
  ok("Giliran Emas pemilik tetap menggandakan sewa", earned.final === plain.final * 2, `${plain.final} vs ${earned.final}`);
}

console.log("Kartu mundur");
{
  const s = fresh("standar", 2);
  const p = s.players[0];
  const card = CARDS.find((c) => c.id === "c2");
  ok("kartu Mundur 3 petak tersedia", Boolean(card));
  if (card) {
    p.position = 9;
    const passes = p.stats.goPasses;
    const cash = p.cash;
    applyCard(s, p, card);
    ok("kartu mundur tidak memberi gaji GO", p.stats.goPasses === passes && p.cash === cash, `cash=${p.cash}`);
    ok("posisi mundur 3 petak benar", p.position === 6, `pos=${p.position}`);
  }
}

console.log("Lelang tutup & Operasi Pasar");
{
  const tile = 6;
  const s = fresh("penuh", 3);
  s.wave = 3;
  s.players[0].hand = ["s_operasi"];
  s.tiles[tile].owner = s.players[1].id;
  s.players[1].properties.push(tile);
  s.effects.push({ id: "ev-demo", kind: "no_auction", roundsLeft: 1, label: "Lelang tutup" });
  const blocked = applyAction(s, { type: "USE_CARD", card: "s_operasi", target: tile });
  ok("no_auction memblokir Operasi Pasar", blocked === s && blocked.auction === null);
  ok("kartu Operasi Pasar tidak hangus saat lelang tutup", blocked.players[0].hand.includes("s_operasi"));

  const s2 = fresh("penuh", 3);
  s2.wave = 3;
  s2.players[0].hand = ["s_operasi"];
  s2.tiles[tile].owner = s2.players[1].id;
  s2.players[1].properties.push(tile);
  const open = applyAction(s2, { type: "USE_CARD", card: "s_operasi", target: tile });
  ok("Operasi Pasar memicu lelang saat lelang buka", open.auction !== null && open.players[0].hand.length === 0);
}

console.log("Sogok vs Promosi");
{
  const s = fresh("penuh", 2);
  const me = s.players[0];
  const tile = GROUP_TILES.red[0];
  s.tiles[tile].owner = me.id;
  me.properties.push(tile);
  me.hand = ["s_promo", "s_sogok"];
  const promoted = applyAction(s, { type: "USE_CARD", card: "s_promo", target: tile });
  ok("Promosi aktif di properti sendiri", promoted.effects.some((e) => e.kind === "rent_mult" && e.tile === tile));
  const sogok = applyAction(promoted, { type: "USE_CARD", card: "s_sogok" });
  ok("sogok tidak menghapus Promosi sendiri", sogok === promoted && sogok.players[0].hand.includes("s_sogok"));

  const s2 = fresh("penuh", 2);
  s2.players[0].hand = ["s_sogok"];
  s2.effects.push({ id: "ev-inflasi", kind: "rent_mult", mult: 1.25, roundsLeft: 2, label: "Inflasi" });
  const removed = applyAction(s2, { type: "USE_CARD", card: "s_sogok" });
  ok("sogok menghapus efek peristiwa", removed.effects.length === 0 && removed.players[0].hand.length === 0);
}

console.log(`\n${pass} lulus, ${fail} gagal`);
if (fail > 0) process.exit(1);
