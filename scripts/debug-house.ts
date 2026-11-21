import { applyAction } from "../src/engine/actions";
import { botAction } from "../src/engine/bot";
import { createGame, defaultSettings } from "../src/engine/create";
import { TILES } from "../src/engine/data";
import type { Preset } from "../src/engine/types";

function audit(s: ReturnType<typeof createGame>, label: string) {
  const housesOnBoard = TILES.reduce((a, t) => a + (s.tiles[t.id].houses === 5 ? 0 : s.tiles[t.id].houses), 0);
  const hotelsOnBoard = TILES.filter((t) => s.tiles[t.id].houses === 5).length;
  const expectedHouses = 32 - housesOnBoard;
  const expectedHotels = 12 - hotelsOnBoard;
  if (s.housesBank !== expectedHouses || s.hotelsBank !== expectedHotels) {
    console.log(
      `${label}: bank=${s.housesBank} expected=${expectedHouses} | hotels=${s.hotelsBank} expected=${expectedHotels}`,
    );
    return false;
  }
  return true;
}

for (let g = 0; g < 150; g++) {
  const preset: Preset = (["klasik", "standar", "penuh"] as Preset[])[g % 3];
  const seats = 2 + (g % 3);
  let s = createGame(
    { ...defaultSettings(), preset, players: seats, turnTimer: 0 },
    [0, 1, 2, 3].slice(0, seats).map((i) => ({ name: `B${i}`, isBot: true })),
    1000 + g * 7919,
  );
  let steps = 0;
  let ok = audit(s, `g${g} start`);
  let lastAction = "init";
  while (s.phase !== "game_over" && steps < 5000) {
    const action = botAction(s) ?? { type: "END_TURN" as const };
    lastAction = JSON.stringify(action);
    s = applyAction(s, action);
    steps++;
    if (!audit(s, `g${g} step${steps} ${lastAction}`)) {
      ok = false;
      console.log("  round", s.round, "phase", s.phase, "players", s.players.map((p) => `${p.name}:${p.cash}`).join(","));
      break;
    }
  }
  if (!ok) process.exit(1);
}
console.log("house ledger ok");
