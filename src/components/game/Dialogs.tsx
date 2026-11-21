"use client";

import { useEffect, useMemo, useState } from "react";
import { GROUP_COLORS, GROUP_NAMES, GROUP_TILES, MISSIONS, SHOP_CARDS, TILES, WAVE_LABEL, WAVE_MULT } from "@/engine/data";
import {
  buildCost,
  current,
  features,
  groupComplete,
  living,
  playerOf,
  scoreOf,
} from "@/engine/actions";
import type { Action, GameState, GroupId, TradeOffer } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { PlayerInspect } from "@/components/game/Panels";
import { PawnAvatar, TileArtwork } from "@/components/game/CityArt";
import { Button, Chip, Modal } from "@/components/ui/kit";

export function AuctionDialog({
  state,
  act,
  viewerId,
  onFocusTile,
}: {
  state: GameState;
  act: (a: Action) => void;
  viewerId?: string | null;
  onFocusTile?: (tileId: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const [peeking, setPeeking] = useState(false);
  const a = state.auction;

  useEffect(() => {
    setPeeking(false);
    setCustom("");
  }, [a?.tile]);

  if (!a) return null;
  const tile = TILES[a.tile];
  const bidder = playerOf(state, a.current);
  const leader = playerOf(state, a.leader);
  const marketPrice = tile.price ?? 100;
  const step = Math.max(10, Math.round(marketPrice * 0.1));
  const isHumanBidder = Boolean(bidder && !bidder.isBot);
  const canBid = viewerId ? Boolean(isHumanBidder && bidder?.id === viewerId) : isHumanBidder;

  const diffPct = a.bid > 0 ? Math.round(((marketPrice - a.bid) / marketPrice) * 100) : 0;

  // Check if any player is 1 tile away from monopoly on this tile's group
  const monopolyThreat = tile.group
    ? state.players.find((pl) => {
        if (pl.bankrupt) return false;
        const ids = GROUP_TILES[tile.group!];
        const ownedCount = ids.filter((id) => id !== tile.id && state.tiles[id].owner === pl.id).length;
        return ownedCount === ids.length - 1;
      })
    : null;

  if (peeking) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[55] mx-auto max-w-2xl px-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-[24px] border-[3px] border-ink bg-white p-3 shadow-lg animate-[pop_0.2s_var(--ease-out-soft)]">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-sun-pale p-1">
              <TileArtwork tileId={tile.id} />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-sm font-extrabold">🔨 {tile.name}</span>
                <span className="money rounded-full border border-ink bg-sun px-2 py-0.5 text-xs font-extrabold">
                  {rp(a.bid)}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-ink-soft">
                Pemimpin: <b className="text-ink">{leader?.name ?? "Belum ada"}</b> · Penawar:{" "}
                <b className="text-ink">{bidder?.name ?? "—"}</b>
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {canBid && bidder ? (
              <>
                <Button
                  variant="sun"
                  className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                  disabled={a.bid + step > bidder.cash}
                  onClick={() => act({ type: "BID", amount: a.bid + step })}
                >
                  +{step}
                </Button>
                <Button
                  variant="primary"
                  className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                  disabled={a.bid + step * 2 > bidder.cash}
                  onClick={() => act({ type: "BID", amount: a.bid + step * 2 })}
                >
                  +{step * 2}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 sm:min-h-0 px-2.5 py-1.5 text-xs"
                  onClick={() => act({ type: "PASS_BID" })}
                >
                  Lewati
                </Button>
              </>
            ) : null}
            <Button
              variant="blue"
              className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
              onClick={() => setPeeking(false)}
            >
              🔼 Detail Lelang
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal open title={`Lelang Terbuka · ${tile.name}`} onClose={() => {}} dismissable={false} width="max-w-md">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-soft">
            Perlu cek kepemilikan grup di peta?
          </span>
          <Button
            className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
            onClick={() => {
              onFocusTile?.(tile.id);
              setPeeking(true);
            }}
          >
            🗺️ Lihat Papan
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-sun-pale p-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-white p-1">
            <TileArtwork tileId={tile.id} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-ink-soft">
              Penawaran tertinggi · Harga normal <span className="money">{rp(marketPrice)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="money text-2xl font-extrabold text-ink">{rp(a.bid)}</span>
              {a.bid > 0 ? (
                <Chip color={diffPct >= 0 ? "#2FD592" : "#FFE4DD"}>
                  {diffPct >= 0 ? `Hemat ${diffPct}%` : `+${Math.abs(diffPct)}% dari harga`}
                </Chip>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-ink-soft">Pemimpin</div>
            <div className="font-display text-sm font-extrabold">{leader?.name ?? "Belum ada"}</div>
          </div>
        </div>

        {tile.group ? (
          <div className="rounded-2xl border-2 border-ink bg-tint p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">Grup {GROUP_NAMES[tile.group]}:</span>
              {GROUP_TILES[tile.group].map((sid) => {
                const sOwner = playerOf(state, state.tiles[sid].owner);
                return (
                  <span
                    key={sid}
                    className={cn(
                      "rounded-full border border-ink px-2 py-0.5 text-[11px] font-bold",
                      sid === tile.id ? "bg-sun text-ink" : "bg-white",
                    )}
                  >
                    {TILES[sid].short}
                    {sOwner ? ` (${sOwner.name})` : " (Kosong)"}
                  </span>
                );
              })}
            </div>
            {monopolyThreat ? (
              <div className="mt-1.5 text-xs font-bold text-tomato">
                ⚡ Perhatian: {monopolyThreat.name} tinggal butuh petak ini untuk Monopoli!
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          className="rounded-2xl border-[2.5px] border-ink bg-tint p-3"
          style={bidder ? { borderLeftWidth: "8px", borderLeftColor: bidder.color } : undefined}
        >
          <div className="text-xs font-semibold text-ink-soft">Giliran menawar</div>
          <div className="mt-1 flex items-center gap-2">
            {bidder ? (
              <PawnAvatar
                index={bidder.tokenIndex ?? Math.max(0, state.players.findIndex((p) => p.id === bidder.id))}
                color={bidder.color}
                size={32}
              />
            ) : null}
            <div className="font-display text-xl font-extrabold">{bidder?.name ?? "—"}</div>
          </div>
          {bidder?.isBot ? (
            <div className="mt-1 text-xs font-medium text-ink-soft">Bot sedang mempertimbangkan tawaran…</div>
          ) : !canBid ? (
            <div className="mt-1 text-xs font-semibold text-ink-soft">
              Menunggu {bidder?.name ?? "pemain"} menawar…
            </div>
          ) : null}
        </div>

        {/* Active Bidders */}
        <div className="flex flex-wrap items-center gap-1.5">
          {a.active.map((pid) => {
            const bp = playerOf(state, pid);
            if (!bp) return null;
            const seatIdx = Math.max(0, state.players.findIndex((x) => x.id === bp.id));
            return (
              <span
                key={pid}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-ink px-2 py-0.5 text-[11px] font-bold",
                  a.current === pid ? "bg-sun" : "bg-white",
                )}
              >
                <PawnAvatar index={bp.tokenIndex ?? seatIdx} color={bp.color} size={16} className="border p-0" />
                {bp.name} ({rp(bp.cash)})
              </span>
            );
          })}
        </div>

        {canBid && bidder ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[step, step * 2, step * 5].map((inc) => (
                <Button
                  key={inc}
                  variant="sun"
                  disabled={a.bid + inc > bidder.cash}
                  onClick={() => act({ type: "BID", amount: a.bid + inc })}
                  className="text-xs"
                >
                  +{inc}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="field flex-1 text-sm"
                inputMode="numeric"
                placeholder={`Minimal ${a.bid + 10}`}
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <Button
                variant="primary"
                disabled={!custom || Number(custom) <= a.bid || Number(custom) > bidder.cash}
                onClick={() => {
                  act({ type: "BID", amount: Number(custom) });
                  setCustom("");
                }}
              >
                Tawar
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => act({ type: "PASS_BID" })}>
              Lewati Lelang
            </Button>
            <p className="text-center text-xs font-semibold text-ink-soft">
              Sisa cash kamu: <span className="money font-bold text-ink">{rp(bidder.cash)}</span>
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export function TradeDialog({
  state,
  act,
  open,
  onClose,
  viewerId,
  onFocusTile,
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
  onFocusTile?: (tileId: number) => void;
}) {
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;
  const others = living(state).filter((p) => p.id !== me?.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [giveCash, setGiveCash] = useState(0);
  const [wantCash, setWantCash] = useState(0);
  const [giveProps, setGiveProps] = useState<number[]>([]);
  const [wantProps, setWantProps] = useState<number[]>([]);
  const [peeking, setPeeking] = useState(false);
  const [counterMode, setCounterMode] = useState(false);

  const tradeSig = state.trade
    ? `${state.trade.from}->${state.trade.to}:${state.trade.giveCash}:${state.trade.wantCash}:${state.trade.giveProps.join(",")}:${state.trade.wantProps.join(",")}`
    : "";

  useEffect(() => {
    setPeeking(false);
    setCounterMode(false);
  }, [tradeSig]);

  const effectiveTarget = others.some((o) => o.id === target) ? target : (others[0]?.id ?? "");
  const to = playerOf(state, effectiveTarget);

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  if (state.trade) {
    if (!open) return null;
    const offer = state.trade;
    const from = playerOf(state, offer.from);
    const recipient = playerOf(state, offer.to);

    if (viewerId && offer.to !== viewerId && offer.from !== viewerId) {
      return null;
    }

    const canRespond = viewerId ? offer.to === viewerId : !recipient?.isBot;
    const closeOffer = () => {
      if (canRespond) act({ type: "TRADE_RESPOND", accept: false });
      onClose();
    };

    // Counter-Offer Composer Mode
    if (counterMode && recipient && from) {
      return (
        <Modal
          open={open}
          title={`Nego Balik ke ${from.name}`}
          onClose={() => setCounterMode(false)}
          width="max-w-lg"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-soft">
                Atur ulang uang atau properti lalu kirim balik ke <b className="text-ink">{from.name}</b>.
              </span>
              <Button
                className="min-h-11 sm:min-h-0 px-3 py-1 text-xs"
                onClick={() => setCounterMode(false)}
              >
                ← Kembali
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border-[2.5px] border-ink bg-tint p-3">
                <div className="mb-1 text-xs font-bold text-ink-soft">Kamu beri ke {from.name}</div>
                <input
                  type="range"
                  min={0}
                  max={recipient.cash}
                  step={10}
                  value={Math.min(giveCash, recipient.cash)}
                  onChange={(e) => setGiveCash(Number(e.target.value))}
                  className="w-full accent-[#FF5A3C]"
                />
                <div className="money text-sm font-extrabold">{rp(giveCash)}</div>
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                  {recipient.properties.map((id) => (
                    <label key={id} className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={giveProps.includes(id)}
                        disabled={state.tiles[id].houses > 0}
                        onChange={() => toggle(giveProps, setGiveProps, id)}
                      />
                      {TILES[id].short}
                      {state.tiles[id].houses > 0 ? " (ada rumah)" : ""}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border-[2.5px] border-ink bg-tint p-3">
                <div className="mb-1 text-xs font-bold text-ink-soft">Kamu minta dari {from.name}</div>
                <input
                  type="range"
                  min={0}
                  max={from.cash}
                  step={10}
                  value={Math.min(wantCash, from.cash)}
                  onChange={(e) => setWantCash(Number(e.target.value))}
                  className="w-full accent-[#2F5BFF]"
                />
                <div className="money text-sm font-extrabold">{rp(wantCash)}</div>
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                  {from.properties.map((id) => (
                    <label key={id} className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={wantProps.includes(id)}
                        disabled={state.tiles[id].houses > 0}
                        onChange={() => toggle(wantProps, setWantProps, id)}
                      />
                      {TILES[id].short}
                      {state.tiles[id].houses > 0 ? " (ada rumah)" : ""}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              disabled={giveCash === 0 && wantCash === 0 && giveProps.length === 0 && wantProps.length === 0}
              onClick={() => {
                const counter: TradeOffer = {
                  from: recipient.id,
                  to: from.id,
                  giveCash,
                  giveProps,
                  giveCards: 0,
                  wantCash,
                  wantProps,
                  wantCards: 0,
                };
                setCounterMode(false);
                act({ type: "TRADE_OFFER", offer: counter });
              }}
            >
              🔄 Kirim Tawaran Balik ke {from.name} →
            </Button>
          </div>
        </Modal>
      );
    }

    const startCounter = () => {
      setTarget(offer.from);
      setGiveCash(offer.wantCash);
      setWantCash(offer.giveCash);
      setGiveProps([...offer.wantProps]);
      setWantProps([...offer.giveProps]);
      setPeeking(false);
      setCounterMode(true);
    };

    // Smart Trade Advisor Analysis
    const gainVal = offer.giveCash + offer.giveProps.reduce((a, id) => a + (TILES[id].price ?? 0), 0);
    const lossVal = offer.wantCash + offer.wantProps.reduce((a, id) => a + (TILES[id].price ?? 0), 0);
    const netDiff = gainVal - lossVal;

    const senderMonopolies: GroupId[] = [];
    const recipientMonopolies: GroupId[] = [];
    if (from && recipient) {
      for (const g of Object.keys(GROUP_TILES) as GroupId[]) {
        const ids = GROUP_TILES[g];
        const fromHad = groupComplete(state, g, from.id);
        const recHad = groupComplete(state, g, recipient.id);
        const fromAfter = ids.every(
          (id) =>
            (state.tiles[id].owner === from.id && !offer.giveProps.includes(id)) || offer.wantProps.includes(id),
        );
        const recAfter = ids.every(
          (id) =>
            (state.tiles[id].owner === recipient.id && !offer.wantProps.includes(id)) || offer.giveProps.includes(id),
        );
        if (!fromHad && fromAfter) senderMonopolies.push(g);
        if (!recHad && recAfter) recipientMonopolies.push(g);
      }
    }

    // Floating Non-Blocking Map Peek Dock
    if (peeking) {
      return (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[55] mx-auto max-w-2xl px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-[24px] border-[3px] border-ink bg-white p-3 shadow-lg animate-[pop_0.2s_var(--ease-out-soft)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip color="#FFD23F">🤝 Tawaran Dagang</Chip>
                <span className="font-display text-sm font-extrabold">
                  {from?.name} → {recipient?.name}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-ink-soft">
                <span>
                  Terima: <b className="text-positive">{rp(offer.giveCash)}</b>
                  {offer.giveProps.length ? ` + ${offer.giveProps.map((id) => TILES[id].short).join(", ")}` : ""}
                </span>
                <span>·</span>
                <span>
                  Beri: <b className="text-tomato">{rp(offer.wantCash)}</b>
                  {offer.wantProps.length ? ` + ${offer.wantProps.map((id) => TILES[id].short).join(", ")}` : ""}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {canRespond ? (
                <>
                  <Button
                    variant="mint"
                    className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                    onClick={() => act({ type: "TRADE_RESPOND", accept: true })}
                  >
                    ✓ Terima
                  </Button>
                  <Button
                    variant="sun"
                    className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                    onClick={startCounter}
                  >
                    🔄 Nego Balik
                  </Button>
                  <Button
                    variant="danger"
                    className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                    onClick={() => act({ type: "TRADE_RESPOND", accept: false })}
                  >
                    ✕ Tolak
                  </Button>
                </>
              ) : null}
              <Button
                variant="blue"
                className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                onClick={() => setPeeking(false)}
              >
                🔼 Detail
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Modal
        open={open}
        title={canRespond ? `Tawaran Dagang untuk ${recipient?.name}` : "Tawaran Dagang Terkirim"}
        onClose={closeOffer}
        width="max-w-md"
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-ink-soft">
              <b className="text-ink">{from?.name}</b> menawarkan ke <b className="text-ink">{recipient?.name}</b>
            </p>
            <Button
              className="min-h-11 sm:min-h-0 shrink-0 px-3 py-1.5 text-xs"
              onClick={() => {
                const focusId = offer.wantProps[0] ?? offer.giveProps[0];
                if (focusId !== undefined) onFocusTile?.(focusId);
                setPeeking(true);
              }}
            >
              🗺️ Lihat Papan
            </Button>
          </div>

          <div className="grid gap-2.5">
            <div className="rounded-2xl border-[2.5px] border-ink bg-mint-pale p-3">
              <div className="text-xs font-bold text-ink-soft">
                {canRespond ? "Kamu terima" : `${recipient?.name} terima`}
              </div>
              <div className="money text-base font-extrabold">{rp(offer.giveCash)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {offer.giveProps.map((id) => (
                  <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                    {TILES[id].short} ({rp(TILES[id].price ?? 0)})
                  </Chip>
                ))}
                {offer.giveCards > 0 ? <Chip>+{offer.giveCards} kartu</Chip> : null}
              </div>
            </div>
            <div className="rounded-2xl border-[2.5px] border-ink bg-tomato-pale p-3">
              <div className="text-xs font-bold text-ink-soft">
                {canRespond ? "Kamu beri" : `${recipient?.name} beri`}
              </div>
              <div className="money text-base font-extrabold">{rp(offer.wantCash)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {offer.wantProps.map((id) => (
                  <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                    {TILES[id].short} ({rp(TILES[id].price ?? 0)})
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Smart Trade Advisor */}
          <div className="rounded-2xl border-2 border-ink bg-tint p-3 text-xs">
            <div className="flex items-center justify-between font-bold">
              <span className="text-ink-soft">Analisis Nilai Aset</span>
              <Chip color={netDiff >= 0 ? "#2FD592" : "#FFE4DD"}>
                {netDiff >= 0 ? `+${rp(netDiff)} untung` : `−${rp(Math.abs(netDiff))} selisih`}
              </Chip>
            </div>
            {senderMonopolies.map((g) => (
              <p key={g} className="mt-1.5 font-bold text-tomato">
                ⚠️ Awas: {from?.name} akan melengkapi Monopoli grup {GROUP_NAMES[g]}!
              </p>
            ))}
            {recipientMonopolies.map((g) => (
              <p key={g} className="mt-1.5 font-bold text-positive">
                ✨ Peluang: Kamu akan melengkapi Monopoli grup {GROUP_NAMES[g]}!
              </p>
            ))}
          </div>

          {canRespond ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="mint" onClick={() => act({ type: "TRADE_RESPOND", accept: true })}>
                  ✓ Terima
                </Button>
                <Button variant="danger" onClick={() => act({ type: "TRADE_RESPOND", accept: false })}>
                  ✕ Tolak
                </Button>
              </div>
              <Button variant="sun" className="w-full text-xs" onClick={startCounter}>
                🔄 Nego Balik (Ubah Tawaran)
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border-[2px] border-ink bg-tint px-3 py-2.5 text-center text-xs font-bold text-ink-soft">
              Menunggu respon {recipient?.name}…
            </div>
          )}
        </div>
      </Modal>
    );
  }

  if (!me || !to) return null;

  return (
    <Modal open={open} onClose={onClose} title="Ajukan Transaksi Dagang" width="max-w-lg">
      <div className="space-y-3.5">
        <div>
          <label className="text-xs font-bold text-ink-soft">Pilih lawan dagang</label>
          <select
            className="field mt-1.5 w-full text-sm"
            value={effectiveTarget}
            onChange={(e) => {
              setTarget(e.target.value);
              setWantProps([]);
              setWantCash(0);
            }}
          >
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({rp(p.cash)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-[2.5px] border-ink bg-tint p-3">
            <div className="mb-1 text-xs font-bold text-ink-soft">Kamu tawarkan</div>
            <input
              type="range"
              min={0}
              max={me.cash}
              step={10}
              value={Math.min(giveCash, me.cash)}
              onChange={(e) => setGiveCash(Number(e.target.value))}
              className="w-full accent-[#FF5A3C]"
            />
            <div className="money text-sm font-extrabold">{rp(giveCash)}</div>
            <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
              {me.properties.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={giveProps.includes(id)}
                    disabled={state.tiles[id].houses > 0}
                    onChange={() => toggle(giveProps, setGiveProps, id)}
                  />
                  {TILES[id].short}
                  {state.tiles[id].houses > 0 ? " (ada rumah)" : ""}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-[2.5px] border-ink bg-tint p-3">
            <div className="mb-1 text-xs font-bold text-ink-soft">Kamu minta</div>
            <input
              type="range"
              min={0}
              max={to.cash}
              step={10}
              value={Math.min(wantCash, to.cash)}
              onChange={(e) => setWantCash(Number(e.target.value))}
              className="w-full accent-[#2F5BFF]"
            />
            <div className="money text-sm font-extrabold">{rp(wantCash)}</div>
            <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
              {to.properties.map((id) => (
                <label key={id} className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={wantProps.includes(id)}
                    disabled={state.tiles[id].houses > 0}
                    onChange={() => toggle(wantProps, setWantProps, id)}
                  />
                  {TILES[id].short}
                  {state.tiles[id].houses > 0 ? " (ada rumah)" : ""}
                </label>
              ))}
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full"
          disabled={giveCash === 0 && wantCash === 0 && giveProps.length === 0 && wantProps.length === 0}
          onClick={() => {
            const offer: TradeOffer = {
              from: me.id,
              to: to.id,
              giveCash,
              giveProps,
              giveCards: 0,
              wantCash,
              wantProps,
              wantCards: 0,
            };
            act({ type: "TRADE_OFFER", offer });
            setGiveCash(0);
            setWantCash(0);
            setGiveProps([]);
            setWantProps([]);
          }}
        >
          Kirim Tawaran Dagang →
        </Button>
      </div>
    </Modal>
  );
}

export function PortfolioDialog({
  state,
  act,
  open,
  onClose,
  viewerId,
  canAct = true,
  onOpenBank,
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
  canAct?: boolean;
  onOpenBank?: () => void;
}) {
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;

  const grouped = useMemo(() => {
    if (!me) return { groups: [], specials: [] };
    const groups = (Object.keys(GROUP_TILES) as GroupId[])
      .map((g) => {
        const ids = GROUP_TILES[g];
        const owned = ids.filter((id) => state.tiles[id].owner === me.id);
        return {
          group: g,
          total: ids.length,
          owned,
          complete: owned.length === ids.length,
        };
      })
      .filter((x) => x.owned.length > 0);
    const specials = me.properties.filter((id) => !TILES[id].group);
    return { groups, specials };
  }, [me, state.tiles]);

  if (!me) return null;
  const isTurn = viewerId ? Boolean(turnPlayer?.id === me.id && canAct) : canAct;

  return (
    <Modal open={open} onClose={onClose} title={`Aset & Properti · ${me.name}`} width="max-w-xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-ink bg-tint p-3">
          <div>
            <div className="text-xs font-semibold text-ink-soft">Cash tersedia</div>
            <div className="money text-xl font-extrabold text-positive">{rp(me.cash)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Chip color="#DFE6FF">{me.properties.length} properti</Chip>
            {onOpenBank ? (
              <Button
                variant="sun"
                className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                onClick={() => {
                  onClose();
                  onOpenBank();
                }}
              >
                🏦 Pinjam / Saham
              </Button>
            ) : null}
          </div>
        </div>

        {!isTurn ? (
          <p className="rounded-2xl border-2 border-ink bg-sun-pale px-3 py-2 text-xs font-semibold">
            Sedang menunggu giliranmu untuk membangun atau menggadaikan properti.
          </p>
        ) : null}

        {me.properties.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/35 bg-tint p-6 text-center text-sm font-semibold text-ink-soft">
            Kamu belum memiliki kota atau aset apa pun.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.groups.map(({ group, total, owned, complete }) => {
              const othersHouses = GROUP_TILES[group].map((id) => state.tiles[id].houses);
              const minHouses = Math.min(...othersHouses);
              const maxHouses = Math.max(...othersHouses);

              return (
                <div key={group} className="overflow-hidden rounded-2xl border-[2.5px] border-ink bg-white">
                  <div
                    className="flex items-center justify-between border-b-[2px] border-ink px-3.5 py-2"
                    style={{ background: GROUP_COLORS[group] }}
                  >
                    <span className="rounded-full border border-ink bg-white px-2.5 py-0.5 font-display text-xs font-extrabold">
                      {GROUP_NAMES[group]} ({owned.length}/{total})
                    </span>
                    <Chip color={complete ? "#2FD592" : "#FFFFFF"}>
                      {complete ? "★ Monopoli Aktif" : `Kurang ${total - owned.length} kota`}
                    </Chip>
                  </div>

                  <div className="divide-y divide-divider">
                    {owned.map((id) => {
                      const tile = TILES[id];
                      const st = state.tiles[id];
                      const cost = buildCost(state, id, me);
                      const canBuild =
                        isTurn &&
                        state.phase === "post_roll" &&
                        complete &&
                        st.houses < 5 &&
                        !st.mortgaged &&
                        (st.houses === 4 ? state.hotelsBank > 0 : state.housesBank > 0) &&
                        st.houses <= minHouses &&
                        me.cash >= cost;
                      const canSell = isTurn && st.houses > 0 && st.houses >= maxHouses;
                      const canMortgage = isTurn && st.houses === 0 && !st.mortgaged;
                      const unmortgageCost = Math.ceil(((tile.price ?? 0) / 2) * 1.1);
                      const canUnmortgage = isTurn && st.mortgaged && me.cash >= unmortgageCost;

                      return (
                        <div key={id} className="flex flex-wrap items-center gap-2.5 p-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl border-2 border-ink bg-tint p-1">
                            <TileArtwork tileId={id} />
                          </div>
                          <div className="min-w-[120px] flex-1">
                            <div className="font-display text-sm font-extrabold">{tile.name}</div>
                            <div className="text-[11px] font-semibold text-ink-soft">
                              {st.mortgaged
                                ? "Status: Tergadai"
                                : st.houses === 5
                                  ? "Bangunan: ★ Hotel"
                                  : st.houses > 0
                                    ? `Bangunan: ${st.houses} Rumah`
                                    : "Tanah kosong"}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {complete && !st.mortgaged && st.houses < 5 ? (
                              <Button
                                variant="sun"
                                className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                                disabled={!canBuild}
                                onClick={() => act({ type: "BUILD", tile: id })}
                              >
                                + {st.houses === 4 ? "Hotel" : "Rumah"} ({rp(cost)})
                              </Button>
                            ) : null}
                            {st.houses > 0 ? (
                              <Button
                                className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                                disabled={!canSell}
                                onClick={() => act({ type: "SELL_HOUSE", tile: id })}
                              >
                                − Jual (+{rp(Math.floor((tile.houseCost ?? 0) / 2))})
                              </Button>
                            ) : null}
                            {st.mortgaged ? (
                              <Button
                                variant="mint"
                                className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                                disabled={!canUnmortgage}
                                onClick={() => act({ type: "UNMORTGAGE", tile: id })}
                              >
                                Tebus ({rp(unmortgageCost)})
                              </Button>
                            ) : st.houses === 0 ? (
                              <Button
                                className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                                disabled={!canMortgage}
                                onClick={() => act({ type: "MORTGAGE", tile: id })}
                              >
                                Gadai (+{rp(Math.floor((tile.price ?? 0) / 2))})
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {grouped.specials.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border-[2.5px] border-ink bg-white">
                <div className="border-b-[2px] border-ink bg-blue-pale px-3.5 py-2 font-display text-xs font-extrabold">
                  Transportasi &amp; Utilitas
                </div>
                <div className="divide-y divide-divider">
                  {grouped.specials.map((id) => {
                    const tile = TILES[id];
                    const st = state.tiles[id];
                    const unmortgageCost = Math.ceil(((tile.price ?? 0) / 2) * 1.1);
                    return (
                      <div key={id} className="flex flex-wrap items-center gap-2.5 p-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl border-2 border-ink bg-tint p-1">
                          <TileArtwork tileId={id} />
                        </div>
                        <div className="flex-1">
                          <div className="font-display text-sm font-extrabold">{tile.name}</div>
                          <div className="text-[11px] font-semibold text-ink-soft">
                            {st.mortgaged ? "Status: Tergadai" : tile.type === "transport" ? "Transportasi" : "Utilitas"}
                          </div>
                        </div>
                        {st.mortgaged ? (
                          <Button
                            variant="mint"
                            className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                            disabled={!isTurn || me.cash < unmortgageCost}
                            onClick={() => act({ type: "UNMORTGAGE", tile: id })}
                          >
                            Tebus ({rp(unmortgageCost)})
                          </Button>
                        ) : (
                          <Button
                            className="min-h-11 sm:min-h-0 px-2.5 py-1 text-[11px]"
                            disabled={!isTurn}
                            onClick={() => act({ type: "MORTGAGE", tile: id })}
                          >
                            Gadai (+{rp(Math.floor((tile.price ?? 0) / 2))})
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ShopDialog({
  state,
  act,
  open,
  onClose,
  viewerId,
  canAct = true,
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
  canAct?: boolean;
}) {
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;
  if (!me) return null;
  const isTurn = viewerId ? Boolean(turnPlayer?.id === me.id && canAct) : canAct;
  const closed = state.effects.some((e) => e.kind === "shop_closed");
  const cards = state.shop.map((id) => SHOP_CARDS.find((c) => c.id === id)).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title="Pasar Loak" width="max-w-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span>Cash: <span className="money">{rp(me.cash)}</span></span>
          <Chip color="#DFE6FF">Kartu di tangan {me.hand.length}/2</Chip>
        </div>
        {!isTurn ? (
          <p className="rounded-2xl border-2 border-ink bg-tint p-2.5 text-xs font-semibold text-ink-soft">
            Menunggu giliranmu untuk membeli atau memakai kartu Pasar Loak.
          </p>
        ) : null}
        {closed ? (
          <p className="rounded-2xl border-2 border-ink bg-tomato-pale p-2.5 text-xs font-bold">
            Pasar Loak tutup sementara ronde ini.
          </p>
        ) : null}
        {cards.map((c) =>
          c ? (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-white p-3">
              <div className="flex-1">
                <div className="font-display text-base font-extrabold">{c.name}</div>
                <p className="text-xs text-ink-soft">{c.desc}</p>
                <div className="money mt-1 text-xs font-bold text-blue">
                  {rp(state.wave >= 3 ? c.priceLate : c.priceEarly)}
                </div>
              </div>
              <Button
                variant="sun"
                className="text-xs"
                disabled={
                  !isTurn ||
                  state.shopBought ||
                  closed ||
                  me.hand.length >= 2 ||
                  me.cash < (state.wave >= 3 ? c.priceLate : c.priceEarly)
                }
                onClick={() => act({ type: "BUY_SHOP", card: c.id })}
              >
                {state.shopBought ? "Sudah beli" : "Beli"}
              </Button>
            </div>
          ) : null,
        )}
        {me.hand.length > 0 ? (
          <div className="rounded-2xl border-[2.5px] border-ink bg-tint p-3">
            <div className="mb-2 text-xs font-bold text-ink-soft">Kartu aktif milikmu</div>
            {me.hand.map((id, idx) => {
              const c = SHOP_CARDS.find((x) => x.id === id);
              const target = autoTarget(state, me.id, c?.kind ?? "");
              return (
                <div key={`${id}-${idx}`} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-xs font-bold">{c?.name}</span>
                  <Button
                    variant="primary"
                    className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                    disabled={!isTurn || target === null}
                    onClick={() => act({ type: "USE_CARD", card: id, target: target ?? undefined })}
                  >
                    Pakai Kartu
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function autoTarget(state: GameState, playerId: string, kind: string): number | null {
  const me = playerOf(state, playerId);
  if (!me) return null;
  if (kind === "promo" || kind === "legalitas") {
    const owned = me.properties
      .filter((id) => (kind === "legalitas" ? state.tiles[id].houses < 5 : true))
      .sort((a, b) => (TILES[b].rents?.[state.tiles[b].houses] ?? 0) - (TILES[a].rents?.[state.tiles[a].houses] ?? 0));
    return owned[0] ?? null;
  }
  if (kind === "operasi") {
    const target = living(state)
      .filter((p) => p.id !== me.id)
      .flatMap((p) => p.properties)
      .find((id) => state.tiles[id].houses === 0 && TILES[id].type === "property");
    return target ?? null;
  }
  return 0;
}

export function BankDialog({
  state,
  act,
  open,
  onClose,
  viewerId,
  canAct = true,
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
  canAct?: boolean;
}) {
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;
  if (!me) return null;
  const isTurn = viewerId ? Boolean(turnPlayer?.id === me.id && canAct) : canAct;
  const cap = state.wave === 1 ? 500 : 800;
  const debt = me.loans.reduce((a, l) => a + l.principal, 0);
  const room = Math.max(0, cap - debt);

  const shares = (Object.keys(GROUP_TILES) as GroupId[]).map((g) => {
    const total = GROUP_TILES[g].reduce((a, id) => a + (TILES[id].price ?? 0), 0);
    return { g, price: Math.round((total * 0.2) / 10) * 10, owned: me.shares.includes(g) };
  });

  return (
    <Modal open={open} onClose={onClose} title="Bank & Bursa Saham" width="max-w-lg">
      <div className="space-y-3.5">
        {!isTurn ? (
          <p className="rounded-2xl border-2 border-ink bg-tint p-2.5 text-xs font-semibold text-ink-soft">
            Tunggu giliranmu untuk bertransaksi dengan Bank.
          </p>
        ) : null}
        <div className="rounded-2xl border-[2.5px] border-ink bg-white p-3.5">
          <div className="flex items-center justify-between">
            <div className="font-display text-base font-extrabold">Pinjaman Bank</div>
            <Chip color={debt > 0 ? "#FFE4DD" : "#D5F7E8"}>{debt > 0 ? rp(debt) : "Bebas utang"}</Chip>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Bunga {me.character === "arsitek" ? "15%" : "10%"} per ronde. Batas fase ini {rp(cap)} · Sisa limit {rp(room)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[100, 250, 500].map((amount) => (
              <Button
                key={amount}
                className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
                disabled={!isTurn || !features(state).loans || amount > room}
                onClick={() => act({ type: "TAKE_LOAN", amount })}
              >
                Pinjam {rp(amount)}
              </Button>
            ))}
            <Button
              variant="mint"
              className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
              disabled={!isTurn || debt === 0 || me.cash < debt}
              onClick={() => act({ type: "REPAY_LOAN" })}
            >
              Lunasi Semua
            </Button>
          </div>
          {!features(state).loans ? (
            <p className="mt-2 text-xs font-semibold text-tomato">Pinjaman tidak aktif pada mode aturan ini.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border-[2.5px] border-ink bg-white p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="font-display text-base font-extrabold">Saham Grup Kota</div>
            <Chip color={features(state).shares && state.wave >= 2 ? "#D5F7E8" : "#FFF4C7"}>
              {features(state).shares && state.wave >= 2 ? "Bursa Buka" : "Buka Ronde 6+"}
            </Chip>
          </div>
          <div className="divide-y divide-divider">
            {shares.map(({ g, price, owned }) => (
              <div key={g} className="flex items-center gap-2.5 py-2">
                <span
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-ink"
                  style={{ background: GROUP_COLORS[g] }}
                  title={GROUP_NAMES[g]}
                />
                <span className="flex-1 text-xs font-bold">{GROUP_NAMES[g]}</span>
                <span className="money text-xs font-semibold">{rp(price)}</span>
                {owned ? (
                  <Button
                    className="min-h-11 sm:min-h-0 px-3 py-1 text-xs"
                    disabled={!isTurn}
                    onClick={() => act({ type: "SELL_SHARE", group: g })}
                  >
                    Jual
                  </Button>
                ) : (
                  <Button
                    variant="sun"
                    className="min-h-11 sm:min-h-0 px-3 py-1 text-xs"
                    disabled={!isTurn || !features(state).shares || state.wave < 2 || me.cash < price}
                    onClick={() => act({ type: "BUY_SHARE", group: g })}
                  >
                    Beli
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">
            Dividen 10% dari setiap sewa pemilik grup dibagikan ke pemegang saham (maks {rp(150)} per saham).
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function ResultDialog({
  state,
  onRestart,
  onExit,
}: {
  state: GameState;
  onRestart: () => void;
  onExit: () => void;
}) {
  const ranked = state.players.slice().sort((a, b) => scoreOf(state, b) - scoreOf(state, a));
  const winner = playerOf(state, state.winner) ?? ranked[0];
  const podium = [
    { p: ranked[1], rank: 2, h: "h-[116px]", cls: "bg-blue text-white", tag: "-rotate-2" },
    { p: ranked[0], rank: 1, h: "h-[144px]", cls: "bg-sun text-ink", tag: "rotate-2" },
    { p: ranked[2], rank: 3, h: "h-[96px]", cls: "bg-mint text-ink", tag: "-rotate-1" },
  ];
  const awards = [
    { label: "Raja Sewa", value: ranked.slice().sort((a, b) => b.stats.rentEarned - a.stats.rentEarned)[0] },
    { label: "Negosiator", value: ranked.slice().sort((a, b) => b.stats.trades - a.stats.trades)[0] },
    { label: "Langganan Penjara", value: ranked.slice().sort((a, b) => b.stats.jailVisits - a.stats.jailVisits)[0] },
  ];
  return (
    <Modal open title="Hasil Akhir Permainan" onClose={onExit} dismissable={false} width="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-[24px] border-[3px] border-ink bg-sun-pale p-4 text-center">
          <span className="sticker -rotate-2 bg-tomato text-xs text-white">★ Pemenang Utama</span>
          <div className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            {winner?.token} {winner?.name}
          </div>
          <div className="money mt-1 text-lg font-extrabold text-ink">{scoreOf(state, winner)} poin</div>
        </div>

        <div className="flex items-end gap-2.5 pt-2">
          {podium.map((slot) => (
            <div key={slot.rank} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {slot.p ? (
                <span className={cn("max-w-full truncate rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold", slot.tag)}>
                  {slot.p.token} {slot.p.name}
                </span>
              ) : null}
              <div
                className={cn(
                  "flex w-full flex-col items-center justify-center rounded-[18px_18px_8px_8px] border-[2.5px] border-ink p-2",
                  slot.h,
                  slot.p ? slot.cls : "bg-tint opacity-50",
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white font-display text-base font-extrabold text-ink">
                  {slot.rank}
                </span>
                {slot.p ? (
                  <span className="money mt-1 text-sm font-extrabold">{scoreOf(state, slot.p)}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border-[2.5px] border-ink">
          <div className="border-b-[2px] border-ink bg-tint px-3 py-1.5 text-xs font-bold text-ink-soft">
            Klasemen lengkap
          </div>
          <div className="divide-y divide-divider">
            {ranked.map((p, i) => {
              const seatIdx = Math.max(0, state.players.findIndex((x) => x.id === p.id));
              return (
                <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="w-5 font-display text-sm font-extrabold">{i + 1}</span>
                  <PawnAvatar index={p.tokenIndex ?? seatIdx} color={p.color} size={24} className="border-[1.5px] p-0" />
                  <span className="flex-1 truncate text-xs font-bold">{p.name}</span>
                  <span className="money text-xs text-ink-soft">{rp(p.cash)}</span>
                  <span className="money w-16 text-right text-xs font-extrabold">{scoreOf(state, p)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {awards.map((a) => (
            <div key={a.label} className="rounded-2xl border-[2px] border-ink bg-tint p-2.5 text-center">
              <div className="text-[11px] font-semibold text-ink-soft">{a.label}</div>
              <div className="truncate text-xs font-bold">{a.value?.name ?? "—"}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="primary" onClick={onRestart}>
            Main Lagi
          </Button>
          <Button onClick={onExit}>Kembali ke Menu</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PassGate({ name, onContinue }: { name: string; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-6 backdrop-blur-[3px]">
      <div
        className="panel w-full max-w-sm p-6 text-center animate-[pop_0.2s_var(--ease-out-soft)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="passgate-title"
      >
        <span className="sticker -rotate-2 bg-sun text-xs">Giliran Berikutnya</span>
        <div id="passgate-title" className="my-3 font-display text-3xl font-extrabold">{name}</div>
        <p className="text-xs font-medium text-ink-soft">
          Pastikan pemain lain tidak mengintip misi rahasiamu sebelum menekan tombol di bawah.
        </p>
        <Button variant="primary" className="mt-5 w-full" onClick={onContinue}>
          Saya {name}, Lanjutkan →
        </Button>
      </div>
    </div>
  );
}

export function RulesDialog({
  open,
  onClose,
  maxRounds = 17,
}: {
  open: boolean;
  onClose: () => void;
  maxRounds?: number;
}) {
  const waveNames = ([1, 2, 3, 4] as const).map(
    (w) => `${WAVE_LABEL[w].charAt(0)}${WAVE_LABEL[w].slice(1).toLowerCase()} ×${WAVE_MULT[w]}`,
  );
  const waveRounds = `Ronde 1–5 Rintisan, 6–11 Pembangunan, 12–15 Puncak${maxRounds >= 16 ? `, 16–${maxRounds} Krisis` : ""}.`;
  return (
    <Modal open={open} onClose={onClose} title="Buku Aturan Ringkas" width="max-w-2xl">
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
        <section className="rounded-2xl border-2 border-ink bg-tint p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Giliran &amp; Dadu</h3>
          <p>Lempar 2 dadu, jalankan bidak, selesaikan petak. Angka dobel berarti lempar lagi; tiga dobel berturut-turut masuk penjara.</p>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-white p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Beli &amp; Lelang</h3>
          <p>Petak tanpa pemilik bisa dibeli sesuai harga label. Jika dilewati, petak langsung dilelang terbuka untuk semua pemain.</p>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-tint p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Bangun &amp; Even-Build</h3>
          <p>Butuh seluruh grup warna untuk membangun. Selisih rumah antar kota satu grup maksimal 1. Bank hanya memiliki 32 rumah dan 12 hotel.</p>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-white p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Gelombang Ekonomi</h3>
          <p>
            {waveRounds} Pengali sewa mengikuti fase: {waveNames.join(" · ")}.
          </p>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-sun-pale p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Menang &amp; Misi Rahasia</h3>
          <p>Menang jika menjadi pemain terakhir yang bertahan, atau skor tertinggi setelah Ronde {maxRounds} (cash + aset + 200/grup + 200/misi − utang).</p>
        </section>
      </div>
    </Modal>
  );
}

export function MissionDialog({
  state,
  open,
  onClose,
  viewerId,
}: {
  state: GameState;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
}) {
  const me = viewerId ? playerOf(state, viewerId) : current(state);
  const mission = MISSIONS.find((m) => m.id === me?.mission);
  return (
    <Modal open={open} onClose={onClose} title="Misi Rahasia" width="max-w-sm">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun-pale text-3xl">
          {me?.missionDone ? "⭐" : "🎯"}
        </div>
        <div className="font-display text-2xl font-extrabold">{mission?.title}</div>
        <p className="text-sm font-medium text-ink-soft">{mission?.desc}</p>
        <Chip color={me?.missionDone ? "#2FD592" : "#DFE6FF"}>
          {me?.missionDone ? `Selesai (+${rp(150)} & 200 poin)` : "Sedang berjalan"}
        </Chip>
        <p className="text-xs font-medium text-ink-soft">Simpan rahasia misi ini dari pemain lain.</p>
      </div>
    </Modal>
  );
}

export function PlayerDetailDialog({
  state,
  playerId,
  onClose,
}: {
  state: GameState;
  playerId: string | null;
  onClose: () => void;
}) {
  const p = playerId ? playerOf(state, playerId) : null;
  if (!p) return null;
  return (
    <Modal open title={`Profil Pemain · ${p.name}`} onClose={onClose} width="max-w-md">
      <PlayerInspect state={state} playerId={p.id} onClose={onClose} />
    </Modal>
  );
}

