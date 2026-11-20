"use client";

import { useMemo, useState } from "react";
import { CHARACTERS, GROUP_COLORS, GROUP_NAMES, GROUP_TILES, MISSIONS, SHOP_CARDS, TILES } from "@/engine/data";
import {
  current,
  features,
  groupComplete,
  living,
  netWorth,
  playerOf,
  scoreOf,
} from "@/engine/actions";
import type { Action, GameState, GroupId, TradeOffer } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { Button, Chip, Modal, Stat } from "@/components/ui/kit";

export function AuctionDialog({
  state,
  act,
}: {
  state: GameState;
  act: (a: Action) => void;
}) {
  const [custom, setCustom] = useState("");
  const a = state.auction;
  if (!a) return null;
  const tile = TILES[a.tile];
  const bidder = playerOf(state, a.current);
  const leader = playerOf(state, a.leader);
  const step = Math.max(10, Math.round((tile.price ?? 100) * 0.1));
  const isHuman = bidder && !bidder.isBot;

  return (
    <Modal open title={`Lelang · ${tile.name}`} onClose={() => {}} dismissable={false} width="max-w-md">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 border-[3px] border-ink bg-muted p-2">
          <div>
            <div className="text-[10px] font-bold uppercase opacity-60">Penawaran tertinggi</div>
            <div className="money text-2xl font-bold">{rp(a.bid)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase opacity-60">Pemimpin</div>
            <div className="text-sm font-bold">{leader?.name ?? "—"}</div>
          </div>
        </div>
        <div className="border-[3px] border-ink p-2">
          <div className="text-[10px] font-bold uppercase opacity-60">Giliran menawar</div>
          <div className="font-display text-lg uppercase">{bidder?.name ?? "—"}</div>
          {bidder?.isBot ? <div className="text-[11px] opacity-60">Bot sedang mempertimbangkan…</div> : null}
        </div>
        {isHuman ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[step, step * 2, step * 5].map((inc) => (
                <Button
                  key={inc}
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
                placeholder={`≥ ${a.bid + 10}`}
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
              Lewati
            </Button>
            <p className="text-center text-[10px] font-bold uppercase opacity-60">
              Cash kamu {rp(bidder.cash)}
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
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
}) {
  const me = current(state);
  const others = living(state).filter((p) => p.id !== me?.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [giveCash, setGiveCash] = useState(0);
  const [wantCash, setWantCash] = useState(0);
  const [giveProps, setGiveProps] = useState<number[]>([]);
  const [wantProps, setWantProps] = useState<number[]>([]);

  const to = playerOf(state, target);

  if (state.trade) {
    const offer = state.trade;
    const from = playerOf(state, offer.from);
    const recipient = playerOf(state, offer.to);
    return (
      <Modal open title="Tawaran Dagang" onClose={onClose} width="max-w-md">
        <div className="space-y-3">
          <p className="text-sm">
            <b>{from?.name}</b> menawarkan ke <b>{recipient?.name}</b>
          </p>
          <div className="grid gap-2">
            <div className="border-[3px] border-ink bg-mint/20 p-2">
              <div className="text-[10px] font-bold uppercase opacity-60">Kamu terima</div>
              <div className="money text-sm font-bold">{rp(offer.giveCash)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {offer.giveProps.map((id) => (
                  <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                    {TILES[id].short}
                  </Chip>
                ))}
                {offer.giveCards > 0 ? <Chip>+{offer.giveCards} kartu</Chip> : null}
              </div>
            </div>
            <div className="border-[3px] border-ink bg-red/10 p-2">
              <div className="text-[10px] font-bold uppercase opacity-60">Kamu beri</div>
              <div className="money text-sm font-bold">{rp(offer.wantCash)}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {offer.wantProps.map((id) => (
                  <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                    {TILES[id].short}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="mint" onClick={() => act({ type: "TRADE_RESPOND", accept: true })}>
              Terima
            </Button>
            <Button variant="danger" onClick={() => act({ type: "TRADE_RESPOND", accept: false })}>
              Tolak
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!me || !to) return null;

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Modal open={open} onClose={onClose} title="Ajukan Dagang" width="max-w-lg">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Lawan</label>
          <select className="field mt-1 w-full text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({rp(p.cash)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="border-[3px] border-ink p-2">
            <div className="mb-1 text-[10px] font-bold uppercase opacity-60">Kamu beri uang</div>
            <input
              type="range"
              min={0}
              max={me.cash}
              step={10}
              value={giveCash}
              onChange={(e) => setGiveCash(Number(e.target.value))}
              className="w-full"
            />
            <div className="money text-sm font-bold">{rp(giveCash)}</div>
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {me.properties.map((id) => (
                <label key={id} className="flex items-center gap-1 text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={giveProps.includes(id)}
                    disabled={state.tiles[id].houses > 0}
                    onChange={() => toggle(giveProps, setGiveProps, id)}
                  />
                  {TILES[id].short}
                  {state.tiles[id].houses > 0 ? " (ada bangunan)" : ""}
                </label>
              ))}
            </div>
          </div>

          <div className="border-[3px] border-ink p-2">
            <div className="mb-1 text-[10px] font-bold uppercase opacity-60">Kamu minta uang</div>
            <input
              type="range"
              min={0}
              max={to.cash}
              step={10}
              value={wantCash}
              onChange={(e) => setWantCash(Number(e.target.value))}
              className="w-full"
            />
            <div className="money text-sm font-bold">{rp(wantCash)}</div>
            <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {to.properties.map((id) => (
                <label key={id} className="flex items-center gap-1 text-[11px] font-bold">
                  <input
                    type="checkbox"
                    checked={wantProps.includes(id)}
                    disabled={state.tiles[id].houses > 0}
                    onChange={() => toggle(wantProps, setWantProps, id)}
                  />
                  {TILES[id].short}
                  {state.tiles[id].houses > 0 ? " (ada bangunan)" : ""}
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
          }}
        >
          Kirim Tawaran
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
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
}) {
  const me = current(state);
  if (!me) return null;
  const closed = state.effects.some((e) => e.kind === "shop_closed");
  const cards = state.shop.map((id) => SHOP_CARDS.find((c) => c.id === id)).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title="Pasar Loak" width="max-w-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] font-bold uppercase">
          <span>Cash {rp(me.cash)}</span>
          <span>Kartu di tangan {me.hand.length}/2</span>
        </div>
        {closed ? (
          <p className="border-[3px] border-ink bg-red/20 p-2 text-xs font-bold">Pasar Loak tutup ronde ini.</p>
        ) : null}
        {cards.map((c) =>
          c ? (
            <div key={c.id} className="flex items-start gap-2 border-[3px] border-ink p-2">
              <div className="flex-1">
                <div className="font-display text-sm uppercase">{c.name}</div>
                <p className="text-[11px] opacity-70">{c.desc}</p>
                <div className="money mt-1 text-xs font-bold">
                  {rp(state.wave >= 3 ? c.priceLate : c.priceEarly)}
                </div>
              </div>
              <Button
                className="text-xs"
                disabled={state.shopBought || closed || me.hand.length >= 2 || me.cash < (state.wave >= 3 ? c.priceLate : c.priceEarly)}
                onClick={() => act({ type: "BUY_SHOP", card: c.id })}
              >
                {state.shopBought ? "Sudah beli" : "Beli"}
              </Button>
            </div>
          ) : null,
        )}
        {me.hand.length > 0 ? (
          <div className="border-[3px] border-ink bg-violet/10 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase opacity-60">Kartu kamu</div>
            {me.hand.map((id) => {
              const c = SHOP_CARDS.find((x) => x.id === id);
              const target = autoTarget(state, c?.kind ?? "");
              return (
                <div key={id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-xs font-bold">{c?.name}</span>
                  <Button
                    className="text-[10px]"
                    disabled={target === null}
                    onClick={() => act({ type: "USE_CARD", card: id, target: target ?? undefined })}
                  >
                    Pakai
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

function autoTarget(state: GameState, kind: string): number | null {
  const me = current(state);
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
}: {
  state: GameState;
  act: (a: Action) => void;
  open: boolean;
  onClose: () => void;
}) {
  const me = current(state);
  if (!me) return null;
  const cap = state.wave === 1 ? 500 : 800;
  const debt = me.loans.reduce((a, l) => a + l.principal, 0);
  const room = Math.max(0, cap - debt);

  const shares = (Object.keys(GROUP_TILES) as GroupId[]).map((g) => {
    const total = GROUP_TILES[g].reduce((a, id) => a + (TILES[id].price ?? 0), 0);
    return { g, price: Math.round((total * 0.2) / 10) * 10, owned: me.shares.includes(g) };
  });

  return (
    <Modal open={open} onClose={onClose} title="Bank & Saham" width="max-w-lg">
      <div className="space-y-3">
        <div className="border-[3px] border-ink p-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase opacity-60">Pinjaman</div>
            <Chip>{debt > 0 ? rp(debt) : "Tidak ada"}</Chip>
          </div>
          <p className="mt-1 text-[11px] opacity-70">
            Bunga {me.character === "arsitek" ? "15%" : "10%"} per ronde. Batas fase ini {rp(cap)}. Sisa {rp(room)}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[100, 250, 500].map((amount) => (
              <Button
                key={amount}
                className="text-xs"
                disabled={!features(state).loans || amount > room}
                onClick={() => act({ type: "TAKE_LOAN", amount })}
              >
                Pinjam {rp(amount)}
              </Button>
            ))}
            <Button
              variant="mint"
              className="text-xs"
              disabled={debt === 0 || me.cash < debt}
              onClick={() => act({ type: "REPAY_LOAN" })}
            >
              Lunasi
            </Button>
          </div>
          {!features(state).loans ? (
            <p className="mt-1 text-[10px] font-bold uppercase text-red">Pinjaman mati di preset ini.</p>
          ) : null}
        </div>

        <div className="border-[3px] border-ink p-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase opacity-60">Saham grup</div>
            <Chip>{features(state).shares && state.wave >= 2 ? "TERBUKA" : "RONDE 6+"}</Chip>
          </div>
          <div className="space-y-1">
            {shares.map(({ g, price, owned }) => (
              <div key={g} className="flex items-center gap-2">
                <span
                  className="h-5 w-5 shrink-0 border-2 border-ink"
                  style={{ background: GROUP_COLORS[g] }}
                  title={GROUP_NAMES[g]}
                />
                <span className="flex-1 text-[11px] font-bold">{GROUP_NAMES[g]}</span>
                <span className="money text-[10px]">{rp(price)}</span>
                {owned ? (
                  <Button className="text-[10px]" onClick={() => act({ type: "SELL_SHARE", group: g })}>
                    Jual
                  </Button>
                ) : (
                  <Button
                    className="text-[10px]"
                    disabled={!features(state).shares || state.wave < 2 || me.cash < price}
                    onClick={() => act({ type: "BUY_SHARE", group: g })}
                  >
                    Beli
                  </Button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] opacity-60">
            Dividen 10% sewa dibayar pemilik properti ke pemegang saham (maks Rp 150 per saham).
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
  const awards = [
    { label: "Raja Sewa", value: ranked.slice().sort((a, b) => b.stats.rentEarned - a.stats.rentEarned)[0] },
    { label: "Negosiator", value: ranked.slice().sort((a, b) => b.stats.trades - a.stats.trades)[0] },
    { label: "Paling Sering ke Penjara", value: ranked.slice().sort((a, b) => b.stats.jailVisits - a.stats.jailVisits)[0] },
  ];
  return (
    <Modal open title="Hasil Akhir" onClose={onExit} dismissable={false} width="max-w-xl">
      <div className="space-y-3">
        <div className="border-[3px] border-ink bg-yellow p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Pemenang</div>
          <div className="font-display text-2xl uppercase leading-none">{winner?.name}</div>
          <div className="money mt-1 text-lg font-bold">{rp(scoreOf(state, winner))} poin</div>
        </div>
        <div className="border-[3px] border-ink">
          <div className="border-b-[2px] border-ink bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
            Klasemen
          </div>
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-dashed border-ink/20 px-2 py-1.5">
              <span className="w-4 font-display">{i + 1}</span>
              <span style={{ color: p.color }}>{p.token}</span>
              <span className="flex-1 truncate text-xs font-bold">{p.name}</span>
              <span className="money text-[11px]">{rp(p.cash)}</span>
              <span className="money w-16 text-right text-[11px] font-bold">{scoreOf(state, p)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {awards.map((a) => (
            <div key={a.label} className="border-[3px] border-ink p-2 text-center">
              <div className="text-[9px] font-bold uppercase opacity-60">{a.label}</div>
              <div className="truncate text-[11px] font-bold">{a.value?.name ?? "—"}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={onRestart}>
            Main Lagi
          </Button>
          <Button onClick={onExit}>Menu</Button>
        </div>
      </div>
    </Modal>
  );
}

export function PassGate({ name, onContinue }: { name: string; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/80 p-6">
      <div className="panel w-full max-w-sm p-5 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Oper perangkat</div>
        <div className="my-2 font-display text-3xl uppercase leading-none">{name}</div>
        <p className="text-xs opacity-70">Pastikan pemain lain tidak melihat layar sebelum menekan tombol.</p>
        <Button variant="primary" className="mt-4 w-full" onClick={onContinue}>
          Aku {name}, Lanjut
        </Button>
      </div>
    </div>
  );
}

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Buku Aturan" width="max-w-2xl">
      <div className="space-y-3 text-[12px] leading-relaxed">
        <section>
          <h3 className="font-display text-sm uppercase">Giliran</h3>
          <p>Lempar 2 dadu, jalan, lalu selesaikan petak. Dobel berarti lempar lagi; tiga dobel berturut-turut masuk penjara.</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Beli & lelang</h3>
          <p>Petak tanpa pemilik bisa dibeli seharga label. Menolak membeli memicu lelang terbuka; penawar tertinggi menang.</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Bangun</h3>
          <p>Butuh seluruh grup warna. Even-build: selisih rumah antar petak satu grup maksimal 1. Bank hanya punya 32 rumah dan 12 hotel.</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Gelombang</h3>
          <p>R1–5 Rintisan (hotel terkunci), R6–11 Pembangunan (hotel terbuka), R12–15 Puncak (PBB 5%), R16–17 Krisis (pinjaman jatuh tempo, sewa ×2,5).</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Saham & pinjaman</h3>
          <p>Saham grup dibeli 20% nilai grup; 10% sewa pemilik dibagi ke pemegang saham. Pinjaman berbunga 10% per ronde, wajib lunas saat Krisis.</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Menang</h3>
          <p>Menang jika satu-satunya pemain tersisa. Jika Ronde 17 selesai, pemenang ditentukan dari skor: cash + aset + 200 per grup + 200 per misi − utang.</p>
        </section>
        <section>
          <h3 className="font-display text-sm uppercase">Misi</h3>
          <p>Setiap pemain punya satu misi rahasia. Selesai otomatis memberi Rp 150 dan 200 poin skor.</p>
        </section>
      </div>
    </Modal>
  );
}

export function MissionDialog({
  state,
  open,
  onClose,
}: {
  state: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const me = current(state);
  const mission = MISSIONS.find((m) => m.id === me?.mission);
  return (
    <Modal open={open} onClose={onClose} title="Misi Rahasia" width="max-w-sm">
      <div className="space-y-2 text-center">
        <div className="text-4xl">{me?.missionDone ? "⭐" : "🎯"}</div>
        <div className="font-display text-xl uppercase">{mission?.title}</div>
        <p className="text-sm">{mission?.desc}</p>
        <Chip color={me?.missionDone ? "#3DDC97" : "#EFE9DA"}>
          {me?.missionDone ? "SELESAI" : "BELUM SELESAI"}
        </Chip>
        <p className="text-[10px] uppercase opacity-60">Jangan tunjukkan layar ini ke pemain lain.</p>
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
  const p = useMemo(() => (playerId ? playerOf(state, playerId) : null), [state, playerId]);
  if (!p) return null;
  return (
    <Modal open title={`Pemain · ${p.name}`} onClose={onClose} width="max-w-md">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Cash" value={rp(p.cash)} />
          <Stat label="Net worth" value={rp(netWorth(state, p))} />
          <Stat label="Skor" value={scoreOf(state, p)} />
          <Stat label="Sewa diterima" value={rp(p.stats.rentEarned)} />
        </div>
        {p.properties.length ? (
          <div className="flex flex-wrap gap-1">
            {p.properties.map((id) => (
              <Chip key={id} color={TILES[id].group ? GROUP_COLORS[TILES[id].group!] : undefined}>
                {TILES[id].short}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-xs opacity-60">Belum punya properti.</p>
        )}
        {groupComplete(state, "brown", p.id) ? <p className="text-xs">Grup cokelat lengkap.</p> : null}
      </div>
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
