"use client";

import { useEffect, useRef, useState } from "react";
import { GROUP_COLORS, TILES, WAVE_LABEL } from "@/engine/data";
import { groupComplete } from "@/engine/actions";
import type { GameState, Tile } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { sfx } from "@/lib/sfx";

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
      for (let k = 1; k <= lm.steps; k++) {
        timers.push(
          window.setTimeout(() => {
            posRef.current[p.id] = (cur + k) % 40;
            sfx.step();
            force((v) => v + 1);
          }, k * 140),
        );
      }
    }
    if (changed) force((v) => v + 1);
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return posRef.current;
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
        "relative flex items-center justify-center border-[3px] border-ink bg-paper shadow-[4px_4px_0_#0A0A0A]",
        animate ? "animate-[dice-tumble_0.55s_ease-out]" : "",
      )}
      style={{ width: "3.3em", height: "3.3em" }}
    >
      {value ? (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect x="4" y="4" width="92" height="92" fill="#FFFDF5" />
          {pips.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={value === 1 ? 14 : 9.5}
              fill={value === 1 ? "#FF4D4D" : "#0A0A0A"}
            />
          ))}
        </svg>
      ) : (
        <span className="font-display text-lg opacity-30">?</span>
      )}
    </div>
  );
}

function centerStyle(T: Tile): string {
  switch (T.type) {
    case "chance":
      return "#FFD43B";
    case "community":
      return "#3DDC97";
    case "tax":
      return "#FF4D4D";
    case "transport":
      return "#4CC9F0";
    case "utility":
      return "#9B7BFF";
    case "jail":
      return "#E9E3D3";
    case "gotojail":
      return "#FF8A3D";
    case "free":
      return "#EFE9DA";
    case "go":
      return "#FFD43B";
    default:
      return "#FFFFFF";
  }
}

export function Board({
  state,
  onSelect,
  selected,
}: {
  state: GameState;
  onSelect: (tile: number) => void;
  selected: number | null;
}) {
  const pos = useAnimatedPositions(state);
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

  const latestLog = state.log[state.log.length - 1];

  return (
    <div
      className="relative aspect-square w-full border-[4px] border-ink bg-ink shadow-[8px_8px_0_#0A0A0A]"
      style={{ containerType: "inline-size", fontSize: "clamp(6.5px, 1.05cqw, 11px)" }}
    >
      <div className="absolute inset-0 grid grid-cols-11 grid-rows-11 gap-[2px]">
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
                "relative flex flex-col overflow-hidden text-left transition-[filter]",
                canClick ? "cursor-pointer hover:brightness-95" : "cursor-default",
                selected === tile.id ? "z-10 outline-[3px] outline-offset-[-3px] outline-ink" : "",
                isCurrentTarget && "ring-2 ring-inset ring-yellow",
              )}
              style={{
                gridColumn: col,
                gridRow: row,
                background: tile.group ? "#FFFFFF" : centerStyle(tile),
              }}
              aria-label={`${tile.name}${owner ? `, milik ${owner.name}` : ""}`}
            >
              {tile.group ? (
                <div
                  className="relative flex h-[23%] w-full items-center justify-end border-b-[2px] border-ink px-[2px]"
                  style={{ background: GROUP_COLORS[tile.group] }}
                >
                  {isMonopoly ? (
                    <span
                      className="rounded-sm bg-ink px-[2px] font-bold leading-none text-yellow"
                      style={{ fontSize: "0.62em" }}
                      title="Monopoli aktif"
                    >
                      ★
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-1 flex-col items-center justify-center gap-[1px] px-[2px] text-center leading-[1.05]">
                <span className="text-[1.35em] leading-none">{tile.icon}</span>
                <span className="font-bold uppercase tracking-tight" style={{ fontSize: "0.82em" }}>
                  {tile.short}
                </span>
                {tile.price ? (
                  <span className="money opacity-75" style={{ fontSize: "0.72em" }}>
                    {tile.price}
                  </span>
                ) : null}
                {tile.tax ? (
                  <span className="money font-bold text-white/95" style={{ fontSize: "0.72em" }}>
                    -{tile.tax}
                  </span>
                ) : null}
              </div>
              {st.houses > 0 ? (
                <div
                  className="absolute left-[2px] top-[25%] flex items-center gap-[1px] rounded-[2px] border border-ink bg-paper/95 px-[2px] py-[1px] leading-none shadow-[1px_1px_0_#0A0A0A]"
                  style={{ fontSize: "0.74em" }}
                >
                  {st.houses === 5 ? (
                    <span>🏨</span>
                  ) : (
                    Array.from({ length: st.houses }).map((_, i) => (
                      <span key={i} className="inline-block h-[0.65em] w-[0.65em] border border-ink bg-mint" />
                    ))
                  )}
                </div>
              ) : null}
              {st.mortgaged ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/35">
                  <span className="border-2 border-ink bg-surface px-[3px] font-bold" style={{ fontSize: "0.68em" }}>
                    GADAI
                  </span>
                </div>
              ) : null}
              {owner ? (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[17%] border-t-[2px] border-ink"
                  style={{ background: owner.color }}
                  title={owner.name}
                />
              ) : null}
              {isMine ? (
                <div className="absolute left-0 top-0 h-[7px] w-[7px] border-b-2 border-r-2 border-ink bg-mint" />
              ) : null}
            </button>
          );
        })}

        <div
          className="relative flex flex-col gap-1.5 overflow-hidden border-[3px] border-ink bg-paper p-2"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display uppercase leading-none tracking-tighter" style={{ fontSize: "2.3em" }}>
                Serenity<span className="bg-yellow px-1">Poly</span>
              </div>
              <div className="mt-0.5 font-bold uppercase tracking-[0.12em] opacity-60" style={{ fontSize: "0.72em" }}>
                Dari Sabang sampai Jayapura
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="chip" style={{ background: "#FFD43B" }}>
                R{state.round}/{state.settings.maxRounds} · {WAVE_LABEL[state.wave]}
              </span>
              <div className="flex items-center gap-1">
                <span className="chip" style={{ background: "#EFE9DA" }}>
                  🏠 {state.housesBank} · 🏨 {state.hotelsBank}
                </span>
                <span className="chip" style={{ background: current?.color ?? "#EFE9DA" }}>
                  {state.phase === "auction" ? "LELANG" : current?.name}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {([1, 2, 3, 4] as const).map((w) => (
              <div
                key={w}
                className={cn(
                  "border-[2px] border-ink px-1 py-[2px] text-center font-bold uppercase leading-none",
                  state.wave === w ? "bg-yellow shadow-[2px_2px_0_#0A0A0A]" : state.wave > w ? "bg-mint/40 opacity-75" : "bg-muted/60 opacity-50",
                )}
                style={{ fontSize: "0.65em" }}
              >
                {WAVE_LABEL[w]}
              </div>
            ))}
          </div>

          {latestLog ? (
            <div
              className={cn(
                "flex items-center gap-1.5 border-[2px] border-ink px-2 py-1 font-bold leading-tight",
                latestLog.tone === "warn"
                  ? "bg-red/20"
                  : latestLog.tone === "good"
                    ? "bg-mint/30"
                    : latestLog.tone === "money"
                      ? "bg-yellow/40"
                      : "bg-muted/70",
              )}
              style={{ fontSize: "0.84em" }}
            >
              <span className="shrink-0 bg-ink px-1 text-paper" style={{ fontSize: "0.8em" }}>
                R{latestLog.round}
              </span>
              <span className="truncate">{latestLog.text}</span>
            </div>
          ) : null}

          <div className="flex flex-1 items-stretch gap-2 overflow-hidden">
            <div className="flex w-[35%] flex-col items-center justify-center gap-1.5 border-[3px] border-ink bg-surface p-2">
              <div className="font-bold uppercase tracking-widest opacity-60" style={{ fontSize: "0.7em" }}>
                Dadu {state.dice ? `(${state.dice[0] + state.dice[1]})` : ""}
              </div>
              <div key={rollKey} className="flex gap-2">
                {[0, 1].map((i) => (
                  <DiceFace
                    key={i}
                    value={state.dice ? state.dice[i] : null}
                    animate={Boolean(state.dice && rollKey > 0)}
                  />
                ))}
              </div>
              <div className="text-center font-bold uppercase tracking-wide opacity-75" style={{ fontSize: "0.68em" }}>
                {state.doubles > 0 ? `🔥 Dobel ${state.doubles}×` : state.dice ? "Hasil lemparan" : "Siap lempar"}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden border-[3px] border-ink bg-surface">
              <div
                className="border-b-[3px] border-ink bg-ink px-2 py-1 font-bold uppercase tracking-widest text-paper"
                style={{ fontSize: "0.68em" }}
              >
                Catatan Permainan
              </div>
              <div className="scroll-thin flex flex-1 flex-col-reverse gap-1 overflow-y-auto px-2 py-1">
                {state.log
                  .slice(-40)
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "border-b border-dashed border-ink/20 pb-[2px] leading-tight",
                        entry.tone === "money" && "text-[#0a7a4a]",
                        entry.tone === "warn" && "text-red",
                        entry.tone === "good" && "font-bold",
                      )}
                      style={{ fontSize: "0.78em" }}
                    >
                      <span className="mr-1 font-mono opacity-50">R{entry.round}</span>
                      {entry.text}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {state.effects.slice(0, 5).map((e) => (
              <span key={e.id} className="chip" style={{ background: "#FF7AC6" }} title={e.label}>
                {e.label} · {e.roundsLeft}r
              </span>
            ))}
            {state.event ? (
              <span className="chip" style={{ background: "#FF8A3D" }} title={state.event.text}>
                ⚡ {state.event.label}: {state.event.text}
              </span>
            ) : null}
            {state.players
              .filter((p) => p.goldenActive)
              .map((p) => (
                <span key={p.id} className="chip" style={{ background: "#FFD43B" }}>
                  ⚡ {p.name}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        {state.players.map((p, idx) => {
          const { col, row } = cellOf(pos[p.id] ?? p.position);
          const sameTile = state.players.filter(
            (q) => (pos[q.id] ?? q.position) === (pos[p.id] ?? p.position) && !q.bankrupt,
          );
          const order = sameTile.findIndex((q) => q.id === p.id);
          const offset = (order - (sameTile.length - 1) / 2) * 1.15;
          const isTurn = current?.id === p.id && !p.bankrupt && state.phase !== "game_over";
          return (
            <div
              key={p.id}
              className={cn(
                "absolute flex items-center justify-center rounded-full border-[2px] border-ink bg-surface shadow-[2px_2px_0_#0A0A0A] transition-all duration-150 ease-linear",
                p.bankrupt && "opacity-30 grayscale",
                isTurn && "ring-[3px] ring-yellow animate-[hop_0.9s_ease-in-out_infinite]",
              )}
              style={{
                width: "clamp(15px, 2.3cqw, 28px)",
                height: "clamp(15px, 2.3cqw, 28px)",
                left: `calc(${((col - 0.5) / 11) * 100}% + ${offset}em)`,
                top: `calc(${((row - 0.5) / 11) * 100}% - 0.35em)`,
                transform: "translate(-50%, -50%)",
                zIndex: isTurn ? 35 : 20 + idx,
                background: p.color,
                fontSize: "clamp(8px, 1.25cqw, 15px)",
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
