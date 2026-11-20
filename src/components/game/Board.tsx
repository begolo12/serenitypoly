"use client";

import { useEffect, useRef, useState } from "react";
import { GROUP_COLORS, TILES, WAVE_LABEL } from "@/engine/data";
import type { GameState, Tile } from "@/engine/types";
import { cn, rp } from "@/lib/format";

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
            force((v) => v + 1);
          }, k * 150),
        );
      }
    }
    if (changed) force((v) => v + 1);
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return posRef.current;
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
          const canClick = tile.type === "property" || tile.type === "transport" || tile.type === "utility";
          return (
            <button
              key={tile.id}
              onClick={() => canClick && onSelect(tile.id)}
              className={cn(
                "relative flex flex-col overflow-hidden text-left transition-[filter]",
                canClick ? "cursor-pointer hover:brightness-95" : "cursor-default",
                selected === tile.id ? "z-10 outline-[3px] outline-offset-[-3px] outline-ink" : "",
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
                  className="h-[22%] w-full border-b-[2px] border-ink"
                  style={{ background: GROUP_COLORS[tile.group] }}
                />
              ) : null}
              <div className="flex flex-1 flex-col items-center justify-center gap-[1px] px-[2px] text-center leading-[1.05]">
                <span className="text-[1.35em] leading-none">{tile.icon}</span>
                <span className="font-bold uppercase tracking-tight" style={{ fontSize: "0.82em" }}>
                  {tile.short}
                </span>
                {tile.price ? (
                  <span className="money opacity-70" style={{ fontSize: "0.72em" }}>
                    {tile.price}
                  </span>
                ) : null}
                {tile.tax ? (
                  <span className="money opacity-70" style={{ fontSize: "0.72em" }}>
                    -{tile.tax}
                  </span>
                ) : null}
              </div>
              {st.houses > 0 ? (
                <div className="absolute right-[2px] top-[24%] flex gap-[1px] text-[0.8em] leading-none">
                  {st.houses === 5 ? "🏨" : Array.from({ length: st.houses }).map((_, i) => <span key={i}>🏠</span>)}
                </div>
              ) : null}
              {st.mortgaged ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/20">
                  <span className="border-2 border-ink bg-surface px-[2px] font-bold" style={{ fontSize: "0.7em" }}>
                    GADAI
                  </span>
                </div>
              ) : null}
              {owner ? (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[16%] border-t-[2px] border-ink"
                  style={{ background: owner.color }}
                  title={owner.name}
                />
              ) : null}
              {isMine ? <div className="absolute left-0 top-0 h-[6px] w-[6px] border-b-2 border-r-2 border-ink bg-mint" /> : null}
            </button>
          );
        })}

        <div
          className="relative flex flex-col gap-2 overflow-hidden border-[3px] border-ink bg-paper p-2"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display uppercase leading-none tracking-tighter" style={{ fontSize: "2.4em" }}>
                Serenity<span className="bg-yellow px-1">Poly</span>
              </div>
              <div className="mt-1 font-bold uppercase tracking-[0.12em] opacity-60" style={{ fontSize: "0.75em" }}>
                Dari Sabang sampai Jayapura
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="chip" style={{ background: "#FFD43B" }}>
                R{state.round} · {WAVE_LABEL[state.wave]}
              </span>
              <span className="chip" style={{ background: "#EFE9DA" }}>
                {state.phase === "auction" ? "LELANG" : current?.name}
              </span>
            </div>
          </div>

          <div className="flex flex-1 items-stretch gap-2 overflow-hidden">
            <div className="flex w-[34%] flex-col items-center justify-center gap-2 border-[3px] border-ink bg-surface p-2">
              <div className="font-bold uppercase tracking-widest opacity-60" style={{ fontSize: "0.72em" }}>
                Dadu
              </div>
              <div className="flex gap-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-center border-[3px] border-ink bg-paper font-display shadow-[3px_3px_0_#0A0A0A]",
                      state.dice ? "animate-[dice-tumble_0.6s_ease-out]" : "",
                    )}
                    style={{ width: "2.6em", height: "2.6em", fontSize: "1.6em" }}
                  >
                    {state.dice ? state.dice[i] : "·"}
                  </div>
                ))}
              </div>
              <div className="text-center font-bold uppercase tracking-wide opacity-70" style={{ fontSize: "0.7em" }}>
                {state.doubles > 0 ? `Dobel ${state.doubles}×` : "—"}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden border-[3px] border-ink bg-surface">
              <div className="border-b-[3px] border-ink bg-ink px-2 py-1 font-bold uppercase tracking-widest text-paper" style={{ fontSize: "0.68em" }}>
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
                {state.event.label}
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
          const offset = (order - (sameTile.length - 1) / 2) * 1.1;
          return (
            <div
              key={p.id}
              className={cn(
                "absolute flex items-center justify-center rounded-full border-[2px] border-ink bg-surface shadow-[2px_2px_0_#0A0A0A] transition-all duration-150 ease-linear",
                p.bankrupt && "opacity-30 grayscale",
                current?.id === p.id && "ring-2 ring-ink",
              )}
              style={{
                width: "clamp(14px, 2.2cqw, 26px)",
                height: "clamp(14px, 2.2cqw, 26px)",
                left: `calc(${((col - 0.5) / 11) * 100}% + ${offset}em)`,
                top: `calc(${((row - 0.5) / 11) * 100}% - 0.4em)`,
                transform: "translate(-50%, -50%)",
                zIndex: 20 + idx,
                background: p.color,
                fontSize: "clamp(8px, 1.2cqw, 14px)",
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
