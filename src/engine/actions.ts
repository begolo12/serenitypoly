import {
  CARDS,
  GROUP_TILES,
  MISSIONS,
  PRESET_FEATURES,
  SHOP_CARDS,
  TILES,
  WAVE_GO,
  WAVE_MULT,
} from "./data";
import { pick, randInt } from "./rng";
import type {
  Action,
  CardDef,
  Effect,
  GameState,
  GroupId,
  Player,
  RentBreakdown,
  ShopCardDef,
  Tile,
} from "./types";
import { pickShop } from "./create";

export const features = (s: GameState) => PRESET_FEATURES[s.settings.preset];

export const playerOf = (s: GameState, id: string | null) =>
  s.players.find((p) => p.id === id) ?? null;

export const current = (s: GameState) => s.players[s.turnIndex];
export const living = (s: GameState) => s.players.filter((p) => !p.bankrupt);

export function groupComplete(s: GameState, group: GroupId, owner: string): boolean {
  const ids = GROUP_TILES[group];
  return ids.length > 0 && ids.every((id) => s.tiles[id].owner === owner);
}

export function ownedGroupCount(s: GameState, owner: string): number {
  return (Object.keys(GROUP_TILES) as GroupId[]).filter((g) => groupComplete(s, g, owner)).length;
}

export function countTransport(s: GameState, owner: string): number {
  return TILES.filter((t) => t.type === "transport" && s.tiles[t.id].owner === owner).length;
}

export function countUtility(s: GameState, owner: string): number {
  return TILES.filter((t) => t.type === "utility" && s.tiles[t.id].owner === owner).length;
}

export function housesInGroup(s: GameState, group: GroupId): number {
  return GROUP_TILES[group].reduce((sum, id) => sum + s.tiles[id].houses, 0);
}

const clamp10 = (n: number) => Math.max(10, Math.floor(n / 10) * 10);

export function assignTile(s: GameState, tileId: number, ownerId: string | null) {
  for (const p of s.players) {
    if (p.properties.includes(tileId)) p.properties = p.properties.filter((id) => id !== tileId);
  }
  s.tiles[tileId].owner = ownerId;
  if (ownerId) {
    const owner = s.players.find((x) => x.id === ownerId);
    if (owner && !owner.properties.includes(tileId)) owner.properties.push(tileId);
  }
}

export function netWorth(s: GameState, p: Player): number {
  let total = p.cash;
  for (const id of p.properties) {
    const tile = TILES[id];
    const st = s.tiles[id];
    if (tile.price) total += st.mortgaged ? Math.floor(tile.price / 2) : tile.price;
    if (tile.houseCost) total += st.houses * tile.houseCost;
  }
  for (const g of p.shares) total += Math.floor(GROUP_TILES[g].reduce((a, id) => a + (TILES[id].price ?? 0), 0) * 0.2);
  for (const l of p.loans) total -= l.principal;
  return total;
}

export function scoreOf(s: GameState, p: Player): number {
  return (
    netWorth(s, p) +
    ownedGroupCount(s, p.id) * 200 +
    (p.missionDone ? 200 : 0)
  );
}

export function rentPreview(s: GameState, tileId: number): number {
  const tile = TILES[tileId];
  if (!tile || !tile.price) return 0;
  let base = 0;
  if (tile.type === "property" && tile.rents) base = tile.rents[0];
  else if (tile.type === "transport") base = 25;
  else if (tile.type === "utility") base = 28;
  const wave = features(s).waves ? WAVE_MULT[s.wave] : 1;
  return clamp10(base * wave);
}

export function rentFor(
  s: GameState,
  tileId: number,
  diceSum: number,
  owner: Player,
  payer: Player,
): RentBreakdown {
  const tile = TILES[tileId];
  const st = s.tiles[tileId];
  const notes: string[] = [];
  let base = 0;

  if (tile.type === "property" && tile.rents) {
    base = tile.rents[Math.min(st.houses, 5)];
    notes.push(
      st.houses === 5
        ? `Hotel: Rp ${base}`
        : st.houses > 0
          ? `${st.houses} rumah: Rp ${base}`
          : `Tanah kosong: Rp ${base}`,
    );
    if (st.houses === 0 && groupComplete(s, tile.group!, owner.id)) {
      if (s.settings.doubleRent) {
        base *= 2;
        notes.push("Monopoli 2×");
      }
      notes.push("Grup lengkap");
    }
  } else if (tile.type === "transport") {
    const n = Math.max(1, countTransport(s, owner.id));
    base = [25, 50, 100, 200][Math.min(n - 1, 3)];
    notes.push(`${n} transportasi: Rp ${base}`);
  } else if (tile.type === "utility") {
    const n = Math.max(1, countUtility(s, owner.id));
    const mult = n >= 2 ? 10 : 4;
    base = diceSum * mult;
    notes.push(`Mata dadu ${diceSum} × ${mult}`);
  }

  const waveMult = features(s).waves ? WAVE_MULT[s.wave] : 1;
  let value = base * waveMult;
  if (waveMult !== 1) notes.push(`Gelombang ×${waveMult}`);

  let effectMult = 1;
  for (const e of s.effects) {
    if (e.kind === "rent_mult" && (e.tile === undefined || e.tile === tileId)) {
      effectMult *= e.mult ?? 1;
    }
  }
  const promo = s.effects.find((e) => e.kind === "rent_mult" && e.tile === tileId && (e.mult ?? 1) >= 3);
  if (promo) notes.push("Promosi ×3");
  const blackout = s.effects.find((e) => e.kind === "no_rent_group" && e.group === tile.group);
  if (blackout) {
    effectMult = 0;
    notes.push("Banjir: sewa 0");
  }
  value *= effectMult;

  let shareCut = 0;
  if (tile.type === "property" && tile.group) {
    const holders = s.players.filter(
      (p) => !p.bankrupt && p.id !== owner.id && p.shares.includes(tile.group!),
    );
    const per = Math.min(Math.floor((value * 0.1) / 10) * 10, 150);
    if (per > 0) {
      shareCut = per * holders.length;
      if (holders.length) notes.push(`Dividen saham ${holders.length}× Rp ${per}`);
    }
  }

  let characterAdj = 0;
  if (owner.character === "saudagar") {
    characterAdj = -Math.round((value - shareCut) * 0.1);
    notes.push("Saudagar −10%");
  }

  let final = Math.max(10, Math.floor((value - shareCut + characterAdj) / 10) * 10);
  if (payer.goldenActive || owner.goldenActive) {
    final *= 2;
    notes.push("Giliran Emas ×2");
  }
  notes.push(`Dibulatkan: Rp ${final}`);

  return {
    base,
    waveMult,
    effectMult,
    afterEffects: Math.round(value),
    shareCut,
    characterAdj,
    final,
    notes,
  };
}

function pushLog(s: GameState, text: string, tone: "info" | "money" | "warn" | "good" = "info") {
  s.log.push({ id: s.nextLogId++, round: s.round, text, tone });
  if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
}

function addEffect(s: GameState, effect: Omit<Effect, "id">) {
  s.effects.push({ ...effect, id: `e${s.effects.length}-${s.nextLogId}` });
}

export function effectMult(s: GameState, kind: Effect["kind"]): number {
  return s.effects.filter((e) => e.kind === kind).reduce((a, e) => a * (e.mult ?? 1), 1);
}

export function hasEffect(s: GameState, kind: Effect["kind"]): boolean {
  return s.effects.some((e) => e.kind === kind);
}

export function buildCost(s: GameState, tileId: number, p: Player): number {
  const tile = TILES[tileId];
  let cost = tile.houseCost ?? 0;
  cost *= effectMult(s, "build_mult");
  if (p.character === "arsitek") cost *= 0.75;
  return Math.round(cost / 10) * 10;
}

export function buyPrice(s: GameState, tileId: number): number {
  const tile = TILES[tileId];
  const base = tile.price ?? 0;
  return Math.round((base * effectMult(s, "buy_discount")) / 10) * 10;
}

function sellHouses(s: GameState, p: Player, need: number) {
  let guard = 0;
  while (p.cash < need && guard++ < 200) {
    const owned = p.properties
      .map((id) => ({ id, houses: s.tiles[id].houses }))
      .filter((x) => x.houses > 0)
      .sort((a, b) => b.houses - a.houses);
    if (owned.length === 0) break;
    const target = owned[0].id;
    const st = s.tiles[target];
    const tile = TILES[target];
    st.houses -= 1;
    if (st.houses === 4) {
      s.hotelsBank += 1;
      s.housesBank -= 4;
    } else {
      s.housesBank += 1;
    }
    p.cash += Math.floor((tile.houseCost ?? 0) / 2);
    pushLog(s, `${p.name} menjual rumah di ${tile.name} untuk melunasi utang.`, "warn");
  }
}

function mortgageAll(s: GameState, p: Player, need: number) {
  let guard = 0;
  while (p.cash < need && guard++ < 100) {
    const candidate = p.properties.find((id) => !s.tiles[id].mortgaged);
    if (candidate === undefined) break;
    const tile = TILES[candidate];
    s.tiles[candidate].mortgaged = true;
    p.cash += Math.floor((tile.price ?? 0) / 2);
    pushLog(s, `${p.name} menggadaikan ${tile.name}.`, "warn");
  }
}

export function pay(
  s: GameState,
  payer: Player,
  amount: number,
  creditor: Player | null,
  reason = "",
): number {
  if (amount <= 0 || payer.bankrupt) return 0;
  if (payer.cash < amount) {
    sellHouses(s, payer, amount);
    mortgageAll(s, payer, amount);
  }
  const paid = Math.min(amount, payer.cash);
  payer.cash -= paid;
  if (creditor && creditor.id !== payer.id) creditor.cash += paid;
  if (paid < amount) {
    pushLog(s, `${payer.name} tidak mampu membayar ${reason}. Bangkrut!`, "warn");
    bankrupt(s, payer, creditor);
  }
  return paid;
}

export function receive(s: GameState, p: Player, amount: number) {
  if (amount > 0 && !p.bankrupt) p.cash += amount;
}

export function bankrupt(s: GameState, p: Player, creditor: Player | null) {
  p.bankrupt = true;
  p.cash = 0;
  for (const id of p.properties) {
    const st = s.tiles[id];
    if (st.houses > 0) {
      if (st.houses === 5) s.hotelsBank += 1;
      else s.housesBank += st.houses;
      st.houses = 0;
    }
    if (creditor && !creditor.bankrupt) {
      assignTile(s, id, creditor.id);
    } else {
      assignTile(s, id, null);
      s.tiles[id].mortgaged = false;
    }
  }
  p.properties = [];
  p.shares = [];
  p.hand = [];
  p.loans = [];
  s.offer = null;
  s.auction = null;
  s.trade = null;
  pushLog(
    s,
    creditor ? `${p.name} bangkrut. Semua aset pindah ke ${creditor.name}.` : `${p.name} bangkrut dan keluar dari permainan.`,
    "warn",
  );
  checkEnd(s);
}

function checkEnd(s: GameState) {
  if (s.phase === "game_over") return;
  const alive = living(s);
  if (alive.length <= 1) {
    s.phase = "game_over";
    s.winner = alive[0]?.id ?? s.players[0].id;
    pushLog(s, `${playerOf(s, s.winner)?.name ?? "Pemain"} memenangkan permainan!`, "good");
  }
}

function endByScore(s: GameState) {
  const alive = living(s);
  const ranked = alive.slice().sort((a, b) => scoreOf(s, b) - scoreOf(s, a));
  s.phase = "game_over";
  s.winner = ranked[0]?.id ?? null;
  pushLog(s, `Ronde ${s.settings.maxRounds} selesai. Pemenang: ${ranked[0]?.name ?? "-"}.`, "good");
}

function sendToJail(s: GameState, p: Player) {
  p.position = 10;
  p.inJail = true;
  p.jailTurns = 0;
  p.stats.jailVisits += 1;
  pushLog(s, `${p.name} masuk penjara.`, "warn");
}

function passGo(s: GameState, p: Player) {
  if (p.bankrupt) return;
  let salary = features(s).waves ? WAVE_GO[s.wave] : 200;
  if (p.character === "diplomat") salary = Math.max(50, salary - 50);
  if (p.character === "penjelajah") salary = Math.round(salary * 1.5);
  if (p.goldenActive) salary *= 2;
  p.cash += salary;
  p.stats.goPasses += 1;
  pushLog(s, `${p.name} lewat GO, terima Rp ${salary}.`, "money");
}

function moveTo(s: GameState, p: Player, target: number, collectGo = true) {
  const from = p.position;
  const steps = (target - from + 40) % 40;
  if (collectGo && target < from) passGo(s, p);
  p.position = ((target % 40) + 40) % 40;
  s.lastMove = { playerId: p.id, from, to: p.position, steps };
}

function applyCard(s: GameState, p: Player, card: CardDef) {
  pushLog(s, `${p.name} menarik kartu: ${card.text}`);
  const others = living(s).filter((x) => x.id !== p.id);
  switch (card.kind) {
    case "money":
      if ((card.amount ?? 0) >= 0) receive(s, p, card.amount ?? 0);
      else pay(s, p, Math.abs(card.amount ?? 0), null, "kartu");
      break;
    case "move_to":
      moveTo(s, p, card.target ?? 0);
      resolveTile(s, p);
      break;
    case "move_rel": {
      const target = (p.position + (card.amount ?? 0) + 40) % 40;
      moveTo(s, p, target);
      resolveTile(s, p);
      break;
    }
    case "jail":
      sendToJail(s, p);
      break;
    case "free":
      p.jailCards += 1;
      break;
    case "repairs": {
      const houses = p.properties.reduce((a, id) => a + s.tiles[id].houses, 0);
      pay(s, p, houses * (card.per ?? 0), null, "perbaikan");
      break;
    }
    case "collect_all":
      for (const other of others) {
        pay(s, other, card.amount ?? 0, p, "solidaritas");
      }
      break;
    case "pay_all":
      for (const other of others) pay(s, p, card.amount ?? 0, other, "traktiran");
      break;
    case "nearest_transport": {
      let target = p.position;
      for (let i = 1; i <= 40; i++) {
        const idx = (p.position + i) % 40;
        if (TILES[idx].type === "transport") {
          target = idx;
          break;
        }
      }
      moveTo(s, p, target);
      resolveTile(s, p);
      break;
    }
  }
}

function resolveTile(s: GameState, p: Player) {
  const tile = TILES[p.position];
  s.lastRent = null;

  switch (tile.type) {
    case "property":
    case "transport":
    case "utility": {
      const st = s.tiles[tile.id];
      if (!st.owner) {
        const price = buyPrice(s, tile.id);
        s.offer = { tile: tile.id, price, rent: rentPreview(s, tile.id), rentFull: price * 2 };
        s.phase = "post_roll";
        return;
      }
      if (st.owner === p.id) return;
      if (st.mortgaged) {
        pushLog(s, `${tile.name} sedang digadaikan. Tidak ada sewa.`);
        return;
      }
      const owner = playerOf(s, st.owner);
      if (!owner || owner.bankrupt) return;
      const breakdown = rentFor(s, tile.id, (s.dice?.[0] ?? 1) + (s.dice?.[1] ?? 1), owner, p);
      s.lastRent = breakdown;
      const paid = pay(s, p, breakdown.final, owner, `sewa ${tile.name}`);
      p.stats.rentPaid += paid;
      owner.stats.rentEarned += paid;
      pushLog(s, `${p.name} bayar sewa Rp ${paid} ke ${owner.name} (${tile.name}).`, "money");
      break;
    }
    case "tax": {
      let amount = tile.tax ?? 0;
      amount = Math.round((amount * effectMult(s, "tax_mult")) / 10) * 10;
      pay(s, p, amount, null, tile.name);
      pushLog(s, `${p.name} membayar ${tile.name} Rp ${amount}.`, "warn");
      break;
    }
    case "chance":
    case "community": {
      const deck = CARDS.filter((c) => c.deck === (tile.type === "chance" ? "chance" : "community"));
      const card = pick(s, deck);
      applyCard(s, p, card);
      break;
    }
    case "gotojail":
      sendToJail(s, p);
      break;
    case "free":
      pushLog(s, `${p.name} berhenti di Parkir Gratis.`);
      break;
    case "jail":
      pushLog(s, `${p.name} hanya mengunjungi penjara.`);
      break;
    case "go":
      pushLog(s, `${p.name} berhenti di GO.`);
      break;
  }
}

export function startAuction(s: GameState, tileId: number, forced = false) {
  const active = living(s).map((p) => p.id);
  if (active.length < 2) {
    const only = active[0] ? playerOf(s, active[0]) : null;
    if (only) {
      const price = buyPrice(s, tileId);
      if (only.cash >= price) {
        only.cash -= price;
        assignTile(s, tileId, only.id);
        pushLog(s, `${only.name} membeli ${TILES[tileId].name} tanpa lelang.`, "money");
      }
    }
    s.offer = null;
    return;
  }
  s.offer = null;
  s.phase = "auction";
  s.auction = {
    tile: tileId,
    bid: 0,
    leader: null,
    active,
    current: active[0],
    forced,
  };
}

function nextBidder(s: GameState): string | null {
  const a = s.auction;
  if (!a) return null;
  if (a.active.length === 0) return null;
  const start = a.current ? a.active.indexOf(a.current) : -1;
  for (let i = 1; i <= a.active.length; i++) {
    const candidate = a.active[(start + i + a.active.length) % a.active.length];
    if (candidate !== a.leader) return candidate;
  }
  return null;
}

function finishAuction(s: GameState) {
  const a = s.auction;
  if (!a) return;
  const tile = TILES[a.tile];
  if (a.leader && a.bid > 0) {
    const winner = playerOf(s, a.leader);
    if (winner) {
      let price = a.bid;
      if (winner.character === "saudagar") price = Math.round((price * 0.85) / 10) * 10;
      price = Math.min(price, winner.cash);
      winner.cash -= price;
      const previous = s.players.find((pl) => pl.id !== winner.id && pl.properties.includes(a.tile)) ?? null;
      assignTile(s, a.tile, winner.id);
      winner.stats.auctionsWon += 1;
      if (a.forced && previous) previous.cash += Math.round(price * 0.7);
      if (winner.character === "bandar") winner.cash += Math.round(price * 0.1);
      pushLog(s, `${winner.name} memenangkan lelang ${tile.name} seharga Rp ${price}.`, "money");
    }
  } else {
    pushLog(s, `Lelang ${tile.name} tidak ada penawar.`, "info");
    if (a.forced) {
      const owner = s.players.find((p) => p.properties.includes(a.tile));
      if (owner) {
        const price = Math.floor((tile.price ?? 0) * 0.5);
        owner.cash += price;
        s.tiles[a.tile].owner = null;
        owner.properties = owner.properties.filter((id) => id !== a.tile);
        pushLog(s, `Bank membeli ${tile.name} dari ${owner.name} seharga Rp ${price}.`, "warn");
      }
    }
  }
  s.auction = null;
  s.phase = s.pendingRoll ? "await_roll" : "post_roll";
}

function checkMission(s: GameState) {
  if (!features(s).missions) return;
  for (const p of s.players) {
    if (p.bankrupt || p.missionDone) continue;
    if (missionMet(s, p)) {
      p.missionDone = true;
      p.cash += 150;
      pushLog(s, `Misi ${p.name} selesai! +Rp 150.`, "good");
    }
  }
}

export function missionMet(s: GameState, p: Player): boolean {
  switch (p.mission) {
    case "m_groups":
      return ownedGroupCount(s, p.id) >= 3;
    case "m_transport":
      return countTransport(s, p.id) >= 2;
    case "m_trades":
      return p.stats.trades >= 3;
    case "m_houses":
      return (Object.keys(GROUP_TILES) as GroupId[]).some(
        (g) => GROUP_TILES[g].some((id) => s.tiles[id].owner === p.id) && housesInGroup(s, g) >= 5,
      );
    case "m_cash":
      return s.round >= 11 && p.cash >= 2000;
    case "m_go":
      return p.stats.goPasses >= 4;
    case "m_auction":
      return p.stats.auctionsWon >= 2;
    case "m_hotel":
      return s.round < 12 && p.properties.some((id) => s.tiles[id].houses === 5);
    default:
      return false;
  }
}

function waveFor(round: number): 1 | 2 | 3 | 4 {
  if (round >= 16) return 4;
  if (round >= 12) return 3;
  if (round >= 6) return 2;
  return 1;
}

function startRound(s: GameState) {
  s.round += 1;
  s.wave = features(s).waves ? waveFor(s.round) : 1;
  s.shopBought = false;

  for (const e of s.effects) e.roundsLeft -= 1;
  s.effects = s.effects.filter((e) => e.roundsLeft > 0);
  s.event = null;

  if (features(s).events && s.round >= 6) {
    const every = s.wave >= 3 ? 1 : 2;
    if (s.round % every === 0) {
      const pool = s.wave >= 3 ? undefined : undefined;
      const ev = pick(s, [
        "ev_inflasi",
        "ev_resesi",
        "ev_banjir",
        "ev_festival",
        "ev_kemarau",
        "ev_boom",
        "ev_demo",
        ...(s.wave >= 3 ? ["ev_krisis"] : []),
      ] as string[]);
      applyEvent(s, ev);
    }
  }

  for (const p of living(s)) {
    const interestMult = effectMult(s, "interest_mult");
    const interest = p.loans.reduce((a, l) => a + l.principal * l.rate, 0) * interestMult;
    if (interest > 0) {
      pay(s, p, Math.round(interest), null, "bunga pinjaman");
      pushLog(s, `${p.name} membayar bunga pinjaman Rp ${Math.round(interest)}.`, "warn");
    }
  }

  if (features(s).tax && s.round >= 12) {
    for (const p of living(s)) {
      const landValue = p.properties.reduce((a, id) => a + (TILES[id].price ?? 0), 0);
      let tax = Math.floor((landValue * 0.05) / 10) * 10;
      if (p.character === "penjelajah") tax = Math.round(tax * 1.5);
      tax = Math.round(tax * effectMult(s, "tax_mult"));
      if (tax > 0) {
        pay(s, p, tax, null, "PBB");
        pushLog(s, `${p.name} membayar PBB Rp ${tax}.`, "warn");
      }
    }
  }

  if (features(s).solidarity && s.round >= 6 && s.round < s.settings.maxRounds) {
    const alive = living(s);
    if (alive.length > 1) {
      const poorest = alive.slice().sort((a, b) => netWorth(s, a) - netWorth(s, b))[0];
      poorest.cash += 150;
      pushLog(s, `Dana Solidaritas: ${poorest.name} menerima Rp 150.`, "good");
    }
  }

  if (features(s).shop) s.shop = pickShop(s);

  for (const p of living(s)) {
    const loanCap = s.wave === 1 ? 500 : 800;
    if (s.wave >= 4) {
      const due = p.loans.reduce((a, l) => a + l.principal, 0);
      if (due > 0) {
        pay(s, p, due, null, "jatuh tempo pinjaman");
        p.loans = [];
        pushLog(s, `${p.name} melunasi pinjaman Rp ${due} (jatuh tempo Krisis).`, "warn");
      }
    }
    if (p.loans.reduce((a, l) => a + l.principal, 0) > loanCap) {
      p.loans = [];
    }
  }

  pushLog(s, `Ronde ${s.round} dimulai.`, "info");
  checkMission(s);
}

function applyEvent(s: GameState, id: string) {
  switch (id) {
    case "ev_inflasi":
      addEffect(s, { kind: "rent_mult", mult: 1.25, roundsLeft: 2, label: "Inflasi +25% sewa" });
      s.event = { id, label: "Inflasi", text: "Semua sewa +25% selama 2 ronde." };
      break;
    case "ev_resesi":
      for (const p of living(s)) {
        const amount = Math.min(300, Math.round((p.cash * 0.05) / 10) * 10);
        pay(s, p, amount, null, "resesi");
      }
      addEffect(s, { kind: "shop_closed", roundsLeft: 1, label: "Pasar Loak tutup" });
      s.event = { id, label: "Resesi", text: "Semua pemain kehilangan 5% cash." };
      break;
    case "ev_banjir": {
      const groups = Object.keys(GROUP_TILES) as GroupId[];
      const group = pick(s, groups);
      addEffect(s, { kind: "no_rent_group", group, roundsLeft: 1, label: `Banjir di grup ${group}` });
      s.event = { id, label: "Banjir", text: "Satu grup kota tidak menghasilkan sewa." };
      break;
    }
    case "ev_festival":
      for (const p of living(s)) p.cash += 100;
      s.event = { id, label: "Festival Nusantara", text: "Semua pemain menerima Rp 100." };
      break;
    case "ev_kemarau":
      addEffect(s, { kind: "build_mult", mult: 1.5, roundsLeft: 2, label: "Bangun +50%" });
      s.event = { id, label: "Kemarau Panjang", text: "Biaya bangun +50%." };
      break;
    case "ev_boom":
      addEffect(s, { kind: "buy_discount", mult: 0.8, roundsLeft: 1, label: "Diskon beli 20%" });
      s.event = { id, label: "Boom Properti", text: "Harga beli properti −20%." };
      break;
    case "ev_demo":
      addEffect(s, { kind: "no_auction", roundsLeft: 1, label: "Lelang tutup" });
      addEffect(s, { kind: "no_trade", roundsLeft: 1, label: "Trade tutup" });
      s.event = { id, label: "Demonstrasi", text: "Lelang dan trade ditutup ronde ini." };
      break;
    case "ev_krisis":
      addEffect(s, { kind: "interest_mult", mult: 2, roundsLeft: 2, label: "Bunga ×2" });
      addEffect(s, { kind: "tax_mult", mult: 2, roundsLeft: 2, label: "PBB ×2" });
      s.event = { id, label: "Krisis Global", text: "Bunga dan PBB dua kali lipat." };
      break;
  }
  pushLog(s, `Peristiwa: ${s.event?.label}. ${s.event?.text}`, "warn");
}

function endTurn(s: GameState) {
  const p = current(s);
  p.goldenActive = false;
  s.offer = null;
  s.trade = null;
  s.dice = null;
  s.doubles = 0;
  s.pendingRoll = false;
  s.lastRent = null;

  const n = s.players.length;
  let idx = s.turnIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (!s.players[idx].bankrupt) break;
  }
  const wrapped = idx <= s.turnIndex;
  s.turnIndex = idx;

  if (wrapped) {
    if (s.round >= s.settings.maxRounds) {
      endByScore(s);
      return;
    }
    startRound(s);
  }

  s.phase = s.players[idx].inJail ? "jail" : "await_roll";
  s.dice = null;
  checkMission(s);
}

export function applyAction(prev: GameState, action: Action): GameState {
  const s: GameState = structuredClone(prev);
  s.version += 1;
  const p = current(s);

  if (s.phase === "game_over" && action.type !== "DISMISS") return prev;

  switch (action.type) {
    case "ROLL": {
      if (s.phase !== "await_roll" && s.phase !== "jail") break;
      if (s.offer || s.auction) break;
      const d1 = randInt(s, 1, 6);
      const d2 = randInt(s, 1, 6);
      s.dice = [d1, d2];
      const sum = d1 + d2;

      if (p.inJail) {
        if (d1 === d2) {
          p.inJail = false;
          p.jailTurns = 0;
          pushLog(s, `${p.name} keluar penjara dengan dobel!`, "good");
        } else {
          p.jailTurns += 1;
          if (p.jailTurns >= 3) {
            const fine = p.character === "bandar" ? 100 : 50;
            pay(s, p, fine, null, "denda penjara");
            p.inJail = false;
            p.jailTurns = 0;
            pushLog(s, `${p.name} gagal 3×, bayar Rp ${fine} dan keluar.`, "warn");
          } else {
            pushLog(s, `${p.name} gagal keluar penjara (${p.jailTurns}/3).`, "warn");
            s.phase = "post_roll";
            break;
          }
        }
      } else {
        if (d1 === d2) {
          s.doubles += 1;
          if (s.doubles >= 3) {
            pushLog(s, `${p.name} dobel 3× berturut-turut. Masuk penjara!`, "warn");
            sendToJail(s, p);
            s.pendingRoll = false;
            s.phase = "post_roll";
            break;
          }
          s.pendingRoll = true;
        } else {
          s.pendingRoll = false;
        }
      }

      moveTo(s, p, (p.position + sum) % 40);
      resolveTile(s, p);

      if ((s.phase as string) !== "game_over") {
        if (s.offer || s.auction) s.phase = "post_roll";
        else if (s.pendingRoll && !p.inJail) s.phase = "await_roll";
        else s.phase = "post_roll";
      }
      break;
    }

    case "BUY": {
      if (!s.offer || s.phase === "game_over") break;
      const tile = TILES[s.offer.tile];
      const price = s.offer.price;
      if (p.cash < price) break;
      p.cash -= price;
      assignTile(s, tile.id, p.id);
      pushLog(s, `${p.name} membeli ${tile.name} Rp ${price}.`, "money");
      s.offer = null;
      s.phase = s.pendingRoll ? "await_roll" : "post_roll";
      checkMission(s);
      break;
    }

    case "DECLINE": {
      if (!s.offer) break;
      const tileId = s.offer.tile;
      if (s.settings.auction && !hasEffect(s, "no_auction")) {
        startAuction(s, tileId);
      } else {
        pushLog(s, `${p.name} melewati ${TILES[tileId].name}.`);
        s.offer = null;
        s.phase = s.pendingRoll ? "await_roll" : "post_roll";
      }
      break;
    }

    case "BID": {
      const a = s.auction;
      if (!a) break;
      const actor = playerOf(s, a.current);
      if (!actor || actor.bankrupt) break;
      if (action.amount <= a.bid || action.amount > actor.cash) break;
      a.bid = Math.round(action.amount);
      a.leader = actor.id;
      const next = nextBidder(s);
      a.current = next;
      if (!next) finishAuction(s);
      break;
    }

    case "PASS_BID": {
      const a = s.auction;
      if (!a) break;
      const actor = playerOf(s, a.current);
      if (!actor) break;
      a.active = a.active.filter((id) => id !== actor.id);
      const next = nextBidder(s);
      a.current = next;
      if (a.active.length <= 1 || !next) finishAuction(s);
      break;
    }

    case "BUILD": {
      const tile = TILES[action.tile];
      if (!tile || tile.type !== "property" || s.tiles[tile.id].owner !== p.id) break;
      if (s.phase !== "post_roll") break;
      const st = s.tiles[tile.id];
      if (st.houses >= 5) break;
      if (!groupComplete(s, tile.group!, p.id)) break;
      if (st.houses === 4 && s.hotelsBank <= 0) break;
      if (st.houses < 4 && s.housesBank <= 0) break;
      const others = GROUP_TILES[tile.group!].filter((id) => id !== tile.id).map((id) => s.tiles[id].houses);
      const min = Math.min(...others);
      if (st.houses > min) break;
      const cost = buildCost(s, tile.id, p);
      if (p.cash < cost) break;
      p.cash -= cost;
      if (st.houses === 4) {
        s.housesBank += 4;
        s.hotelsBank -= 1;
        st.houses = 5;
      } else {
        s.housesBank -= 1;
        st.houses += 1;
      }
      pushLog(
        s,
        `${p.name} membangun ${st.houses === 5 ? "hotel" : `rumah ke-${st.houses}`} di ${tile.name} (Rp ${cost}).`,
        "money",
      );
      checkMission(s);
      break;
    }

    case "SELL_HOUSE": {
      const tile = TILES[action.tile];
      if (!tile || s.tiles[tile.id].owner !== p.id) break;
      const st = s.tiles[tile.id];
      if (st.houses <= 0) break;
      const others = GROUP_TILES[tile.group!].filter((id) => id !== tile.id).map((id) => s.tiles[id].houses);
      const max = Math.max(...others);
      if (st.houses < max) break;
      if (st.houses === 5) {
        st.houses = 4;
        s.hotelsBank += 1;
        s.housesBank -= 4;
      } else {
        st.houses -= 1;
        s.housesBank += 1;
      }
      p.cash += Math.floor((tile.houseCost ?? 0) / 2);
      pushLog(s, `${p.name} menjual bangunan di ${tile.name}.`, "money");
      break;
    }

    case "MORTGAGE": {
      const tile = TILES[action.tile];
      if (!tile || s.tiles[tile.id].owner !== p.id) break;
      if (s.tiles[tile.id].houses > 0) break;
      if (s.tiles[tile.id].mortgaged) break;
      s.tiles[tile.id].mortgaged = true;
      p.cash += Math.floor((tile.price ?? 0) / 2);
      pushLog(s, `${p.name} menggadaikan ${tile.name} (+Rp ${Math.floor((tile.price ?? 0) / 2)}).`, "money");
      break;
    }

    case "UNMORTGAGE": {
      const tile = TILES[action.tile];
      if (!tile || s.tiles[tile.id].owner !== p.id) break;
      if (!s.tiles[tile.id].mortgaged) break;
      const cost = Math.ceil(((tile.price ?? 0) / 2) * 1.1);
      if (p.cash < cost) break;
      p.cash -= cost;
      s.tiles[tile.id].mortgaged = false;
      pushLog(s, `${p.name} menebus ${tile.name} (Rp ${cost}).`, "money");
      break;
    }

    case "PAY_JAIL": {
      if (!p.inJail) break;
      const fine = p.character === "bandar" ? 100 : 50;
      if (p.cash < fine) break;
      pay(s, p, fine, null, "denda penjara");
      p.inJail = false;
      p.jailTurns = 0;
      s.phase = "await_roll";
      pushLog(s, `${p.name} membayar Rp ${fine} dan keluar penjara.`, "warn");
      break;
    }

    case "USE_JAIL_CARD": {
      if (!p.inJail || p.jailCards <= 0) break;
      p.jailCards -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      s.phase = "await_roll";
      pushLog(s, `${p.name} memakai surat bebas penjara.`, "good");
      break;
    }

    case "BUY_SHARE": {
      if (!features(s).shares || s.wave < 2) break;
      if (p.shares.includes(action.group)) break;
      const total = GROUP_TILES[action.group].reduce((a, id) => a + (TILES[id].price ?? 0), 0);
      const price = Math.round((total * 0.2) / 10) * 10;
      if (p.cash < price) break;
      p.cash -= price;
      p.shares.push(action.group);
      pushLog(s, `${p.name} membeli saham grup ${action.group} (Rp ${price}).`, "money");
      break;
    }

    case "SELL_SHARE": {
      if (!p.shares.includes(action.group)) break;
      const total = GROUP_TILES[action.group].reduce((a, id) => a + (TILES[id].price ?? 0), 0);
      const value = Math.round((total * 0.2) / 2 / 10) * 10;
      p.shares = p.shares.filter((g) => g !== action.group);
      p.cash += value;
      pushLog(s, `${p.name} menjual saham grup ${action.group} (+Rp ${value}).`, "money");
      break;
    }

    case "TAKE_LOAN": {
      if (!features(s).loans) break;
      const cap = s.wave === 1 ? 500 : 800;
      const existing = p.loans.reduce((a, l) => a + l.principal, 0);
      const amount = Math.max(0, Math.min(action.amount, cap - existing));
      if (amount < 100) break;
      p.cash += amount;
      p.loans.push({ id: `l${Date.now()}${p.loans.length}`, principal: amount, rate: p.character === "arsitek" ? 0.15 : 0.1 });
      pushLog(s, `${p.name} meminjam Rp ${amount} dari bank.`, "warn");
      break;
    }

    case "REPAY_LOAN": {
      const total = p.loans.reduce((a, l) => a + l.principal, 0);
      if (total <= 0) break;
      if (p.cash < total) break;
      p.cash -= total;
      p.loans = [];
      pushLog(s, `${p.name} melunasi pinjaman Rp ${total}.`, "money");
      break;
    }

    case "BUY_SHOP": {
      if (!features(s).shop || s.shopBought || hasEffect(s, "shop_closed")) break;
      const def = SHOP_CARDS.find((c) => c.id === action.card);
      if (!def || !s.shop.includes(def.id)) break;
      if (p.hand.length >= 2) break;
      const price = s.wave >= 3 ? def.priceLate : def.priceEarly;
      if (p.cash < price) break;
      p.cash -= price;
      s.shopBought = true;
      if (def.kind === "jail_free") p.jailCards += 1;
      else p.hand.push(def.id);
      pushLog(s, `${p.name} membeli ${def.name} (Rp ${price}).`, "money");
      break;
    }

    case "USE_CARD": {
      const idx = p.hand.indexOf(action.card);
      if (idx < 0) break;
      const def = SHOP_CARDS.find((c) => c.id === action.card);
      if (!def) break;
      if (def.kind === "promo") {
        if (action.target === undefined || s.tiles[action.target].owner !== p.id) break;
        addEffect(s, { kind: "rent_mult", mult: 3, roundsLeft: 1, label: "Promosi", tile: action.target });
        p.hand.splice(idx, 1);
        pushLog(s, `${p.name} memakai Promosi di ${TILES[action.target].name}.`, "good");
      } else if (def.kind === "audit") {
        const target = s.players.find((x) => x.id !== p.id && !x.bankrupt && x.name === action.target?.toString());
        const t = target ?? living(s).filter((x) => x.id !== p.id).sort((a, b) => b.cash - a.cash)[0];
        if (!t) break;
        const amount = Math.min(200, Math.round((t.cash * 0.1) / 10) * 10);
        t.cash -= amount;
        p.cash += amount;
        p.hand.splice(idx, 1);
        pushLog(s, `${p.name} mengaudit ${t.name} dan menerima Rp ${amount}.`, "money");
      } else if (def.kind === "legalitas") {
        if (action.target === undefined || s.tiles[action.target].owner !== p.id) break;
        const tile = TILES[action.target];
        const st = s.tiles[action.target];
        if (st.houses >= 5) break;
        if (st.houses === 4 && s.hotelsBank <= 0) break;
        if (st.houses < 4 && s.housesBank <= 0) break;
        const cost = buildCost(s, tile.id, p);
        if (p.cash < cost) break;
        p.cash -= cost;
        if (st.houses === 4) {
          s.housesBank += 4;
          s.hotelsBank -= 1;
          st.houses = 5;
        } else {
          s.housesBank -= 1;
          st.houses += 1;
        }
        p.hand.splice(idx, 1);
        pushLog(s, `${p.name} memakai Legalitas Cepat di ${tile.name}.`, "good");
      } else if (def.kind === "sogok") {
        const bad = s.effects.findIndex((e) => e.kind !== "rent_mult" || (e.mult ?? 1) > 1);
        if (bad >= 0) s.effects.splice(bad, 1);
        p.hand.splice(idx, 1);
        pushLog(s, `${p.name} menyogok untuk membatalkan satu efek.`, "good");
      } else if (def.kind === "operasi") {
        const target = action.target;
        if (target === undefined || !s.tiles[target].owner || s.tiles[target].houses > 0) break;
        p.hand.splice(idx, 1);
        startAuction(s, target, true);
        pushLog(s, `${p.name} memicu Operasi Pasar pada ${TILES[target].name}.`, "warn");
      }
      break;
    }

    case "DECLARE_GOLDEN": {
      if (!features(s).golden || p.goldenUsed || p.goldenActive) break;
      if (s.phase !== "await_roll") break;
      p.goldenUsed = true;
      p.goldenActive = true;
      pushLog(s, `${p.name} mengaktifkan Giliran Emas!`, "good");
      break;
    }

    case "TRADE_OFFER": {
      if (hasEffect(s, "no_trade")) break;
      const isCounter = Boolean(s.trade && s.trade.to === action.offer.from);
      const sender = isCounter ? playerOf(s, action.offer.from) : p;
      if (!sender || sender.bankrupt) break;
      if (!isCounter && action.offer.from !== p.id) break;
      if (action.offer.giveCash > sender.cash) break;
      const target = playerOf(s, action.offer.to);
      if (!target || target.bankrupt || target.id === sender.id) break;
      if (action.offer.wantCash > target.cash) break;
      if (target.character === "diplomat" && target.hand.includes("veto")) break;
      s.trade = action.offer;
      s.phase = "post_roll";
      sender.stats.tradeAttempts += 1;
      pushLog(
        s,
        isCounter
          ? `${sender.name} mengajukan tawaran balik ke ${target.name}.`
          : `${sender.name} mengajukan tawaran dagang ke ${target.name}.`,
      );
      break;
    }

    case "TRADE_RESPOND": {
      const offer = s.trade;
      if (!offer) break;
      const from = playerOf(s, offer.from);
      const to = playerOf(s, offer.to);
      if (!from || !to || to.bankrupt) break;
      if (!action.accept) {
        pushLog(s, `${to.name} menolak tawaran ${from.name}.`);
        s.trade = null;
        break;
      }
      if (from.cash < offer.giveCash || to.cash < offer.wantCash) {
        pushLog(s, `Tawaran ${from.name} batal: dana tidak cukup.`, "warn");
        s.trade = null;
        break;
      }
      from.cash -= offer.giveCash;
      to.cash += offer.giveCash;
      to.cash -= offer.wantCash;
      from.cash += offer.wantCash;
      for (const id of offer.giveProps) {
        if (s.tiles[id].owner !== from.id || s.tiles[id].houses > 0) continue;
        s.tiles[id].owner = to.id;
        from.properties = from.properties.filter((x) => x !== id);
        to.properties.push(id);
      }
      for (const id of offer.wantProps) {
        if (s.tiles[id].owner !== to.id || s.tiles[id].houses > 0) continue;
        s.tiles[id].owner = from.id;
        to.properties = to.properties.filter((x) => x !== id);
        from.properties.push(id);
      }
      from.stats.trades += 1;
      to.stats.trades += 1;
      s.trade = null;
      pushLog(s, `Kesepakatan: ${from.name} dan ${to.name} menyelesaikan transaksi.`, "good");
      checkMission(s);
      break;
    }

    case "CLAIM_MISSION":
      checkMission(s);
      break;

    case "END_TURN": {
      if (s.phase === "auction" || s.trade || s.offer) break;
      endTurn(s);
      break;
    }

    case "SURRENDER": {
      bankrupt(s, p, null);
      s.trade = null;
      s.offer = null;
      if (s.phase !== "game_over") endTurn(s);
      break;
    }

    case "DISMISS":
      s.offer = null;
      break;
  }

  return s;
}

export const SHOP_LOOKUP: Record<string, ShopCardDef> = Object.fromEntries(
  SHOP_CARDS.map((c) => [c.id, c]),
);

export const MISSIONS_LOOKUP = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
