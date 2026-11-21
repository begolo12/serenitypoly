"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "@/engine/types";
import {
  getAudioSettings,
  isBgmPlaying,
  setBgmMood,
  setBgmVolume,
  setMuted,
  setSfxVolume,
  sfx,
  startBgm,
  stopBgm,
  type BgmMood,
} from "@/lib/sfx";
import { cn } from "@/lib/format";

export function CardRevealOverlay({
  card,
  playerName,
  playerColor,
  round,
}: {
  card: GameState["lastCard"];
  playerName?: string;
  playerColor?: string;
  round: number;
}) {
  const [visibleCard, setVisibleCard] = useState<{
    key: string;
    deck: "chance" | "community";
    title: string;
    text: string;
    playerName?: string;
    playerColor?: string;
  } | null>(null);
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!card) return;
    const key = `${round}:${card.playerId}:${card.deck}:${card.text}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    setVisibleCard({
      key,
      deck: card.deck,
      title: card.title,
      text: card.text,
      playerName,
      playerColor,
    });
    const t = window.setTimeout(() => {
      setVisibleCard((cur) => (cur?.key === key ? null : cur));
    }, 3000);
    return () => window.clearTimeout(t);
  }, [card, playerName, playerColor, round]);

  if (!visibleCard) return null;
  const isChance = visibleCard.deck === "chance";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
      <div
        onClick={() => setVisibleCard(null)}
        className={cn(
          "pointer-events-auto w-full max-w-[330px] cursor-pointer overflow-hidden rounded-[22px] border-[3px] border-ink animate-[card-flip-in_0.45s_var(--ease-out-soft)]",
          isChance ? "bg-sun-pale" : "bg-mint-pale",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b-[2.5px] border-ink px-4 py-2",
            isChance ? "bg-sun" : "bg-mint",
          )}
        >
          <span className="font-display text-sm font-bold text-ink">
            {isChance ? "Kartu Kesempatan" : "Kartu Dana Umum"}
          </span>
          {visibleCard.playerName ? (
            <span
              className="rounded-full border-[2px] border-ink bg-white px-2 py-0.5 text-[11px] font-bold text-ink"
              style={visibleCard.playerColor ? { borderColor: "#16142B" } : undefined}
            >
              {visibleCard.playerName}
            </span>
          ) : null}
        </div>
        <div className="flex items-start gap-3 p-4">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border-[2.5px] border-ink font-display text-lg font-extrabold",
              isChance ? "bg-tomato text-white" : "bg-white text-ink",
            )}
          >
            {isChance ? "?" : "♥"}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold leading-snug text-ink">{visibleCard.text}</div>
            <div className="mt-1 text-[11px] font-medium text-ink-soft">Ketuk kartu untuk menutup</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventBreakingBanner({
  event,
  round,
}: {
  event: GameState["event"];
  round: number;
}) {
  const [banner, setBanner] = useState<{ key: string; label: string; text: string } | null>(null);
  const seenRef = useRef("");

  useEffect(() => {
    if (!event) return;
    const key = `${round}:${event.id}:${event.label}`;
    if (key === seenRef.current) return;
    seenRef.current = key;
    setBanner({ key, label: event.label, text: event.text });
    const t = window.setTimeout(() => {
      setBanner((cur) => (cur?.key === key ? null : cur));
    }, 3600);
    return () => window.clearTimeout(t);
  }, [event, round]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[35] flex justify-center px-4">
      <div
        onClick={() => setBanner(null)}
        className="pointer-events-auto flex max-w-[420px] cursor-pointer items-center gap-3 rounded-full border-[2.5px] border-ink bg-ink px-4 py-2 text-white animate-[banner-drop_0.3s_var(--ease-out-soft)]"
      >
        <span className="shrink-0 rounded-full bg-tomato px-2.5 py-0.5 font-display text-[11px] font-bold text-white">
          Peristiwa R{round}
        </span>
        <div className="min-w-0 truncate text-xs font-medium">
          <strong className="font-bold text-sun">{banner.label}:</strong> {banner.text}
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#FF5A3C", "#FFD23F", "#2F5BFF", "#2FD592", "#7C4DFF", "#FF66B3"];

export function ConfettiBurst({ triggerKey }: { triggerKey: string | number | null }) {
  const [activeKey, setActiveKey] = useState<string | number | null>(null);

  useEffect(() => {
    if (!triggerKey) return;
    setActiveKey(triggerKey);
    const t = window.setTimeout(() => {
      setActiveKey((cur) => (cur === triggerKey ? null : cur));
    }, 1800);
    return () => window.clearTimeout(t);
  }, [triggerKey]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${6 + ((i * 37) % 88)}%`,
        tx: `${((i % 7) - 3) * 28}px`,
        rot: `${(i % 2 === 0 ? 1 : -1) * (180 + ((i * 53) % 240))}deg`,
        delay: `${(i % 6) * 0.045}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    [],
  );

  if (!activeKey) return null;

  return (
    <div key={String(activeKey)} className="pointer-events-none fixed inset-x-0 top-12 z-50 h-64 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cn(
            "absolute top-0 border border-ink",
            p.round ? "h-3 w-3 rounded-full" : "h-3.5 w-2.5 rounded-[3px]",
          )}
          style={
            {
              left: p.left,
              backgroundColor: p.color,
              animation: `confetti-fall 1.45s cubic-bezier(0.2,0.8,0.2,1) ${p.delay} forwards`,
              "--tx": p.tx,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function ReactionOverlay({ reactions }: { reactions?: GameState["reactions"] }) {
  const [items, setItems] = useState<
    Array<{ id: string; name: string; color: string; emoji: string; slot: number }>
  >([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!reactions || reactions.length === 0) return;
    const now = Date.now();
    const fresh = reactions.filter((r) => now - r.at < 8000 && !seenIds.current.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach((r) => seenIds.current.add(r.id));
    sfx.reaction();
    const mapped = fresh.map((r, i) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      emoji: r.emoji,
      slot: (seenIds.current.size + i) % 5,
    }));
    setItems((prev) => [...prev.slice(-8), ...mapped]);
    const timers = mapped.map((m) =>
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== m.id));
      }, 3100),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reactions]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {items.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 rounded-full border-[2.5px] border-ink bg-white px-3 py-1.5 animate-[reaction-rise_2.9s_ease-out_forwards]"
          style={{ marginRight: `${r.slot * 14}px` }}
        >
          <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ backgroundColor: r.color }} />
          <span className="text-xs font-bold text-ink">{r.name}</span>
          <span className="text-lg leading-none">{r.emoji}</span>
        </div>
      ))}
    </div>
  );
}

export function AudioMixerButton() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => getAudioSettings());
  const boxRef = useRef<HTMLDivElement>(null);

  const sync = () => setSettings({ ...getAudioSettings(), bgmPlaying: isBgmPlaying() });

  useEffect(() => {
    sync();
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const toggleMute = () => {
    setMuted(!settings.muted);
    sync();
    if (settings.muted) sfx.click();
  };

  const toggleMusic = () => {
    if (isBgmPlaying()) stopBgm();
    else {
      if (settings.muted) setMuted(false);
      if (settings.bgmVolume <= 0.01) setBgmVolume(0.45);
      startBgm();
    }
    sync();
  };

  const changeMood = (mood: BgmMood) => {
    setBgmMood(mood);
    if (!isBgmPlaying()) {
      if (settings.muted) setMuted(false);
      startBgm();
    }
    sync();
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => {
          sync();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border-[2.5px] border-ink px-2.5 py-1 text-xs font-semibold transition",
          settings.muted ? "bg-muted text-ink-soft" : settings.bgmPlaying ? "bg-mint-pale text-ink" : "bg-white text-ink hover:bg-tint",
        )}
        title="Pengaturan Audio & Musik (M)"
      >
        <span>{settings.muted ? "🔇" : settings.bgmPlaying ? "🎵" : "🔊"}</span>
        <span className="hidden sm:inline">Audio</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[22px] border-[2.5px] border-ink bg-white p-3.5 animate-[pop_0.16s_var(--ease-out-soft)]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-display text-sm font-bold text-ink">Mixer Audio</span>
            <button
              type="button"
              onClick={toggleMute}
              className={cn(
                "rounded-full border-[2px] border-ink px-2.5 py-0.5 text-[11px] font-bold",
                settings.muted ? "bg-tomato text-white" : "bg-tint text-ink",
              )}
            >
              {settings.muted ? "Senyap" : "Aktif"}
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block">
              <div className="mb-1 flex justify-between font-semibold text-ink-soft">
                <span>Efek Suara (SFX)</span>
                <span className="font-mono text-ink">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.sfxVolume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (v > 0 && settings.muted) setMuted(false);
                  setSfxVolume(v);
                  sync();
                }}
                onMouseUp={() => sfx.click()}
                className="w-full accent-[#2F5BFF]"
              />
            </label>

            <label className="block">
              <div className="mb-1 flex justify-between font-semibold text-ink-soft">
                <span>Volume Musik</span>
                <span className="font-mono text-ink">{Math.round(settings.bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.bgmVolume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  if (v > 0 && settings.muted) setMuted(false);
                  setBgmVolume(v);
                  sync();
                }}
                className="w-full accent-[#2FD592]"
              />
            </label>

            <div className="border-t border-ink/15 pt-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-ink-soft">Suasana BGM</span>
                <button
                  type="button"
                  onClick={toggleMusic}
                  className={cn(
                    "rounded-full border-[2px] border-ink px-2.5 py-0.5 text-[11px] font-bold",
                    settings.bgmPlaying ? "bg-sun text-ink" : "bg-tint text-ink",
                  )}
                >
                  {settings.bgmPlaying ? "Jeda" : "Putar"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => changeMood("santai")}
                  className={cn(
                    "rounded-full border-[2px] border-ink px-2 py-1 text-[11px] font-bold",
                    settings.bgmMood === "santai" ? "bg-mint-pale text-ink" : "bg-white text-ink-soft",
                  )}
                >
                  Santai Jawa
                </button>
                <button
                  type="button"
                  onClick={() => changeMood("semangat")}
                  className={cn(
                    "rounded-full border-[2px] border-ink px-2 py-1 text-[11px] font-bold",
                    settings.bgmMood === "semangat" ? "bg-sun-pale text-ink" : "bg-white text-ink-soft",
                  )}
                >
                  Semangat Party
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
