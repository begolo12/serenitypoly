import { applyAction } from "../src/engine/actions";
import { botAction } from "../src/engine/bot";
import { createGame, defaultSettings } from "../src/engine/create";
import type { Preset } from "../src/engine/types";

for (let g = 0; g < 300; g++) {
  const preset: Preset = (["klasik", "standar", "penuh"] as Preset[])[g % 3];
  const seats = 2 + (g % 3);
  let s = createGame(
    { ...defaultSettings(), preset, players: seats, turnTimer: 0 },
    [0, 1, 2, 3].slice(0, seats).map((i) => ({ name: `B${i}`, isBot: true })),
    1000 + g * 7919,
  );
  const history: string[] = [];
  let steps = 0;
  let stuck = 0;
  let lastKey = "";
  while (s.phase !== "game_over" && steps < 3000) {
    const a = botAction(s);
    const key = `${s.phase}|${s.turnIndex}|${s.round}|${a ? JSON.stringify(a) : "null"}`;
    if (key === lastKey) stuck++;
    else {
      lastKey = key;
      stuck = 0;
    }
    if (stuck > 3) {
      console.log(`game ${g} preset ${preset} seats ${seats} stuck`);
      console.log("key:", key);
      console.log("trade:", JSON.stringify(s.trade));
      console.log("offer:", JSON.stringify(s.offer));
      console.log("auction:", JSON.stringify(s.auction));
      console.log("phase:", s.phase, "turn", s.turnIndex, "round", s.round);
      console.log("players:", s.players.map((p) => `${p.name} cash=${p.cash} att=${p.stats.tradeAttempts} props=${p.properties.length}`).join(" | "));
      console.log("history:", history.slice(-8));
      process.exit(0);
    }
    history.push(key);
    s = applyAction(s, a ?? { type: "END_TURN" });
    steps++;
  }
}
console.log("no stuck found");
