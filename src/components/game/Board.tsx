"use client";

import { useEffect, useRef, useState } from "react";
import { GROUP_COLORS, TILES, WAVE_LABEL } from "@/engine/data";
import { groupComplete, playerOf, rentPreview } from "@/engine/actions";
import type { GameState, Tile } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import { BuildingBadge, REGION_LABELS, TileArtwork } from "@/components/game/CityArt";

export function cellOf(i: number): { col: number; row: number } {
  if (i === 0) return { col: 11, row: 11 };
  if (i <= 9) return { col: 11 - i, row: 11 };
  if (i === 10) return { col: 1, row: 11 };
  if (i <= 19) return { col: 1, row: 11 - (i - 10) };
  if (i === 20) return { col: 1, row: 1 };
  if (i <= 29) return { col: 1 + (i - 20), row: 1 };
  if (i === 30) return { col: 11, row: 1 };
  return { col: 11, row: 1 + (i - 30) };
}

function useAnimatedPositions(state: GameState) {
  const posRef = useRef<Record<string, number>>({});
  const [hoppingId, setHoppingId] = useState<string | null>(null);
  const [, force] = useState(0);
  const key = state.players.map((p) => `${p.id}:${p.position}`).join("|");

  useEffect(() => {
    const timers: number[] = [];
    let changed = false;
    const lm = state.lastMove;
    for (const p of state.players) {
      const cur = posRef.current[p.id];
      if (cur === undefined) {
        posRef.current[p.id] = p.position;
        changed = true;
        continue;
      }
      if (cur === p.position) continue;
      const hop = lm && lm.playerId === p.id && lm.to === p.position && lm.steps > 0 && lm.steps <= 12;
      if (!hop) {
        posRef.current[p.id] = p.position;
        changed = true;
        continue;
      }
      setHoppingId(p.id);
      for (let k = 1; k <= lm.steps; k++) {
        timers.push(
          window.setTimeout(() => {
            posRef.current[p.id] = (cur + k) % 40;
            sfx.step();
            force((v) => v + 1);
            if (k === lm.steps) setHoppingId(null);
          }, k * 135),
        );
      }
    }
    if (changed) force((v) => v + 1);
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { positions: posRef.current, hoppingId };
}

const PIP_COORDS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

function DiceFace({ value, animate }: { value: number | null; animate: boolean }) {
  const pips = value ? PIP_COORDS[value] ?? [] : [];
  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-[14px] border-[2.5px] border-ink bg-white transition-transform",
        animate ? "animate-[dice-bounce_0.55s_var(--ease-out-soft)]" : "",
      )}
      style={{ width: "3.4em", height: "3.4em" }}
    >
      {value ? (
        <svg viewBox="0 0 100 100" className="h-full w-full rounded-[11px]">
          <rect x="6" y="6" width="88" height="88" rx="18" fill="#FFFFFF" />
          <rect x="6" y="78" width="88" height="16" rx="8" fill="#F2F5FF" />
          {pips.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={value === 1 ? 14.5 : 9.5}
              fill={value === 1 ? "#FF5A3C" : "#16142B"}
            />
          ))}
        </svg>
      ) : (
        <span className="font-display text-lg font-extrabold text-ink/30">·</span>
      )}
    </div>
  );
}

function tileSurface(tile: Tile): string {
  switch (tile.type) {
    case "go":
      return "#FFF4C7";
    case "chance":
      return "#FFF4C7";
    case "community":
      return "#D5F7E8";
    case "tax":
      return "#FFE4DD";
    case "transport":
      return "#DFE6FF";
    case "utility":
      return "#EDEDF3";
    case "jail":
      return "#EDEDF3";
    case "gotojail":
      return "#FFE4DD";
    case "free":
      return "#DFE6FF";
    default:
      return "#FFFFFF";
  }
}

export function Board({
  state,
  onSelect,
  selected,
  onRoll,
  canRoll = false,
}: {
  state: GameState;
  onSelect: (tile: number) => void;
  selected: number | null;
  onRoll?: () => void;
  canRoll?: boolean;
}) {
  const { positions: pos, hoppingId } = useAnimatedPositions(state);
  const current = state.players[state.turnIndex];
  const [rollKey, setRollKey] = useState(0);
  const lastDiceSig = useRef("");

  useEffect(() => {
    const sig = state.dice
      ? `${state.round}:${state.turnIndex}:${state.doubles}:${state.dice.join(",")}:${state.lastMove?.from ?? ""}:${state.lastMove?.to ?? ""}`
      : "";
    if (sig && sig !== lastDiceSig.current) {
      lastDiceSig.current = sig;
      setRollKey((k) => k + 1);
    } else if (!sig) {
      lastDiceSig.current = "";
    }
  }, [state.dice, state.round, state.turnIndex, state.doubles, state.lastMove?.from, state.lastMove?.to]);

  const spotlightTile = current ? TILES[pos[current.id] ?? current.position] : TILES[0];
  const spotlightState = state.tiles[spotlightTile.id];
  const spotlightOwner = spotlightState?.owner ? playerOf(state, spotlightState.owner) : null;

  const waveBadgeText = WAVE_LABEL[state.wave].charAt(0) + WAVE_LABEL[state.wave].slice(1).toLowerCase();

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100dvh-5.75rem))] rounded-[28px] border-[3px] border-ink bg-ink p-[3px]"
      style={{ containerType: "inline-size", fontSize: "clamp(6.5px, 1.02cqw, 11.5px)" }}
    >
      <div className="grid h-full w-full grid-cols-11 grid-rows-11 gap-[2px] overflow-hidden rounded-[23px] bg-ink">
        {TILES.map((tile) => {
          const { col, row } = cellOf(tile.id);
          const st = state.tiles[tile.id];
          const owner = st.owner ? state.players.find((p) => p.id === st.owner) : null;
          const isMine = owner?.id === current?.id;
          const isMonopoly = Boolean(tile.group && owner && groupComplete(state, tile.group, owner.id));
          const canClick = tile.type === "property" || tile.type === "transport" || tile.type === "utility";
          const isCurrentTarget = current && !current.bankrupt && (pos[current.id] ?? current.position) === tile.id;

          return (
            <button
              key={tile.id}
              onClick={() => canClick && onSelect(tile.id)}
              className={cn(
                "group relative flex flex-col overflow-hidden text-left transition-[filter,transform] duration-150",
                canClick ? "cursor-pointer hover:brightness-[0.97]" : "cursor-default",
                selected === tile.id ? "z-10 ring-[3px] ring-inset ring-blue" : "",
                isCurrentTarget && "z-10 ring-[3px] ring-inset ring-tomato",
              )}
              style={{
                gridColumn: col,
                gridRow: row,
                background: tileSurface(tile),
              }}
              aria-label={`${tile.name}${owner ? `, milik ${owner.name}` : ""}`}
            >
              {tile.group ? (
                <div
                  className="flex h-[21%] w-full shrink-0 items-center justify-between border-b-[2px] border-ink px-[3px]"
                  style={{ background: GROUP_COLORS[tile.group] }}
                >
                  {st.houses > 0 ? <BuildingBadge houses={st.houses} /> : <span />}
                  {isMonopoly ? (
                    <span
                      className="rounded-full bg-ink px-[3px] font-bold leading-none text-sun"
                      style={{ fontSize: "0.62em" }}
                      title="Monopoli aktif"
                    >
                      ★
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-1 flex-col items-center justify-between px-[2px] py-[2px] text-center leading-none">
                <div className={cn("flex w-full flex-1 items-center justify-center", tile.group ? "pt-[1px]" : "pt-[2px]")}>
                  <TileArtwork
                    tileId={tile.id}
                    className={cn(
                      "transition-transform duration-200 group-hover:scale-105",
                      tile.group ? "h-[2.45em] w-[2.45em]" : "h-[2.85em] w-[2.85em]",
                    )}
                  />
                </div>
                <div className="w-full pb-[1px]">
                  <div
                    className="truncate font-bold tracking-tight text-ink"
                    style={{ fontSize: "0.78em" }}
                  >
                    {tile.short}
                  </div>
                  {tile.price ? (
                    <div
                      className="money font-semibold text-ink-soft"
                      style={{ fontSize: "0.68em" }}
                    >
                      {tile.price}
                    </div>
                  ) : tile.tax ? (
                    <div
                      className="money font-bold text-tomato"
                      style={{ fontSize: "0.68em" }}
                    >
                      -{tile.tax}
                    </div>
                  ) : null}
                </div>
              </div>

              {st.mortgaged ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
                  <span className="rounded-full border-2 border-ink bg-white px-1.5 py-[1px] font-bold text-ink" style={{ fontSize: "0.65em" }}>
                    Gadai
                  </span>
                </div>
              ) : null}

              {owner ? (
                <div
                  className="h-[11%] w-full shrink-0 border-t-[2px] border-ink"
                  style={{ background: owner.color }}
                  title={`Milik ${owner.name}`}
                />
              ) : null}

              {isMine ? (
                <span
                  className="absolute right-[2px] top-[23%] h-[6px] w-[6px] rounded-full border border-ink bg-mint"
                  title="Milikmu"
                />
              ) : null}
            </button>
          );
        })}

        {/* Center 9x9 Bento Dashboard — Bansos Soft Pop Style */}
        <div
          className="relative flex flex-col gap-[1.8%] overflow-hidden bg-tint p-[2.2%]"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="sticker -rotate-2 bg-sun text-ink"
                style={{ fontSize: "0.86em", padding: "0.22em 0.6em" }}
              >
                Ronde {state.round}/{state.settings.maxRounds}
              </span>
              <div>
                <div className="font-display font-extrabold leading-none tracking-[-0.04em] text-ink" style={{ fontSize: "1.95em" }}>
                  Serenity<span className="text-tomato">Poly</span>
                </div>
                <div className="font-medium text-ink-soft" style={{ fontSize: "0.74em" }}>
                  Dari Sabang sampai Jayapura · Fase {waveBadgeText}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1">
              <span className="chip bg-white text-ink" style={{ fontSize: "0.72em" }}>
                🏠 {state.housesBank} · 🏨 {state.hotelsBank}
              </span>
              {current ? (
                <span
                  className="chip"
                  style={{
                    background: current.color,
                    color: current.color === "#FFD23F" || current.color === "#2FD592" ? "#16142B" : "#FFFFFF",
                    fontSize: "0.72em",
                  }}
                >
                  {current.token} {current.name}
                </span>
              ) : null}
            </div>
          </div>

          {/* 4-Stage Wave Pill Bar */}
          <div className="grid grid-cols-4 gap-[1%]">
            {([1, 2, 3, 4] as const).map((w) => {
              const label = WAVE_LABEL[w].charAt(0) + WAVE_LABEL[w].slice(1).toLowerCase();
              const isCurrent = state.wave === w;
              const isPast = state.wave > w;
              return (
                <div
                  key={w}
                  className={cn(
                    "rounded-full border-[2px] border-ink px-1 py-[2px] text-center font-bold leading-tight transition-colors",
                    isCurrent
                      ? "bg-sun text-ink"
                      : isPast
                        ? "bg-mint-pale text-ink"
                        : "bg-white/75 text-ink-soft",
                  )}
                  style={{ fontSize: "0.68em" }}
                >
                  {w}. {label}
                </div>
              );
            })}
          </div>

          {/* Main Bento Grid: Left (Dice + Spotlight Kota) | Right (Aktivitas Live) */}
          <div className="grid min-h-0 flex-1 grid-cols-[1.02fr_1fr] gap-[1.8%]">
            {/* Left Bento Column */}
            <div className="flex min-h-0 flex-col gap-[1.8%]">
              {/* Dice Arena Card */}
              <div
                onClick={() => {
                  if (canRoll && onRoll) onRoll();
                }}
                role={canRoll && onRoll ? "button" : undefined}
                tabIndex={canRoll && onRoll ? 0 : undefined}
                onKeyDown={(e) => {
                  if (canRoll && onRoll && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onRoll();
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-between gap-[1.5%] rounded-[20px] border-[2.5px] border-ink bg-blue-pale p-[2.6%] transition-transform",
                  canRoll && onRoll && "cursor-pointer hover:scale-[1.01] active:scale-[0.98]",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold uppercase tracking-[0.08em] text-blue" style={{ fontSize: "0.68em" }}>
                    Arena Dadu
                  </span>
                  <span
                    className={cn(
                      "rounded-full border-[1.5px] border-ink px-2 py-[1px] font-bold",
                      state.doubles > 0 ? "bg-tomato text-white" : "bg-white text-ink",
                    )}
                    style={{ fontSize: "0.68em" }}
                  >
                    {state.doubles > 0
                      ? `Dobel ${state.doubles}×!`
                      : state.dice
                        ? `Total ${state.dice[0] + state.dice[1]}`
                        : "Siap lempar"}
                  </span>
                </div>

                <div key={rollKey} className="flex items-center justify-center gap-3 py-[1%]">
                  {[0, 1].map((i) => (
                    <DiceFace
                      key={i}
                      value={state.dice ? state.dice[i] : null}
                      animate={Boolean(state.dice && rollKey > 0)}
                    />
                  ))}
                </div>

                <div
                  className={cn(
                    "w-full rounded-full border-[2px] border-ink px-2 py-[2px] text-center font-bold",
                    canRoll && onRoll ? "bg-tomato text-white" : "bg-white text-ink-soft",
                  )}
                  style={{ fontSize: "0.68em" }}
                >
                  {canRoll && onRoll
                    ? "🎲 Ketuk dadu untuk lempar!"
                    : state.phase === "auction"
                      ? "Lelang sedang berlangsung"
                      : `${current?.name ?? "Pemain"} · ${spotlightTile.name}`}
                </div>
              </div>

              {/* Spotlight Kota Aktif Card */}
              <div className="flex min-h-0 flex-1 flex-col justify-between rounded-[20px] border-[2.5px] border-ink bg-white p-[2.6%]">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold uppercase tracking-[0.08em] text-ink-soft" style={{ fontSize: "0.65em" }}>
                    Posisi Aktif
                  </span>
                  <span
                    className="rounded-full border-[1.5px] border-ink px-1.5 py-[1px] font-bold"
                    style={{
                      background: spotlightOwner ? spotlightOwner.color : "#FFF4C7",
                      color:
                        spotlightOwner && (spotlightOwner.color === "#2F5BFF" || spotlightOwner.color === "#FF5A3C")
                          ? "#FFFFFF"
                          : "#16142B",
                      fontSize: "0.65em",
                    }}
                  >
                    {spotlightOwner ? `Milik ${spotlightOwner.name}` : spotlightTile.price ? "Tersedia" : "Khusus"}
                  </span>
                </div>

                <div className="flex items-center gap-[3%] py-1">
                  <div
                    className="flex h-[4.4em] w-[4.4em] shrink-0 items-center justify-center rounded-2xl border-[2px] border-ink p-1"
                    style={{
                      background: spotlightTile.group ? GROUP_COLORS[spotlightTile.group] : tileSurface(spotlightTile),
                    }}
                  >
                    <TileArtwork tileId={spotlightTile.id} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-extrabold leading-tight text-ink" style={{ fontSize: "1.25em" }}>
                      {spotlightTile.name}
                    </div>
                    <div className="truncate font-medium text-ink-soft" style={{ fontSize: "0.72em" }}>
                      {spotlightTile.group
                        ? REGION_LABELS[spotlightTile.group]
                        : spotlightTile.type === "transport"
                          ? "Transportasi Nusantara"
                          : spotlightTile.type === "utility"
                            ? "Utilitas Nasional"
                            : "Petak Peristiwa"}
                    </div>
                    {spotlightTile.price ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="money rounded-full border border-ink bg-tint px-1.5 py-[1px] font-bold" style={{ fontSize: "0.68em" }}>
                          Beli {rp(spotlightTile.price)}
                        </span>
                        <span className="money rounded-full border border-ink bg-sun-pale px-1.5 py-[1px] font-bold" style={{ fontSize: "0.68em" }}>
                          Sewa {rp(rentPreview(state, spotlightTile.id))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Bento Column: Top-Aligned Activity Feed (Zero empty gap!) */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border-[2.5px] border-ink bg-white">
              <div className="flex items-center justify-between border-b-[2px] border-ink bg-ink px-[3%] py-[1.8%] text-white">
                <span className="font-display font-extrabold tracking-tight" style={{ fontSize: "0.86em" }}>
                  Aktivitas Live
                </span>
                <span className="flex items-center gap-1 font-bold text-mint" style={{ fontSize: "0.66em" }}>
                  <span className="inline-block h-[6px] w-[6px] rounded-full bg-mint animate-[pulse-mint_1.6s_ease-out_infinite]" />
                  Live
                </span>
              </div>

              <div className="scroll-thin flex-1 divide-y divide-divider overflow-y-auto px-[3%] py-[1%]">
                {state.log
                  .slice(-40)
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-1.5 py-[1.4%] leading-snug"
                      style={{ fontSize: "0.78em" }}
                    >
                      <span
                        className={cn(
                          "mt-[1px] shrink-0 rounded-full border border-ink px-1.5 py-[0.5px] font-mono font-bold",
                          entry.tone === "money"
                            ? "bg-mint-pale text-ink"
                            : entry.tone === "warn"
                              ? "bg-tomato-pale text-ink"
                              : entry.tone === "good"
                                ? "bg-sun-pale text-ink"
                                : "bg-tint text-ink-soft",
                        )}
                        style={{ fontSize: "0.8em" }}
                      >
                        R{entry.round}
                      </span>
                      <span
                        className={cn(
                          "flex-1",
                          entry.tone === "good" && "font-bold text-ink",
                          entry.tone === "warn" && "font-semibold text-tomato",
                          entry.tone === "money" && "font-semibold text-[#0e8a5a]",
                          entry.tone === "info" && "text-ink-soft",
                        )}
                      >
                        {entry.text}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Bottom Ticker for National Events / Effects / Golden Turn */}
          {state.event || state.effects.length > 0 || state.players.some((p) => p.goldenActive) ? (
            <div className="flex flex-wrap items-center gap-1">
              {state.event ? (
                <span className="chip bg-sun text-ink" style={{ fontSize: "0.7em" }} title={state.event.text}>
                  ⚡ {state.event.label}: {state.event.text}
                </span>
              ) : null}
              {state.effects.slice(0, 3).map((e) => (
                <span key={e.id} className="chip bg-tomato-pale text-ink" style={{ fontSize: "0.68em" }}>
                  {e.label} · {e.roundsLeft}r
                </span>
              ))}
              {state.players
                .filter((p) => p.goldenActive)
                .map((p) => (
                  <span key={p.id} className="chip bg-sun text-ink" style={{ fontSize: "0.68em" }}>
                    ★ Giliran Emas: {p.name}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Animated Player Tokens */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {state.players.map((p, idx) => {
          const { col, row } = cellOf(pos[p.id] ?? p.position);
          const sameTile = state.players.filter(
            (q) => (pos[q.id] ?? q.position) === (pos[p.id] ?? p.position) && !q.bankrupt,
          );
          const order = sameTile.findIndex((q) => q.id === p.id);
          const offsetX = (order - (sameTile.length - 1) / 2) * 1.15;
          const isTurn = current?.id === p.id && !p.bankrupt && state.phase !== "game_over";
          const isHopping = hoppingId === p.id;
          return (
            <div
              key={p.id}
              className={cn(
                "absolute flex items-center justify-center rounded-full border-[2.5px] border-ink transition-all duration-150 ease-out",
                p.bankrupt && "opacity-30 grayscale",
                isTurn && "ring-[3px] ring-sun",
                (isTurn || isHopping) && "animate-[token-arc_0.8s_ease-in-out_infinite]",
              )}
              style={{
                width: "clamp(17px, 2.5cqw, 30px)",
                height: "clamp(17px, 2.5cqw, 30px)",
                left: `calc(${((col - 0.5) / 11) * 100}% + ${offsetX}em)`,
                top: `calc(${((row - 0.5) / 11) * 100}% + 0.1em)`,
                transform: "translate(-50%, -50%)",
                zIndex: isTurn ? 35 : 20 + idx,
                background: p.color,
                fontSize: "clamp(9px, 1.3cqw, 16px)",
              }}
              title={p.name}
            >
              <span style={{ fontSize: "0.9em" }}>{p.token}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function rentText(tile: Tile, houses: number): string {
  if (tile.type === "property" && tile.rents) return rp(tile.rents[Math.min(houses, 5)]);
  if (tile.type === "transport") return "Rp 25–200";
  if (tile.type === "utility") return "4× / 10× dadu";
  return "—";
}
