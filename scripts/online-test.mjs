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

  const p1 = { playerId: created.playerId, token: created.token, reconnectKey: created.reconnectKey };
  const p2 = {
    playerId: joined.playerId,
    token: joined.token,
    reconnectKey: joined.reconnectKey,
  };

  // kunci pemulihan: cocok → dapat token, tanpa kunci → ditolak
  const recovered = await fetch(`${BASE}/api/rooms/${created.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: p2.playerId, reconnectKey: p2.reconnectKey }),
  }).then(j);
  console.log("reconnect kunci benar ->", recovered.token === p2.token ? "ok" : "GAGAL");
  if (recovered.token !== p2.token) throw new Error("reconnect gagal " + JSON.stringify(recovered));

  const hijack = await fetch(`${BASE}/api/rooms/${created.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: p2.playerId, reconnectKey: "kunci-palsu" }),
  });
  console.log("klaim kursi kunci palsu ->", hijack.status, "(harus 403)");
  if (hijack.status !== 403) throw new Error("IDOR kursi masih terbuka");

  // room terpisah: klaim kursi tanpa kunci apa pun tidak boleh mengembalikan token kursi lama
  const probe = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Probe Host" }),
  }).then(j);
  const victim = await fetch(`${BASE}/api/rooms/${probe.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Korban" }),
  }).then(j);
  const steal = await fetch(`${BASE}/api/rooms/${probe.code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: victim.playerId }),
  }).then(j);
  const stolen = steal.token === victim.token || steal.playerId === victim.playerId;
  console.log("klaim kursi tanpa kunci ->", stolen ? "BOCOR" : "kursi baru (ok)");
  if (stolen) throw new Error("IDOR kursi masih terbuka");

  for (const p of [p1, p2]) {
    const r = await fetch(`${BASE}/api/rooms/${created.code}/ready`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...p, ready: true }),
    }).then(j);
    if (!r.room) throw new Error("ready failed " + JSON.stringify(r));
  }
  console.log("ready ok");
  const lobby = await fetch(`${BASE}/api/rooms/${created.code}`).then(j);
  if (!lobby.room?.seats?.every((s) => s.ready)) {
    throw new Error("status ready tidak tersimpan " + JSON.stringify(lobby.room?.seats));
  }
  console.log("ready tersimpan di server -> ok");

  // start oleh bukan host harus ditolak
  const badStart = await fetch(`${BASE}/api/rooms/${created.code}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(p2),
  });
  console.log("start bukan host ->", badStart.status, "(harus 403)");
  if (badStart.status !== 403) throw new Error("start tanpa host terbuka");

  const started = await fetch(`${BASE}/api/rooms/${created.code}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...p1, forceReady: true }),
  }).then(j);
  if (!started.ok) throw new Error("start failed " + JSON.stringify(started));
  console.log("started", started.gameId);

  // rematch saat game masih berjalan harus ditolak
  const earlyRematch = await fetch(`${BASE}/api/rooms/${created.code}/rematch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(p1),
  });
  console.log("rematch saat bermain ->", earlyRematch.status, "(harus 409)");
  if (earlyRematch.status !== 409) throw new Error("rematch bisa mereset game berjalan");

  // bypass TV tanpa hostToken harus ditolak
  const fakeRematch = await fetch(`${BASE}/api/rooms/${created.code}/rematch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fromTv: true }),
  });
  console.log("rematch fromTv ->", fakeRematch.status, "(harus 403)");

  const fakeBot = await fetch(`${BASE}/api/games/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tv: true, action: { type: "BOT_STEP" } }),
  });
  console.log("bot step tv tanpa token ->", fakeBot.status, "(harus 403)");

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
  console.log("aksi di luar giliran ->", rejected.status, "(harus 403)");

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

  // redaksi: RNG & misi lawan tidak boleh bocor, misi sendiri tetap terlihat
  const priv = await fetch(`${BASE}/api/games/${created.code}`, {
    headers: { "x-sp-player": p1.playerId, "x-sp-token": p1.token },
  }).then(j);
  const mine = priv.state?.players?.find((p) => p.id === p1.playerId);
  const other = priv.state?.players?.find((p) => p.id !== p1.playerId);
  console.log("rng publik ->", priv.state?.rng === 0 ? "tersembunyi (ok)" : "BOCOR");
  console.log("misi sendiri ->", mine?.mission ? "terlihat (ok)" : "HILANG");
  console.log("misi lawan ->", other?.mission === "" ? "tersembunyi (ok)" : "BOCOR");

  // quick chat: preset diterima, teks bebas ditolak, rate limit 429
  const chatRes = await fetch(`${BASE}/api/chats/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...p1, text: "GG, seru banget! 🏆" }),
  });
  const chatBody = await chatRes.json();
  console.log("chat preset ->", chatRes.status, "(harus 200)");
  if (chatRes.status !== 200) throw new Error("chat gagal " + JSON.stringify(chatBody));

  const chatList = await fetch(`${BASE}/api/chats/${created.code}`).then(j);
  if (!chatList.messages?.some((m) => m.text.includes("GG, seru"))) {
    throw new Error("chat tidak tersimpan " + JSON.stringify(chatList).slice(0, 160));
  }
  console.log("chat tersimpan ->", chatList.messages.length, "pesan");

  const freeText = await fetch(`${BASE}/api/chats/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...p2, text: "halo bebas tanpa preset" }),
  });
  console.log("chat bebas ->", freeText.status, "(harus 400)");

  const spam = await fetch(`${BASE}/api/chats/${created.code}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...p1, text: "Hoki banget dadunya 🎲" }),
  });
  console.log("chat rate limit ->", spam.status, "(harus 429)");

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
