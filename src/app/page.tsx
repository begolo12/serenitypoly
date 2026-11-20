"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHARACTERS, PRESET_FEATURES, WAVE_LABEL } from "@/engine/data";
import type { Mode, Preset, Settings } from "@/engine/types";
import { defaultSettings, type SeatConfig } from "@/engine/create";
import { Button, Chip } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import { initMute } from "@/lib/sfx";

const PRESETS: { id: Preset; name: string; desc: string }[] = [
  { id: "pemula", name: "Pemula", desc: "Aturan inti + panduan. Tanpa timer." },
  { id: "klasik", name: "Klasik", desc: "Gelombang ekonomi + skor akhir." },
  { id: "standar", name: "Standar", desc: "Karakter, misi, pinjaman, saham, peristiwa." },
  { id: "penuh", name: "Penuh", desc: "Semua sistem: toko, PBB, Operasi Pasar, Giliran Emas." },
];

const MODES: {
  id: Mode | "controller" | "online";
  name: string;
  desc: string;
  icon: string;
  disabled?: boolean;
  reason?: string;
}[] = [
  { id: "bot", name: "Solo vs Bot", desc: "Kamu lawan 1–3 bot. Tanpa internet.", icon: "🤖" },
  { id: "hotseat", name: "Satu Perangkat", desc: "2–4 pemain bergiliran di layar yang sama.", icon: "👥" },
  {
    id: "controller",
    name: "Papan + HP",
    desc: "Papan di TV/laptop, HP jadi kontroler.",
    icon: "📱",
    disabled: true,
    reason: "Butuh server online (rilis R3)",
  },
  {
    id: "online",
    name: "Online",
    desc: "Kode room, pemain jarak jauh.",
    icon: "🌐",
    disabled: true,
    reason: "Butuh Neon + deploy (rilis R1 lanjutan)",
  },
];

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("bot");
  const [players, setPlayers] = useState(4);
  const [preset, setPreset] = useState<Preset>("standar");
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    initMute();
    setHasSave(!!localStorage.getItem("sp-game"));
  }, []);

  const seats: SeatConfig[] = useMemo(() => {
    return Array.from({ length: players }, (_, i) => ({
      name: names[i]?.trim() || (mode === "bot" && i > 0 ? `Bot ${i}` : `Pemain ${i + 1}`),
      isBot: mode === "bot" && i > 0,
    }));
  }, [players, names, mode]);

  const start = () => {
    const base = defaultSettings();
    const settings: Settings = {
      ...base,
      mode,
      preset,
      players,
      turnTimer: preset === "pemula" ? 0 : 45,
      maxRounds: 17,
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-block -rotate-2 border-[3px] border-ink bg-yellow px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] shadow-[4px_4px_0_#0A0A0A]">
            Multiplayer 2–4 pemain
          </div>
          <h1 className="mt-3 font-display text-5xl uppercase leading-[0.85] tracking-tighter md:text-7xl">
            Serenity
            <br />
            <span className="bg-ink px-2 text-paper">Poly</span>
          </h1>
          <p className="mt-2 max-w-md font-bold uppercase tracking-wide opacity-60">
            Dari Sabang sampai Jayapura. 22 kota, 8 grup, 17 ronde.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2">
          {hasSave ? (
            <Button variant="primary" onClick={resume}>
              ▶ Lanjutkan Permainan
            </Button>
          ) : null}
          <Link href="/rules" className="btn text-xs">
            📖 Buku Aturan
          </Link>
          <span className="chip">v0.1.0 · neobrutalism</span>
        </div>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => setMode(m.id as Mode)}
              className={cn(
                "relative flex flex-col items-start gap-1 border-[3px] border-ink p-3 text-left transition-transform",
                active ? "-translate-x-[2px] -translate-y-[2px] bg-yellow shadow-[7px_7px_0_#0A0A0A]" : "bg-surface shadow-[4px_4px_0_#0A0A0A]",
                m.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="text-3xl leading-none">{m.icon}</span>
              <span className="font-display text-sm uppercase leading-tight">{m.name}</span>
              <span className="text-[11px] font-bold leading-snug opacity-70">{m.desc}</span>
              {m.disabled ? (
                <span className="mt-1 border-2 border-ink bg-muted px-1 text-[9px] font-bold uppercase">{m.reason}</span>
              ) : null}
              {active ? <span className="absolute -right-2 -top-2 h-4 w-4 rounded-full border-[3px] border-ink bg-mint" /> : null}
            </button>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel p-4">
          <h2 className="font-display text-xl uppercase leading-none">Pemain</h2>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Jumlah</span>
            <div className="flex gap-1">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayers(n)}
                  className={cn(
                    "h-10 w-10 border-[3px] border-ink font-display text-sm",
                    players === n ? "bg-ink text-paper" : "bg-surface",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <Chip color="#EFE9DA">
              {mode === "bot" ? `1 manusia + ${players - 1} bot` : `${players} manusia`}
            </Chip>
          </div>

          <div className="mt-4 space-y-2">
            {Array.from({ length: players }).map((_, i) => {
              const isBot = mode === "bot" && i > 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 font-display text-sm">{i + 1}</span>
                  <input
                    className="field flex-1 text-sm"
                    placeholder={isBot ? `Bot ${i}` : `Nama pemain ${i + 1}`}
                    value={names[i] ?? ""}
                    maxLength={20}
                    onChange={(e) => {
                      const next = [...names];
                      next[i] = e.target.value;
                      setNames(next);
                    }}
                  />
                  <span className="w-16 text-center">
                    {isBot ? <Chip color="#9B7BFF">BOT</Chip> : <Chip color="#3DDC97">MANUSIA</Chip>}
                  </span>
                </div>
              );
            })}
          </div>

          <Button variant="primary" className="mt-4 w-full text-base" onClick={start}>
            Mulai Permainan →
          </Button>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-xl uppercase leading-none">Mode Aturan</h2>
          <div className="mt-3 space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={cn(
                  "flex w-full items-start gap-2 border-[3px] border-ink p-2 text-left",
                  preset === p.id ? "bg-mint shadow-[3px_3px_0_#0A0A0A]" : "bg-surface",
                )}
              >
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-[3px] border-ink" style={{ background: preset === p.id ? "#0A0A0A" : "transparent" }} />
                <span>
                  <span className="block font-display text-xs uppercase">{p.name}</span>
                  <span className="block text-[11px] font-bold opacity-70">{p.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 border-[3px] border-ink bg-muted p-2">
            <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Fitur aktif</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(PRESET_FEATURES[preset])
                .filter(([, v]) => v)
                .map(([k]) => (
                  <Chip key={k} color="#FFD43B">
                    {k}
                  </Chip>
                ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((w) => (
              <div key={w} className="border-[2px] border-ink p-1 text-center">
                <div className="font-display text-[9px] uppercase leading-none">{WAVE_LABEL[w]}</div>
                <div className="mt-1 text-[8px] font-bold uppercase opacity-60">
                  {w === 1 ? "R1–5" : w === 2 ? "R6–11" : w === 3 ? "R12–15" : "R16–17"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {CHARACTERS.slice(0, 3).map((c) => (
          <div key={c.id} className="border-[3px] border-ink bg-surface p-3 shadow-[4px_4px_0_#0A0A0A]">
            <div className="font-display text-sm uppercase">{c.name}</div>
            <p className="text-[11px] font-bold opacity-70">+ {c.perk}</p>
            <p className="text-[11px] font-bold opacity-50">− {c.flaw}</p>
          </div>
        ))}
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t-[3px] border-ink pt-3 text-[10px] font-bold uppercase tracking-widest opacity-60">
        <span>SerenityPoly · {rp(1500)} modal awal · 22 properti</span>
        <span>Dibuat dengan Next.js + Tailwind · neobrutalism</span>
      </footer>
    </main>
  );
}
