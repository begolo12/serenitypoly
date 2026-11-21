"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GameScreen } from "@/components/game/GameScreen";
import type { SeatConfig } from "@/engine/create";
import type { GameState, Settings } from "@/engine/types";

type Config = { settings: Settings; seats: SeatConfig[]; initial?: GameState };

export default function PlayPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    const isNew = sessionStorage.getItem("sp-new") === "1";
    sessionStorage.removeItem("sp-new");
    const raw = sessionStorage.getItem("sp-setup");
    if (isNew && raw) {
      try {
        const parsed = JSON.parse(raw) as Config;
        if (parsed?.settings && parsed?.seats?.length) {
          setCfg(parsed);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    const saved = localStorage.getItem("sp-game");
    if (saved) {
      try {
        const st = JSON.parse(saved) as GameState;
        if (st?.engineVersion && Array.isArray(st.players) && st.players.length >= 2) {
          setCfg({
            settings: st.settings,
            seats: st.players.map((p) => ({
              name: p.name,
              isBot: p.isBot,
              character: p.character,
              tokenIndex: p.tokenIndex,
            })),
            initial: st,
          });
          return;
        }
      } catch {
        /* corrupted save */
      }
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Config;
        if (parsed?.settings && parsed?.seats?.length) {
          setCfg(parsed);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    router.replace("/");
  }, [router]);

  if (!cfg) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-8">
        <div className="panel px-6 py-4 font-display uppercase">Menyiapkan papan…</div>
      </main>
    );
  }

  return (
    <GameScreen
      settings={cfg.settings}
      seats={cfg.seats}
      initial={cfg.initial}
      onExit={() => router.push("/")}
    />
  );
}
