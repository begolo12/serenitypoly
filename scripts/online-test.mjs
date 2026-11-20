const BASE = process.argv[2] ?? "http://localhost:3000";

async function j(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

async function main() {
  const created = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Host Test", settings: { preset: "standar" } }),
  }).then(j);
  if (!created.code) throw new Error("create failed " + JSON.stringify(created));
  console.log("room", created.code, "host", created.playerId);

  const joined = await fetch(`${BASE}/api/rooms/${created.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Tamu Test" }),
  }).then(j);
  if (!joined.playerId) throw new Error("join failed " + JSON.stringify(joined));
  console.log("joined", joined.playerId);

  const p1 = { playerId: created.playerId, token: created.token };
  const p2 = { playerId: joined.playerId, token: joined.token };

  for (const p of [p1, p2]) {
    const r = await fetch(`${BASE}/api/rooms/${created.code}/ready`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...p, ready: true }),
    }).then(j);
    if (!r.room) throw new Error("ready failed " + JSON.stringify(r));
  }
  console.log("ready ok");

  const started = await fetch(`${BASE}/api/rooms/${created.code}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(p1),
  }).then(j);
  if (!started.ok) throw new Error("start failed " + JSON.stringify(started));
  console.log("started", started.gameId);

  let game = await fetch(`${BASE}/api/games/${created.code}`).then(j);
  if (!game.state) throw new Error("no state " + JSON.stringify(game));
  console.log("version", game.version, "phase", game.state.phase, "turn", game.state.turnIndex);
  console.log("players", game.state.players.map((p) => p.name).join(", "));

  // mainkan beberapa giliran: yang bukan giliran mencoba aksi, harus ditolak
  const ids = [p1, p2];
  const meId = game.state.players[game.state.turnIndex].id;

  // aksi ilegal dari pemain yang bukan giliran
  const wrong = ids.find((p) => p.playerId !== meId) ?? p1;
  const rejected = await fetch(`${BASE}/api/games/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...wrong, action: { type: "ROLL" } }),
  });
  console.log("aksi di luar giliran ->", rejected.status, "(harus 409)");

  // aksi legal
  const actor = ids.find((p) => p.playerId === meId) ?? p1;
  const acted = await fetch(`${BASE}/api/games/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...actor, action: { type: "ROLL" } }),
  }).then(j);
  if (!acted.state) throw new Error("roll failed " + JSON.stringify(acted));
  console.log("roll ok, dice", acted.state.dice, "pos", acted.state.players[0].position, "version", acted.version);

  // polling tidak berubah
  const poll = await fetch(`${BASE}/api/games/${created.code}?since=${acted.version}`).then(j);
  console.log("poll since version ->", poll.unchanged === true ? "unchanged (ok)" : JSON.stringify(poll).slice(0, 120));

  // token salah
  const bad = await fetch(`${BASE}/api/games/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...actor, token: "salah", action: { type: "END_TURN" } }),
  });
  console.log("token salah ->", bad.status, "(harus 403)");

  console.log("\nE2E online OK");
}

main().catch((err) => {
  console.error("GAGAL:", err.message);
  process.exit(1);
});
