"use client";

import { useState } from "react";
import { CHARACTERS, GROUP_COLORS, GROUP_NAMES, GROUP_TILES, MISSIONS, SHOP_CARDS, TILES } from "@/engine/data";
import {
  current,
  features,
  living,
  playerOf,
  scoreOf,
} from "@/engine/actions";
import type { Action, GameState, GroupId, TradeOffer } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { PlayerInspect } from "@/components/game/Panels";
import { TileArtwork } from "@/components/game/CityArt";
import { Button, Chip, Modal } from "@/components/ui/kit";

export function AuctionDialog({
  state,
  act,
  viewerId,
}: {
  state: GameState;
  act: (a: Action) => void;
  viewerId?: string | null;
}) {
  const [custom, setCustom] = useState("");
  const a = state.auction;
  if (!a) return null;
  const tile = TILES[a.tile];
  const bidder = playerOf(state, a.current);
  const leader = playerOf(state, a.leader);
  const step = Math.max(10, Math.round((tile.price ?? 100) * 0.1));
  const isHumanBidder = Boolean(bidder && !bidder.isBot);
  const canBid = viewerId ? Boolean(isHumanBidder && bidder?.id === viewerId) : isHumanBidder;

  return (
    <Modal open title={`Lelang Terbuka · ${tile.name}`} onClose={() => {}} dismissable={false} width="max-w-md">
      <div className="space-y-3.5">
        <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-sun-pale p-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-white p-1">
            <TileArtwork tileId={tile.id} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-ink-soft">Penawaran tertinggi</div>
            <div className="money text-2xl font-extrabold text-ink">{rp(a.bid)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-ink-soft">Pemimpin</div>
            <div className="font-display text-sm font-extrabold">{leader?.name ?? "Belum ada"}</div>
          </div>
        </div>

        <div
          className="rounded-2xl border-[2.5px] border-ink bg-tint p-3"
          style={bidder ? { borderLeftWidth: "8px", borderLeftColor: bidder.color } : undefined}
        >
          <div className="text-xs font-semibold text-ink-soft">Giliran menawar</div>
          <div className="mt-1 flex items-center gap-2">
            {bidder ? <span className="text-2xl">{bidder.token}</span> : null}
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
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
}) {
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;
  const others = living(state).filter((p) => p.id !== me?.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [giveCash, setGiveCash] = useState(0);
  const [wantCash, setWantCash] = useState(0);
  const [giveProps, setGiveProps] = useState<number[]>([]);
  const [wantProps, setWantProps] = useState<number[]>([]);

  const effectiveTarget = others.some((o) => o.id === target) ? target : (others[0]?.id ?? "");
  const to = playerOf(state, effectiveTarget);

  if (state.trade) {
    const offer = state.trade;
    const from = playerOf(state, offer.from);
    const recipient = playerOf(state, offer.to);

    if (viewerId && offer.to !== viewerId && offer.from !== viewerId) {
      return null;
    }

    const canRespond = viewerId ? offer.to === viewerId : !recipient?.isBot;

    return (
      <Modal
        open
        title={canRespond ? `Tawaran Dagang untuk ${recipient?.name}` : "Tawaran Dagang Terkirim"}
        onClose={onClose}
        dismissable={!canRespond}
        width="max-w-md"
      >
        <div className="space-y-3.5">
          <p className="text-sm text-ink-soft">
            <b className="text-ink">{from?.name}</b> mengajukan penawaran ke <b className="text-ink">{recipient?.name}</b>
          </p>
          <div className="grid gap-2.5">
            <div className="rounded-2xl border-[2.5px] border-ink bg-mint-pale p-3">
              <div className="text-xs font-bold text-ink-soft">
                {canRespond ? "Kamu terima" : `${recipient?.name} terima`}
              </div>
              <div className="money text-base font-extrabold">{rp(offer.giveCash)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {offer.giveProps.map((id) => (
                  <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                    {TILES[id].short}
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
                    {TILES[id].short}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          {canRespond ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="mint" onClick={() => act({ type: "TRADE_RESPOND", accept: true })}>
                ✓ Terima
              </Button>
              <Button variant="danger" onClick={() => act({ type: "TRADE_RESPOND", accept: false })}>
                ✕ Tolak
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

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

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
                    className="min-h-0 px-3 py-1.5 text-xs"
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
                className="min-h-0 px-3 py-1.5 text-xs"
                disabled={!isTurn || !features(state).loans || amount > room}
                onClick={() => act({ type: "TAKE_LOAN", amount })}
              >
                Pinjam {rp(amount)}
              </Button>
            ))}
            <Button
              variant="mint"
              className="min-h-0 px-3 py-1.5 text-xs"
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
                    className="min-h-0 px-3 py-1 text-xs"
                    disabled={!isTurn}
                    onClick={() => act({ type: "SELL_SHARE", group: g })}
                  >
                    Jual
                  </Button>
                ) : (
                  <Button
                    variant="sun"
                    className="min-h-0 px-3 py-1 text-xs"
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
            Dividen 10% dari setiap sewa pemilik grup dibagikan ke pemegang saham (maks Rp 150 per saham).
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

        {/* Bansos-style 3-step Podium */}
        <div className="flex items-end gap-2.5 pt-2">
          {podium.map((slot) => (
            <div key={slot.rank} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              {slot.p ? (
                <span className={cn("rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold truncate max-w-full", slot.tag)}>
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
            {ranked.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="w-5 font-display text-sm font-extrabold">{i + 1}</span>
                <span>{p.token}</span>
                <span className="flex-1 truncate text-xs font-bold">{p.name}</span>
                <span className="money text-xs text-ink-soft">{rp(p.cash)}</span>
                <span className="money w-16 text-right text-xs font-extrabold">{scoreOf(state, p)}</span>
              </div>
            ))}
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
      <div className="panel w-full max-w-sm p-6 text-center animate-[pop_0.2s_var(--ease-out-soft)]">
        <span className="sticker -rotate-2 bg-sun text-xs">Giliran Berikutnya</span>
        <div className="my-3 font-display text-3xl font-extrabold">{name}</div>
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

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h3 className="font-display text-base font-extrabold text-ink">4 Gelombang Ekonomi</h3>
          <p>R1–5 Rintisan (hotel terkunci), R6–11 Pembangunan (hotel &amp; saham terbuka), R12–15 Puncak (PBB 5%), R16–17 Krisis (pinjaman jatuh tempo, sewa ×2,5).</p>
        </section>
        <section className="rounded-2xl border-2 border-ink bg-sun-pale p-3">
          <h3 className="font-display text-base font-extrabold text-ink">Menang &amp; Misi Rahasia</h3>
          <p>Menang jika menjadi pemain terakhir yang bertahan, atau skor tertinggi setelah Ronde 17 (cash + aset + 200/grup + 200/misi − utang).</p>
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
          {me?.missionDone ? "Selesai (+Rp 150 & 200 poin)" : "Sedang berjalan"}
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

export function CharacterBadge({ id }: { id: string }) {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) return null;
  return (
    <span className={cn("chip")} title={`${c.perk} · ${c.flaw}`}>
      {c.name}
    </span>
  );
}
