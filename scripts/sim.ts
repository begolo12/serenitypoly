import { applyAction } from "../src/engine/actions";
import { botAction } from "../src/engine/bot";
import { createGame, defaultSettings } from "../src/engine/create";
import { TILES } from "../src/engine/data";
import type { GameState, Preset } from "../src/engine/types";
import { scoreOf } from "../src/engine/actions";

type Result = {
  rounds: number;
  end: "bankrupt" | "score";
  winner: string;
  score: number;
  cashLeft: number;
  errors: string[];
};

function checkInvariants(s: GameState, errors: string[]) {
  if (s.housesBank < 0 || s.housesBank > 32) errors.push(`housesBank ${s.housesBank}`);
  if (s.hotelsBank < 0 || s.hotelsBank > 12) errors.push(`hotelsBank ${s.hotelsBank}`);
  const boardHouses = TILES.reduce((a, t) => a + (s.tiles[t.id].houses === 5 ? 0 : s.tiles[t.id].houses), 0);
  const boardHotels = TILES.filter((t) => s.tiles[t.id].houses === 5).length;
  if (s.housesBank + boardHouses !== 32) errors.push(`house ledger ${s.housesBank}+${boardHouses}!=32`);
  if (s.hotelsBank + boardHotels !== 12) errors.push(`hotel ledger ${s.hotelsBank}+${boardHotels}!=12`);
  const owners = new Map<string, Set<number>>();
  for (const p of s.players) {
    if (p.cash < 0) errors.push(`cash<0 ${p.name} ${p.cash}`);
    if (p.bankrupt && (p.cash !== 0 || p.properties.length > 0)) {
      errors.push(`bankrupt state ${p.name} cash=${p.cash} props=${p.properties.length}`);
    }
    if (p.inJail && p.position !== 10) errors.push(`jail position ${p.name} ${p.position}`);
    if (p.hand.length > 2) errors.push(`hand ${p.name} ${p.hand.length}`);
    owners.set(p.id, new Set());
  }
  if ((s.phase === "auction") !== (s.auction !== null)) {
    errors.push(`auction/phase mismatch ${s.phase}/${s.auction ? "auction" : "null"}`);
  }
  if ((s.winner !== null) !== (s.phase === "game_over")) {
    errors.push(`winner/phase mismatch winner=${s.winner} phase=${s.phase}`);
  }
  if (s.round > s.settings.maxRounds) errors.push(`round ${s.round}>${s.settings.maxRounds}`);
  for (const p of s.players) {
    for (const id of p.properties) {
      if (owners.get(p.id)!.has(id)) errors.push(`duplicate prop ${p.name} ${TILES[id].name}`);
      owners.get(p.id)!.add(id);
      if (s.tiles[id].owner !== p.id) errors.push(`owner mismatch ${TILES[id].name}`);
    }
  }
  for (let i = 0; i < 40; i++) {
    const st = s.tiles[i];
    if (st.houses < 0 || st.houses > 5) errors.push(`houses ${TILES[i].name} ${st.houses}`);
    if (st.mortgaged && st.houses > 0) errors.push(`mortgaged with houses ${TILES[i].name}`);
    if (st.owner && !owners.get(st.owner)?.has(i)) errors.push(`owner not in list ${TILES[i].name}`);
    if (!st.owner && st.houses > 0) errors.push(`houses without owner ${TILES[i].name}`);
  }
  if (s.players.filter((p) => !p.bankrupt).length === 0) errors.push("no living players");
}

function runGame(preset: Preset, seats: number, seed: number): Result {
  const settings = { ...defaultSettings(), preset, players: seats, turnTimer: 0 };
  let s = createGame(
    settings,
    Array.from({ length: seats }, (_, i) => ({ name: `B${i}`, isBot: true })),
    seed,
  );
  const errors: string[] = [];
  let steps = 0;
  let stuckKey = "";
  let stuckCount = 0;

  while (s.phase !== "game_over" && steps < 30000) {
    const action = botAction(s);
    const next = applyAction(s, action ?? { type: "END_TURN" });
    steps++;
    if (next.phase === s.phase && next.turnIndex === s.turnIndex && next.round === s.round) {
      const key = `${s.phase}:${s.turnIndex}:${s.round}:${s.players[s.turnIndex].cash}`;
      if (key === stuckKey) stuckCount++;
      else {
        stuckKey = key;
        stuckCount = 0;
      }
      if (stuckCount > 300) {
        errors.push(`stuck in ${s.phase} turn ${s.turnIndex}`);
        break;
      }
    } else {
      stuckKey = "";
      stuckCount = 0;
    }
    s = next;
    if (steps % 25 === 0) checkInvariants(s, errors);
    if (errors.length > 4) break;
  }

  checkInvariants(s, errors);
  if (s.phase !== "game_over") errors.push("game did not finish");

  const alive = s.players.filter((p) => !p.bankrupt);
  const winner = s.players.find((p) => p.id === s.winner) ?? alive[0] ?? s.players[0];
  return {
    rounds: s.round,
    end: alive.length === 1 ? "bankrupt" : "score",
    winner: winner?.name ?? "?",
    score: winner ? scoreOf(s, winner) : 0,
    cashLeft: winner?.cash ?? 0,
    errors,
  };
}

const presets: Preset[] = ["klasik", "standar", "penuh"];
const counts: Record<string, number> = {};
const results: Result[] = [];
const t0 = Date.now();
const N = Number(process.argv[2] ?? 150);

for (let i = 0; i < N; i++) {
  const preset = presets[i % presets.length];
  const seats = 2 + (i % 3);
  const r = runGame(preset, seats, 1000 + i * 7919);
  results.push(r);
  counts[r.end] = (counts[r.end] ?? 0) + 1;
}

const errors = results.flatMap((r) => r.errors);
const rounds = results.map((r) => r.rounds).sort((a, b) => a - b);
const median = rounds[Math.floor(rounds.length / 2)];
const avg = results.reduce((a, r) => a + r.rounds, 0) / results.length;

console.log(`games: ${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`median rounds: ${median} · avg: ${avg.toFixed(2)} · min ${rounds[0]} · max ${rounds[rounds.length - 1]}`);
console.log(`end:`, counts);
console.log(`errors: ${errors.length}`);
for (const e of errors.slice(0, 15)) console.log("  -", e);
if (errors.length > 0) process.exit(1);
