"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHARACTERS, PAWN_NAMES, PLAYER_COLORS, PRESET_FEATURES, WAVE_LABEL } from "@/engine/data";
import type { CharacterId, Mode, Preset, Settings } from "@/engine/types";
import { defaultSettings, type SeatConfig } from "@/engine/create";
import { PawnAvatar } from "@/components/game/CityArt";
import { Button, Chip } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import { initMute } from "@/lib/sfx";

const PRESETS: { id: Preset; name: string; desc: string }[] = [
  { id: "pemula", name: "Pemula", desc: "Aturan inti yang santai. Tanpa batas waktu giliran." },
  { id: "klasik", name: "Klasik", desc: "Gelombang ekonomi + penentuan skor akhir di ronde 17." },
  { id: "standar", name: "Standar", desc: "Karakter unik, misi rahasia, pinjaman, saham & peristiwa." },
  { id: "penuh", name: "Penuh", desc: "Semua fitur aktif: Pasar Loak, PBB, Operasi Pasar, Giliran Emas." },
];

const MODES: {
  id: Mode;
  name: string;
  desc: string;
  badge: string;
  icon: string;
  cardCls: string;
  tilt: string;
}[] = [
  {
    id: "bot",
    name: "Solo vs Bot",
    desc: "Lawan 1–3 bot pintar tanpa butuh internet.",
    badge: "Offline",
    icon: "🤖",
    cardCls: "bg-sun text-ink",
    tilt: "lg:-rotate-1",
  },
  {
    id: "hotseat",
    name: "Satu Perangkat",
    desc: "2–4 pemain bergiliran di layar yang sama.",
    badge: "Lokal",
    icon: "👥",
    cardCls: "bg-blue text-white",
    tilt: "lg:rotate-1",
  },
  {
    id: "controller",
    name: "Papan + HP",
    desc: "Papan di TV/laptop, tiap HP jadi kontroler via QR.",
    badge: "Party TV",
    icon: "📱",
    cardCls: "bg-mint text-ink",
    tilt: "lg:-rotate-1",
  },
  {
    id: "online",
    name: "Main Online",
    desc: "Buat kode room dan main jarak jauh bareng teman.",
    badge: "Room",
    icon: "🌐",
    cardCls: "bg-tomato text-white",
    tilt: "lg:rotate-1",
  },
];

const FEATURE_LABELS: Record<string, string> = {
  waves: "4 Gelombang",
  characters: "Karakter",
  missions: "Misi Rahasia",
  loans: "Pinjaman Bank",
  shares: "Saham Grup",
  events: "Peristiwa",
  shop: "Pasar Loak",
  tax: "PBB",
  solidarity: "Dana Solidaritas",
  golden: "Giliran Emas",
};

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("bot");
  const [players, setPlayers] = useState(4);
  const [preset, setPreset] = useState<Preset>("standar");
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const [seatChars, setSeatChars] = useState<Array<CharacterId | "random">>(["random", "random", "random", "random"]);
  const [seatTokens, setSeatTokens] = useState<number[]>([0, 1, 2, 3]);
  const [openPawnSeat, setOpenPawnSeat] = useState<number | null>(null);
  const [showHouseRules, setShowHouseRules] = useState(false);
  const [startCash, setStartCash] = useState(1500);
  const [maxRounds, setMaxRounds] = useState(17);
  const [freeParkingPot, setFreeParkingPot] = useState(false);
  const [doubleRent, setDoubleRent] = useState(false);
  const [auction, setAuction] = useState(true);
  const [hasSave, setHasSave] = useState(false);
  const [hostName, setHostName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [netErr, setNetErr] = useState("");

  useEffect(() => {
    initMute();
    setHasSave(!!localStorage.getItem("sp-game"));
  }, []);

  const seats: SeatConfig[] = useMemo(() => {
    return Array.from({ length: players }, (_, i) => ({
      name: names[i]?.trim() || (mode === "bot" && i > 0 ? `Bot ${i}` : `Pemain ${i + 1}`),
      isBot: mode === "bot" && i > 0,
      character: seatChars[i] === "random" ? undefined : seatChars[i],
      tokenIndex: seatTokens[i],
    }));
  }, [players, names, mode, seatChars, seatTokens]);

  const start = () => {
    const base = defaultSettings();
    const settings: Settings = {
      ...base,
      mode,
      preset,
      players,
      startCash,
      auction,
      freeParkingPot,
      doubleRent,
      turnTimer: preset === "pemula" ? 0 : 45,
      maxRounds,
    };
    sessionStorage.setItem("sp-setup", JSON.stringify({ settings, seats }));
    sessionStorage.setItem("sp-new", "1");
    sessionStorage.removeItem("sp-resume");
    router.push("/play");
  };

  const resume = () => {
    sessionStorage.setItem("sp-resume", "1");
    router.push("/play");
  };

  const createRoom = async (tv: boolean) => {
    setBusy(true);
    setNetErr("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tv,
          name: hostName.trim() || names[0]?.trim() || "Pemain 1",
          character: seatChars[0] === "random" ? undefined : seatChars[0],
          tokenIndex: seatTokens[0],
          settings: { preset, players: 4, startCash, maxRounds, freeParkingPot, doubleRent, auction },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat room");
      if (tv) {
        localStorage.setItem(`sp-host-${data.code}`, data.hostToken);
        router.push(`/watch/${data.code}`);
      } else {
        localStorage.setItem(
          `sp-seat-${data.code}`,
          JSON.stringify({ playerId: data.playerId, token: data.token }),
        );
        router.push(`/room/${data.code}`);
      }
    } catch (e) {
      setNetErr(e instanceof Error ? e.message : "Gagal membuat room");
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = (asTv = false) => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setNetErr("Kode room minimal 4 karakter");
      return;
    }
    router.push(asTv ? `/watch/${code}` : `/room/${code}`);
  };

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* Top Navbar */}
      <nav className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[3px] border-ink bg-sun text-xl">
            🎲
          </span>
          <span className="font-display text-2xl font-extrabold tracking-[-0.5px]">
            Serenity<span className="text-tomato">Poly</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/rules" className="btn px-4 py-2 text-sm">
            📖 Buku Aturan
          </Link>
          {hasSave ? (
            <Button variant="primary" className="px-5 py-2 text-sm" onClick={resume}>
              ▶ Lanjutkan Game
            </Button>
          ) : null}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="mx-auto w-full max-w-[1280px] px-5 pb-10 pt-2 sm:px-8 sm:pb-12 sm:pt-4">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <span className="sticker -rotate-2 bg-sun text-sm text-ink">
              NUSANTARA MONOPOLY ✦ 2–4 PEMAIN
            </span>

            <h1 className="mt-4 font-display text-[44px] font-extrabold leading-[1.03] tracking-[-2px] sm:text-[64px] sm:tracking-[-2.5px]">
              Keliling Nusantara,{" "}
              <span className="relative inline-block">
                <span className="absolute inset-x-0 bottom-1 h-4 -rotate-1 rounded-lg bg-sun sm:h-6" />
                <span className="relative text-tomato">bangun kotamu.</span>
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Dari Sabang sampai Jayapura — 22 kota ikonik Indonesia, 8 grup warna, 4 gelombang ekonomi, dan mode papan TV dengan kontroler HP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="chip bg-mint-pale px-3.5 py-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-mint" />
              22 Kota Nusantara
            </span>
            <span className="chip bg-blue-pale px-3.5 py-2 text-sm">
              📺 Mode TV + QR HP
            </span>
          </div>
        </div>
      </header>

      {/* Mode Selection — 4 Playful Tilted Bento Cards */}
      <section className="bg-tint py-10 sm:py-12">
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8">
          <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <div className="text-xs font-bold uppercase tracking-[1.5px] text-blue">Pilih cara bermain</div>
              <h2 className="mt-1 font-display text-3xl font-extrabold tracking-[-1px] sm:text-4xl">
                Mau main bareng siapa hari ini?
              </h2>
            </div>
            <p className="text-sm font-medium text-ink-soft">
              Klik salah satu mode di bawah untuk mengatur permainan.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "relative flex flex-col justify-between gap-4 rounded-[26px] border-[3px] border-ink p-5 text-left transition-all duration-200",
                    active ? `${m.cardCls} -translate-y-1.5 scale-[1.02]` : "bg-white text-ink hover:bg-white/90",
                    active && m.tilt,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border-[2.5px] border-ink bg-white text-xl text-ink">
                      {m.icon}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold",
                        active ? "bg-white text-ink" : "bg-tint text-ink-soft",
                      )}
                    >
                      {active ? "✓ Dipilih" : m.badge}
                    </span>
                  </div>

                  <div>
                    <div className="font-display text-xl font-extrabold leading-tight tracking-tight">{m.name}</div>
                    <p className={cn("mt-1 text-sm font-medium leading-snug", active ? "opacity-90" : "text-ink-soft")}>
                      {m.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Online / Papan + HP Bento Panel */}
          {(mode === "online" || mode === "controller") && (
            <div className="panel mt-6 p-5 sm:p-7 animate-[pop_0.24s_var(--ease-out-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="sticker -rotate-1 bg-mint-pale text-xs text-ink">
                    {mode === "controller" ? "Mode Party TV + HP" : "Multiplayer Jarak Jauh"}
                  </span>
                  <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight">
                    {mode === "online" ? "Buat atau gabung room online" : "Papan di Laptop / TV, Kontroler di HP"}
                  </h3>
                </div>
                <Chip color="#2FD592">Server Siap</Chip>
              </div>

              {mode === "controller" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border-[2.5px] border-ink bg-sun-pale p-3.5">
                    <div className="font-display text-sm font-extrabold">1. Buka papan di TV / laptop</div>
                    <p className="mt-1 text-xs font-medium text-ink-soft">
                      Klik tombol buat papan tunggu di bawah untuk menampilkan QR dan kode room.
                    </p>
                  </div>
                  <div className="rounded-2xl border-[2.5px] border-ink bg-blue-pale p-3.5">
                    <div className="font-display text-sm font-extrabold">2. Scan QR atau ketik kode</div>
                    <p className="mt-1 text-xs font-medium text-ink-soft">
                      Sampai 4 pemain gabung lewat HP masing-masing (bisa tambah Bot juga).
                    </p>
                  </div>
                  <div className="rounded-2xl border-[2.5px] border-ink bg-mint-pale p-3.5">
                    <div className="font-display text-sm font-extrabold">3. Main bersama di satu layar</div>
                    <p className="mt-1 text-xs font-medium text-ink-soft">
                      Papan utama animasi penuh di TV, lempar dadu &amp; beli kota langsung dari HP!
                    </p>
                  </div>
                </div>
              ) : null}

              {netErr ? (
                <div className="mt-4 rounded-2xl border-[2.5px] border-ink bg-tomato-pale px-4 py-2.5 text-sm font-bold text-ink">
                  ⚠️ {netErr}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border-[2.5px] border-ink bg-tint p-4">
                  <div className="text-xs font-bold uppercase tracking-[1.2px] text-ink-soft">Buat room baru</div>
                  {mode === "online" ? (
                    <input
                      className="field mt-2.5 w-full text-sm"
                      placeholder="Nama panggilanmu"
                      maxLength={20}
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                    />
                  ) : null}
                  <Button
                    variant="primary"
                    className="mt-3 w-full text-sm"
                    disabled={busy}
                    onClick={() => createRoom(mode === "controller")}
                  >
                    {busy
                      ? "Membuat room…"
                      : mode === "online"
                        ? "Buat Room Online →"
                        : "📺 Buat Papan Tunggu di Layar Ini →"}
                  </Button>
                </div>

                <div className="rounded-[22px] border-[2.5px] border-ink bg-tint p-4">
                  <div className="text-xs font-bold uppercase tracking-[1.2px] text-ink-soft">Sudah punya kode?</div>
                  <input
                    className="field mt-2.5 w-full font-mono text-sm uppercase tracking-[0.2em]"
                    placeholder="Ketik 6 huruf kode room"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") joinRoom(false);
                    }}
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button variant="mint" className="w-full text-xs" onClick={() => joinRoom(false)}>
                      📱 Gabung Kontroler (HP)
                    </Button>
                    <Button className="w-full text-xs" onClick={() => joinRoom(true)}>
                      📺 Layar Papan (TV)
                    </Button>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs font-semibold text-ink-soft">
                Aturan yang dipakai untuk room ini: <b className="text-ink">{PRESETS.find((x) => x.id === preset)?.name}</b> · Maksimal 4 pemain.
              </p>
            </div>
          )}

          {/* Setup Bento Grid (Players & Rules) */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: Pemain */}
            <div className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-2xl font-extrabold tracking-tight">Daftar Pemain</h3>
                <Chip color="#DFE6FF">
                  {mode === "bot" ? `1 manusia + ${players - 1} bot` : `${players} manusia`}
                </Chip>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-[1.2px] text-ink-soft">Jumlah kursi</span>
                <div className="flex gap-2">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPlayers(n)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-[2.5px] border-ink font-display text-sm font-extrabold transition-colors",
                        players === n ? "bg-ink text-white" : "bg-tint text-ink hover:bg-sun-pale",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {Array.from({ length: players }).map((_, i) => {
                  const isBot = mode === "bot" && i > 0;
                  const pawnOpen = openPawnSeat === i;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenPawnSeat(pawnOpen ? null : i)}
                          className={cn(
                            "relative shrink-0 rounded-full transition-transform hover:scale-105",
                            pawnOpen && "ring-2 ring-ink ring-offset-2",
                          )}
                          title={`Pilih bidak ${PAWN_NAMES[seatTokens[i]]}`}
                        >
                          <PawnAvatar index={seatTokens[i]} color={PLAYER_COLORS[i]} size={40} />
                        </button>
                        <input
                          className="field min-w-[120px] flex-1 text-sm"
                          placeholder={isBot ? `Bot ${i}` : `Nama pemain ${i + 1}`}
                          value={names[i] ?? ""}
                          maxLength={20}
                          onChange={(e) => {
                            const next = [...names];
                            next[i] = e.target.value;
                            setNames(next);
                          }}
                        />
                        <select
                          aria-label={`Karakter pemain ${i + 1}`}
                          value={seatChars[i]}
                          onChange={(e) => {
                            const next = [...seatChars];
                            next[i] = e.target.value as CharacterId | "random";
                            setSeatChars(next);
                          }}
                          className="rounded-full border-[2.5px] border-ink bg-white px-2.5 py-1.5 text-xs font-bold text-ink"
                        >
                          <option value="random">🎲 Acak</option>
                          {CHARACTERS.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <Chip color={isBot ? "#DFE6FF" : "#D5F7E8"}>
                          {isBot ? "Bot AI" : "Manusia"}
                        </Chip>
                      </div>

                      {pawnOpen ? (
                        <div className="grid grid-cols-4 gap-1.5 rounded-2xl border-[2.5px] border-ink bg-tint p-2.5 animate-[pop_0.15s_var(--ease-out-soft)] sm:grid-cols-8">
                          {PAWN_NAMES.map((pName, tokIdx) => {
                            const activeTok = seatTokens[i] === tokIdx;
                            return (
                              <button
                                key={tokIdx}
                                type="button"
                                onClick={() => {
                                  const next = [...seatTokens];
                                  next[i] = tokIdx;
                                  setSeatTokens(next);
                                  setOpenPawnSeat(null);
                                }}
                                title={pName}
                                className={cn(
                                  "flex flex-col items-center gap-1 rounded-xl border-[2px] p-1.5 text-center transition",
                                  activeTok ? "border-ink bg-sun" : "border-transparent bg-white hover:border-ink/40",
                                )}
                              >
                                <PawnAvatar index={tokIdx} color={PLAYER_COLORS[i]} size={32} />
                                <span className="w-full truncate text-[10px] font-bold text-ink">{pName.split(" ")[0]}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <Button
                variant="primary"
                className="mt-5 w-full text-base"
                onClick={start}
                disabled={mode === "online" || mode === "controller"}
              >
                {mode === "online" || mode === "controller"
                  ? "Gunakan panel room di atas ↑"
                  : "Mulai Permainan Sekarang →"}
              </Button>
            </div>

            {/* Right: Mode Aturan */}
            <div className="panel p-5 sm:p-6">
              <h3 className="font-display text-2xl font-extrabold tracking-tight">Mode Aturan</h3>

              <div className="mt-4 space-y-2.5">
                {PRESETS.map((p) => {
                  const selected = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border-[2.5px] border-ink p-3 text-left transition-colors",
                        selected ? "bg-mint-pale" : "bg-white hover:bg-tint",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink text-[10px] font-bold",
                          selected ? "bg-ink text-white" : "bg-white",
                        )}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <span>
                        <span className="block font-display text-sm font-extrabold">{p.name}</span>
                        <span className="block text-xs font-medium text-ink-soft">{p.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border-[2px] border-ink bg-tint p-3">
                <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-ink-soft">Fitur aktif</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(PRESET_FEATURES[preset])
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <Chip key={k} color="#FFF4C7">
                        {FEATURE_LABELS[k] ?? k}
                      </Chip>
                    ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((w) => (
                  <div key={w} className="rounded-xl border-2 border-ink bg-white px-2 py-1.5 text-center">
                    <div className="font-display text-[11px] font-extrabold leading-tight">
                      {WAVE_LABEL[w].charAt(0) + WAVE_LABEL[w].slice(1).toLowerCase()}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-soft">
                      {w === 1 ? "R1–5" : w === 2 ? "R6–11" : w === 3 ? "R12–15" : "R16–17"}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border-[2.5px] border-ink bg-white">
                <button
                  type="button"
                  onClick={() => setShowHouseRules((v) => !v)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-bold text-ink"
                >
                  <span>⚙️ Aturan Tambahan (House Rules)</span>
                  <span className="rounded-full border border-ink bg-tint px-2 py-0.5 text-[11px]">
                    {showHouseRules ? "Tutup ▲" : "Ubah ▼"}
                  </span>
                </button>
                {showHouseRules ? (
                  <div className="space-y-3 border-t-2 border-ink/15 p-3.5 text-xs">
                    <div>
                      <div className="mb-1.5 font-bold text-ink-soft">Modal awal pemain</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1000, 1500, 2000, 3000].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setStartCash(v)}
                            className={cn(
                              "money rounded-full border-2 border-ink py-1 font-bold",
                              startCash === v ? "bg-sun text-ink" : "bg-tint text-ink-soft",
                            )}
                          >
                            {rp(v)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 font-bold text-ink-soft">Batas ronde maksimal</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[12, 17, 25, 40].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setMaxRounds(r)}
                            className={cn(
                              "rounded-full border-2 border-ink py-1 font-mono font-bold",
                              maxRounds === r ? "bg-sun text-ink" : "bg-tint text-ink-soft",
                            )}
                          >
                            {r} Ronde
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-0.5">
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-ink/20 bg-tint px-2.5 py-2">
                        <span className="font-semibold text-ink">🎁 Jackpot Parkir Gratis (Pot Pajak &amp; Denda)</span>
                        <input
                          type="checkbox"
                          checked={freeParkingPot}
                          onChange={(e) => setFreeParkingPot(e.target.checked)}
                          className="h-4 w-4 accent-[#2F5BFF]"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-ink/20 bg-tint px-2.5 py-2">
                        <span className="font-semibold text-ink">⭐ Sewa 2× saat Grup Lengkap</span>
                        <input
                          type="checkbox"
                          checked={doubleRent}
                          onChange={(e) => setDoubleRent(e.target.checked)}
                          className="h-4 w-4 accent-[#2F5BFF]"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-ink/20 bg-tint px-2.5 py-2">
                        <span className="font-semibold text-ink">🔨 Lelang otomatis bila ditolak</span>
                        <input
                          type="checkbox"
                          checked={auction}
                          onChange={(e) => setAuction(e.target.checked)}
                          className="h-4 w-4 accent-[#2F5BFF]"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Characters Showcase */}
      <section className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-[1.5px] text-tomato">5 Karakter Unik</div>
          <h2 className="mt-1 font-display text-3xl font-extrabold tracking-[-1px]">
            Setiap pemain punya keahlian &amp; risiko sendiri.
          </h2>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {CHARACTERS.map((c, idx) => {
            const bgList = ["bg-sun-pale", "bg-blue-pale", "bg-mint-pale", "bg-tomato-pale", "bg-tint"];
            return (
              <div
                key={c.id}
                className={cn("rounded-[22px] border-[2.5px] border-ink p-4", bgList[idx % bgList.length])}
              >
                <div className="font-display text-lg font-extrabold">{c.name}</div>
                <p className="mt-2 text-xs font-bold text-[#0e8a5a]">+ {c.perk}</p>
                <p className="mt-1 text-xs font-semibold text-tomato">− {c.flaw}</p>
              </div>
            );
          })}
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-[2px] border-divider pt-5 text-xs font-semibold text-ink-soft">
          <span>SerenityPoly · Modal awal {rp(1500)} · 22 kota Indonesia</span>
          <span>Soft Pop Bento UI · Next.js + Tailwind CSS</span>
        </footer>
      </section>
    </div>
  );
}
