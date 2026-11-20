"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GROUP_COLORS, GROUP_NAMES, GROUP_TILES, TILES, WAVE_LABEL } from "@/engine/data";
import { groupComplete, playerOf, rentPreview } from "@/engine/actions";
import type { GameState, GroupId, Tile } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { sfx } from "@/lib/sfx";
import {
  BoardPawn,
  BuildingBadge,
  PawnAvatar,
  REGION_LABELS,
  TileArtwork,
} from "@/components/game/CityArt";
import { Tooltip } from "@/components/ui/kit";

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
          }, k * 130),
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
        animate ? "animate-[dice-bounce_0.5s_var(--ease-out-soft)]" : "",
      )}
      style={{ width: "3.45em", height: "3.45em" }}
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

function specialTileSummary(tile: Tile): string {
  switch (tile.type) {
    case "go":
      return "Lewati atau mendarat di GO untuk menerima gaji putaran.";
    case "chance":
      return "Tarik 1 kartu Kesempatan — bisa berhadiah uang, pindah petak, atau denda.";
    case "community":
      return "Tarik 1 kartu Dana Umum — warisan, solidaritas pemain, atau iuran kota.";
    case "tax":
      return `Bayar pajak negara sebesar ${rp(tile.tax ?? 0)} langsung ke bank.`;
    case "jail":
      return "Sekadar berkunjung aman, atau menunggu bebas saat berstatus tahanan.";
    case "free":
      return "Area istirahat Nusantara yang aman tanpa denda sewa.";
    case "gotojail":
      return "Langsung dipindahkan ke Penjara tanpa melewati gaji GO.";
    default:
      return "";
  }
}

const RENT_TIER_SHORT = ["Tanah", "1🏠", "2🏠", "3🏠", "4🏠", "★H"];

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
  const currentIdx = state.turnIndex;

  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const [displayDice, setDisplayDice] = useState<[number, number] | null>(state.dice);
  const lastDiceSig = useRef("");

  // Live action popup stamp
  const lastLog = state.log[state.log.length - 1];
  const [toast, setToast] = useState<{ id: number; text: string; tone: string } | null>(null);
  const lastLogIdRef = useRef<number>(lastLog?.id ?? 0);

  useEffect(() => {
    if (!lastLog || lastLog.id === lastLogIdRef.current) return;
    lastLogIdRef.current = lastLog.id;
    setToast({ id: lastLog.id, text: lastLog.text, tone: lastLog.tone });
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [lastLog]);

  // Dice shuffle & spring bounce
  useEffect(() => {
    const sig = state.dice
      ? `${state.round}:${state.turnIndex}:${state.doubles}:${state.dice.join(",")}:${state.lastMove?.from ?? ""}:${state.lastMove?.to ?? ""}`
      : "";
    if (!sig) {
      lastDiceSig.current = "";
      setDisplayDice(null);
      return;
    }
    if (sig === lastDiceSig.current) {
      setDisplayDice(state.dice);
      return;
    }
    lastDiceSig.current = sig;
    setRollKey((k) => k + 1);

    let step = 0;
    const iv = window.setInterval(() => {
      step += 1;
      if (step >= 4) {
        window.clearInterval(iv);
        setDisplayDice(state.dice);
      } else {
        setDisplayDice([((step * 2) % 6) + 1, ((step * 5) % 6) + 1]);
      }
    }, 62);
    return () => window.clearInterval(iv);
  }, [state.dice, state.round, state.turnIndex, state.doubles, state.lastMove?.from, state.lastMove?.to]);

  // Movement trail set
  const trailSet = useMemo(() => {
    const set = new Set<number>();
    const lm = state.lastMove;
    if (lm && lm.steps > 0 && lm.steps <= 12) {
      for (let k = 1; k < lm.steps; k++) {
        set.add((lm.from + k) % 40);
      }
    }
    return set;
  }, [state.lastMove]);

  const currentPos = current ? pos[current.id] ?? current.position : 0;
  const spotlightId = hoveredTile ?? selected ?? currentPos;
  const spotlightTile = TILES[spotlightId];
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
          const isCurrentTarget = current && !current.bankrupt && currentPos === tile.id;
          const isTrail = trailSet.has(tile.id);

          return (
            <button
              key={tile.id}
              onClick={() => canClick && onSelect(tile.id)}
              onMouseEnter={() => setHoveredTile(tile.id)}
              onMouseLeave={() => setHoveredTile((prev) => (prev === tile.id ? null : prev))}
              className={cn(
                "group relative flex flex-col overflow-hidden text-left transition-[filter,transform] duration-150",
                canClick ? "cursor-pointer hover:brightness-[0.97]" : "cursor-default",
                selected === tile.id ? "z-10 ring-[3px] ring-inset ring-blue" : "",
                isCurrentTarget && "z-10 animate-[tile-pulse_1.8s_ease-out_infinite]",
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
                  className="flex h-[20%] w-full shrink-0 items-center justify-between border-b-[2px] border-ink px-[3px]"
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
                      "transition-transform duration-200 group-hover:scale-110",
                      tile.group ? "h-[2.35em] w-[2.35em]" : "h-[2.75em] w-[2.75em]",
                    )}
                  />
                </div>
                <div className="w-full pb-[1px]">
                  <div className="truncate font-bold tracking-tight text-ink" style={{ fontSize: "0.78em" }}>
                    {tile.short}
                  </div>
                  {tile.price ? (
                    <div className="money font-semibold text-ink-soft" style={{ fontSize: "0.67em" }}>
                      {tile.price}
                    </div>
                  ) : tile.tax ? (
                    <div className="money font-bold text-tomato" style={{ fontSize: "0.67em" }}>
                      -{tile.tax}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Stepping-stone movement trail dot */}
              {isTrail && !isCurrentTarget ? (
                <span
                  className="pointer-events-none absolute right-[3px] top-[24%] h-[6px] w-[6px] rounded-full border border-ink bg-sun animate-[trail-dot_1.1s_ease-in-out_infinite]"
                  aria-hidden="true"
                />
              ) : null}

              {st.mortgaged ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
                  <span className="rounded-full border-2 border-ink bg-white px-1.5 py-[1px] font-bold text-ink" style={{ fontSize: "0.65em" }}>
                    Gadai
                  </span>
                </div>
              ) : null}

              {owner ? (
                <div
                  className="h-[10%] w-full shrink-0 border-t-[2px] border-ink"
                  style={{ background: owner.color }}
                  title={`Milik ${owner.name}`}
                />
              ) : null}

              {isMine ? (
                <span
                  className="absolute right-[2px] top-[22%] h-[6px] w-[6px] rounded-full border border-ink bg-mint"
                  title="Milikmu"
                />
              ) : null}
            </button>
          );
        })}

        {/* Center 9x9 Bento Dashboard — Rich Soft Pop Bento (Zero Empty White Space!) */}
        <div
          className="relative flex flex-col gap-[1.6%] overflow-hidden bg-tint p-[2%]"
          style={{ gridColumn: "2 / 11", gridRow: "2 / 11" }}
        >
          {/* Floating Live Action Toast Banner */}
          {toast ? (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-none absolute left-1/2 top-[2.2%] z-30 flex max-w-[92%] -translate-x-1/2 items-center gap-1.5 rounded-full border-[2.5px] border-ink px-3 py-1 font-bold shadow-sm animate-[toast-pop_0.28s_var(--ease-out-soft)]",
                toast.tone === "warn"
                  ? "bg-tomato text-white"
                  : toast.tone === "money"
                    ? "bg-mint text-ink"
                    : toast.tone === "good"
                      ? "bg-sun text-ink"
                      : "bg-white text-ink",
              )}
              style={{ fontSize: "0.84em" }}
            >
              <span>{toast.tone === "warn" ? "⚠️" : toast.tone === "money" ? "💸" : toast.tone === "good" ? "✨" : "🎲"}</span>
              <span className="truncate">{toast.text}</span>
            </div>
          ) : null}

          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="sticker -rotate-2 bg-sun text-ink"
                style={{ fontSize: "0.82em", padding: "0.2em 0.55em" }}
              >
                Ronde {state.round}/{state.settings.maxRounds}
              </span>
              <div>
                <div className="font-display font-extrabold leading-none tracking-[-0.04em] text-ink" style={{ fontSize: "1.85em" }}>
                  Serenity<span className="text-tomato">Poly</span>
                </div>
                <div className="font-medium text-ink-soft" style={{ fontSize: "0.72em" }}>
                  Dari Sabang sampai Jayapura · Fase {waveBadgeText}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1">
              <Tooltip tip={`Stok Bank tersisa: ${state.housesBank} rumah & ${state.hotelsBank} hotel`} position="bottom">
                <span className="chip bg-white text-ink" style={{ fontSize: "0.7em" }}>
                  🏠 {state.housesBank} · 🏨 {state.hotelsBank}
                </span>
              </Tooltip>
              {current ? (
                <span
                  className="chip gap-1.5"
                  style={{
                    background: current.color,
                    color: current.color === "#FFD23F" || current.color === "#2FD592" ? "#16142B" : "#FFFFFF",
                    fontSize: "0.7em",
                  }}
                >
                  <PawnAvatar index={currentIdx} color={current.color} size={16} className="border-[1.5px] p-0" />
                  {current.name}
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
              const tip =
                w === 1
                  ? "Ronde 1–5: Sewa ×1, maks 3 rumah"
                  : w === 2
                    ? "Ronde 6–11: Sewa ×1,5, hotel & saham terbuka"
                    : w === 3
                      ? "Ronde 12–15: Sewa ×2, PBB 5% aktif"
                      : "Ronde 16–17: Sewa ×2,5, pinjaman jatuh tempo";
              return (
                <Tooltip key={w} tip={tip} position="bottom" className="w-full">
                  <div
                    className={cn(
                      "w-full rounded-full border-[2px] border-ink px-1 py-[2px] text-center font-bold leading-tight transition-colors",
                      isCurrent
                        ? "bg-sun text-ink"
                        : isPast
                          ? "bg-mint-pale text-ink"
                          : "bg-white/75 text-ink-soft",
                    )}
                    style={{ fontSize: "0.66em" }}
                  >
                    {w}. {label}
                  </div>
                </Tooltip>
              );
            })}
          </div>

          {/* Main 2-Column Bento Grid */}
          <div className="grid min-h-0 flex-1 grid-cols-[1.04fr_1fr] gap-[1.8%]">
            {/* Left Bento Column: Dice Arena + Full Title Deed Spotlight */}
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
                  "flex flex-col items-center justify-between gap-[1.4%] rounded-[20px] border-[2.5px] border-ink bg-blue-pale p-[2.4%] transition-transform",
                  canRoll && onRoll && "cursor-pointer hover:scale-[1.01] active:scale-[0.98]",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold uppercase tracking-[0.08em] text-blue" style={{ fontSize: "0.66em" }}>
                    Arena Dadu
                  </span>
                  <span
                    className={cn(
                      "rounded-full border-[1.5px] border-ink px-2 py-[1px] font-bold",
                      state.doubles > 0 ? "bg-tomato text-white" : "bg-white text-ink",
                    )}
                    style={{ fontSize: "0.66em" }}
                  >
                    {state.doubles > 0
                      ? `Dobel ${state.doubles}×!`
                      : displayDice
                        ? `Total ${displayDice[0] + displayDice[1]}`
                        : "Siap lempar"}
                  </span>
                </div>

                <div key={rollKey} className="flex items-center justify-center gap-3 py-[0.6%]">
                  {[0, 1].map((i) => (
                    <DiceFace
                      key={i}
                      value={displayDice ? displayDice[i] : null}
                      animate={Boolean(displayDice && rollKey > 0)}
                    />
                  ))}
                </div>

                <div
                  className={cn(
                    "w-full rounded-full border-[2px] border-ink px-2 py-[2px] text-center font-bold",
                    canRoll && onRoll ? "bg-tomato text-white" : "bg-white text-ink-soft",
                  )}
                  style={{ fontSize: "0.66em" }}
                >
                  {canRoll && onRoll
                    ? "🎲 Ketuk dadu untuk lempar!"
                    : state.phase === "auction"
                      ? "🔨 Lelang sedang berlangsung"
                      : `${current?.name ?? "Pemain"} di ${TILES[currentPos].name}`}
                </div>
              </div>

              {/* Full Illustrated Title Deed Spotlight Card (No Empty Space!) */}
              <div className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-[20px] border-[2.5px] border-ink bg-white p-[2.4%]">
                {/* Header & Landmark Banner */}
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold uppercase tracking-[0.08em] text-ink-soft" style={{ fontSize: "0.64em" }}>
                    {hoveredTile !== null ? "Sorotan Petak" : selected !== null ? "Petak Dipilih" : "Posisi Aktif"}
                  </span>
                  <span
                    className="rounded-full border-[1.5px] border-ink px-2 py-[1px] font-bold"
                    style={{
                      background: spotlightOwner ? spotlightOwner.color : "#FFF4C7",
                      color:
                        spotlightOwner && (spotlightOwner.color === "#2F5BFF" || spotlightOwner.color === "#FF5A3C")
                          ? "#FFFFFF"
                          : "#16142B",
                      fontSize: "0.64em",
                    }}
                  >
                    {spotlightOwner ? `Milik ${spotlightOwner.name}` : spotlightTile.price ? "Tersedia" : "Khusus"}
                  </span>
                </div>

                {/* Panoramic City Hero */}
                <div
                  className="flex items-center gap-[3%] rounded-2xl border-[2px] border-ink p-[2.4%]"
                  style={{
                    background: spotlightTile.group ? GROUP_COLORS[spotlightTile.group] : tileSurface(spotlightTile),
                  }}
                >
                  <div className="flex h-[4.2em] w-[4.2em] shrink-0 items-center justify-center rounded-xl border-[2px] border-ink bg-white p-[3px]">
                    <TileArtwork tileId={spotlightTile.id} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-xl border-[2px] border-ink bg-white/95 px-[2.8%] py-[2%]">
                    <div className="truncate font-display font-extrabold leading-tight text-ink" style={{ fontSize: "1.22em" }}>
                      {spotlightTile.name}
                    </div>
                    <div className="truncate font-semibold text-ink-soft" style={{ fontSize: "0.7em" }}>
                      {spotlightTile.group
                        ? `${GROUP_NAMES[spotlightTile.group]} · ${REGION_LABELS[spotlightTile.group]}`
                        : spotlightTile.type === "transport"
                          ? "Transportasi Nusantara"
                          : spotlightTile.type === "utility"
                            ? "Utilitas Nasional"
                            : "Petak Khusus Papan"}
                    </div>
                  </div>
                </div>

                {/* Sibling Cities in Same Color Group */}
                {spotlightTile.group ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {GROUP_TILES[spotlightTile.group].map((sid) => {
                      const stOwner = playerOf(state, state.tiles[sid].owner);
                      const isThis = sid === spotlightTile.id;
                      return (
                        <span
                          key={sid}
                          className={cn(
                            "rounded-full border border-ink px-1.5 py-[1px] font-bold leading-tight",
                            isThis ? "bg-ink text-white" : "bg-tint text-ink",
                          )}
                          style={{ fontSize: "0.64em" }}
                        >
                          {TILES[sid].short}
                          {stOwner ? ` · ${stOwner.name.slice(0, 5)}` : ""}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {/* Complete Rent Ladder / Rule Box */}
                {spotlightTile.type === "property" && spotlightTile.rents ? (
                  <div className="grid grid-cols-3 gap-1">
                    {spotlightTile.rents.map((r, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center justify-between rounded-lg border border-ink px-1.5 py-[2px]",
                          spotlightState.houses === i && spotlightOwner ? "bg-sun font-extrabold" : "bg-tint/70",
                        )}
                        style={{ fontSize: "0.66em" }}
                      >
                        <span className="text-ink-soft">{RENT_TIER_SHORT[i]}</span>
                        <span className="money font-bold text-ink">{r}</span>
                      </div>
                    ))}
                  </div>
                ) : spotlightTile.type === "transport" ? (
                  <div className="grid grid-cols-4 gap-1">
                    {[25, 50, 100, 200].map((r, i) => (
                      <div key={i} className="rounded-lg border border-ink bg-blue-pale px-1 py-[2px] text-center" style={{ fontSize: "0.64em" }}>
                        <div className="font-semibold text-ink-soft">{i + 1} Unit</div>
                        <div className="money font-bold text-ink">{r}</div>
                      </div>
                    ))}
                  </div>
                ) : spotlightTile.type === "utility" ? (
                  <div className="grid grid-cols-2 gap-1">
                    <div className="rounded-lg border border-ink bg-tint px-2 py-[3px] text-center font-bold" style={{ fontSize: "0.66em" }}>
                      1 Utilitas: 4× Dadu
                    </div>
                    <div className="rounded-lg border border-ink bg-tint px-2 py-[3px] text-center font-bold" style={{ fontSize: "0.66em" }}>
                      2 Utilitas: 10× Dadu
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-ink bg-tint px-2.5 py-[5px] font-semibold leading-snug text-ink-soft" style={{ fontSize: "0.7em" }}>
                    {specialTileSummary(spotlightTile)}
                  </div>
                )}

                {/* Footer Price / Build Cost */}
                {spotlightTile.price ? (
                  <div className="flex items-center justify-between gap-1 border-t border-divider pt-[3px]">
                    <span className="money rounded-full border border-ink bg-tint px-2 py-[1px] font-bold" style={{ fontSize: "0.66em" }}>
                      Beli {rp(spotlightTile.price)}
                    </span>
                    {spotlightTile.houseCost ? (
                      <span className="money rounded-full border border-ink bg-mint-pale px-2 py-[1px] font-bold" style={{ fontSize: "0.66em" }}>
                        Rumah {rp(spotlightTile.houseCost)}
                      </span>
                    ) : (
                      <span className="money rounded-full border border-ink bg-sun-pale px-2 py-[1px] font-bold" style={{ fontSize: "0.66em" }}>
                        Sewa {rp(rentPreview(state, spotlightTile.id))}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right Bento Column: Aktivitas Live + Peta Grup Nusantara + Dek Kartu */}
            <div className="flex min-h-0 flex-col gap-[1.8%]">
              {/* Top: Aktivitas Live */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border-[2.5px] border-ink bg-white">
                <div className="flex items-center justify-between border-b-[2px] border-ink bg-ink px-[3%] py-[1.6%] text-white">
                  <span className="font-display font-extrabold tracking-tight" style={{ fontSize: "0.84em" }}>
                    Aktivitas Live
                  </span>
                  <span className="flex items-center gap-1 font-bold text-mint" style={{ fontSize: "0.64em" }}>
                    <span className="inline-block h-[6px] w-[6px] rounded-full bg-mint animate-[pulse-mint_1.6s_ease-out_infinite]" />
                    Live
                  </span>
                </div>

                <div className="scroll-thin flex-1 divide-y divide-divider overflow-y-auto px-[3%] py-[0.8%]">
                  {state.log
                    .slice(-40)
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-1.5 py-[1.4%] leading-snug"
                        style={{ fontSize: "0.76em" }}
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
                          style={{ fontSize: "0.78em" }}
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

              {/* Bottom: Peta Penguasaan Grup & Dek Kartu (Fills space beautifully!) */}
              <div className="flex shrink-0 flex-col gap-[1.5%] rounded-[20px] border-[2.5px] border-ink bg-white p-[2.4%]">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-[0.08em] text-ink-soft" style={{ fontSize: "0.64em" }}>
                    Peta Grup Nusantara
                  </span>
                  <span className="font-semibold text-ink-soft" style={{ fontSize: "0.62em" }}>
                    Ketuk grup untuk lihat kota
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  {(Object.keys(GROUP_TILES) as GroupId[]).map((g) => {
                    const ids = GROUP_TILES[g];
                    const monoOwner = state.players.find((p) => groupComplete(state, g, p.id));
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => onSelect(ids[0])}
                        onMouseEnter={() => setHoveredTile(ids[0])}
                        onMouseLeave={() => setHoveredTile(null)}
                        className="flex flex-col items-start gap-[2px] rounded-xl border border-ink bg-tint/70 px-1.5 py-[3px] text-left transition-colors hover:bg-sun-pale"
                        title={`Grup ${GROUP_NAMES[g]}: ${ids.map((id) => TILES[id].name).join(", ")}`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span
                            className="h-[7px] w-[14px] rounded-full border border-ink"
                            style={{ background: GROUP_COLORS[g] }}
                          />
                          {monoOwner ? (
                            <span className="font-bold leading-none text-tomato" style={{ fontSize: "0.66em" }}>
                              ★
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-[2px]">
                          {ids.map((id) => {
                            const o = playerOf(state, state.tiles[id].owner);
                            return (
                              <span
                                key={id}
                                className="h-[6px] w-[6px] rounded-full border border-ink"
                                style={{ background: o ? o.color : "#FFFFFF" }}
                              />
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Tactile Mini Card Decks */}
                <div className="grid grid-cols-2 gap-1.5 pt-[1px]">
                  <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-ink bg-sun-pale px-2 py-[3px]">
                    <span className="flex h-[1.4em] w-[1.4em] items-center justify-center rounded-md border border-ink bg-sun font-display font-extrabold" style={{ fontSize: "0.72em" }}>
                      ?
                    </span>
                    <span className="truncate font-bold text-ink" style={{ fontSize: "0.66em" }}>
                      Kesempatan
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-ink bg-mint-pale px-2 py-[3px]">
                    <span className="flex h-[1.4em] w-[1.4em] items-center justify-center rounded-md border border-ink bg-mint font-display font-extrabold" style={{ fontSize: "0.72em" }}>
                      🎁
                    </span>
                    <span className="truncate font-bold text-ink" style={{ fontSize: "0.66em" }}>
                      Dana Umum
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Ticker for National Events / Effects / Golden Turn */}
          {state.event || state.effects.length > 0 || state.players.some((p) => p.goldenActive) ? (
            <div className="flex flex-wrap items-center gap-1">
              {state.event ? (
                <span className="chip bg-sun text-ink" style={{ fontSize: "0.68em" }} title={state.event.text}>
                  ⚡ {state.event.label}: {state.event.text}
                </span>
              ) : null}
              {state.effects.slice(0, 3).map((e) => (
                <span key={e.id} className="chip bg-tomato-pale text-ink" style={{ fontSize: "0.66em" }}>
                  {e.label} · {e.roundsLeft}r
                </span>
              ))}
              {state.players
                .filter((p) => p.goldenActive)
                .map((p) => (
                  <span key={p.id} className="chip bg-sun text-ink" style={{ fontSize: "0.66em" }}>
                    ★ Giliran Emas: {p.name}
                  </span>
                ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 3D Animated Player Pawns */}
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
              className="absolute transition-all duration-150 ease-out"
              style={{
                left: `calc(${((col - 0.5) / 11) * 100}% + ${offsetX}em)`,
                top: `calc(${((row - 0.5) / 11) * 100}% + 0.35em)`,
                transform: "translate(-50%, -50%)",
                zIndex: isTurn ? 35 : 20 + idx,
              }}
            >
              <BoardPawn
                index={idx}
                color={p.color}
                name={p.name}
                active={isTurn}
                hopping={isHopping}
                bankrupt={p.bankrupt}
              />
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
