"use client";

import { CHARACTERS, GROUP_COLORS, GROUP_NAMES, GROUP_TILES, MISSIONS, TILES } from "@/engine/data";
import {
  buildCost,
  current,
  features,
  groupComplete,
  housesInGroup,
  netWorth,
  ownedGroupCount,
  playerOf,
  scoreOf,
} from "@/engine/actions";
import type { Action, GameState } from "@/engine/types";
import { cn, rp } from "@/lib/format";
import { Button, Chip, Stat } from "@/components/ui/kit";

export function PlayerRail({ state, onInspect }: { state: GameState; onInspect: (id: string) => void }) {
  const cur = current(state);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {state.players.map((p) => {
        const groups = ownedGroupCount(state, p.id);
        const active = cur?.id === p.id && state.phase !== "game_over";
        return (
          <button
            key={p.id}
            onClick={() => onInspect(p.id)}
            className={cn(
              "relative min-w-[158px] flex-1 border-[3px] border-ink bg-surface p-2 text-left transition-transform",
              active ? "translate-x-[-2px] translate-y-[-2px] shadow-[5px_5px_0_#0A0A0A]" : "shadow-[3px_3px_0_#0A0A0A]",
              p.bankrupt && "opacity-40 grayscale",
            )}
            style={{ borderTop: `10px solid ${p.color}` }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-lg leading-none">{p.token}</span>
              <span className="truncate font-bold text-[13px]">{p.name}</span>
              {p.isBot ? <Chip className="ml-auto">BOT</Chip> : null}
              {active ? <Chip className="ml-auto" color="#FFD43B">GILIRAN</Chip> : null}
            </div>
            <div className="money mt-1 text-[15px] font-bold">{rp(p.cash)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-bold uppercase">
              <span className="border-2 border-ink px-1">{p.properties.length} petak</span>
              <span className="border-2 border-ink px-1">{groups} grup</span>
              {p.inJail ? <span className="border-2 border-ink bg-red px-1 text-white">PENJARA</span> : null}
              {p.jailCards > 0 ? <span className="border-2 border-ink bg-mint px-1">🎟️ {p.jailCards}</span> : null}
              {p.loans.length > 0 ? <span className="border-2 border-ink bg-pink px-1">💳</span> : null}
              {p.shares.length > 0 ? <span className="border-2 border-ink bg-sky px-1">📈 {p.shares.length}</span> : null}
              {p.hand.length > 0 ? <span className="border-2 border-ink bg-violet px-1 text-white">🃏 {p.hand.length}</span> : null}
              {p.missionDone ? <span className="border-2 border-ink bg-yellow px-1">★ misi</span> : null}
            </div>
            {active ? <div className="absolute -right-2 -top-2 h-3 w-3 animate-pulse rounded-full border-2 border-ink bg-mint" /> : null}
          </button>
        );
      })}
    </div>
  );
}

const RENT_LABELS = ["Tanah", "1 rumah", "2 rumah", "3 rumah", "4 rumah", "Hotel"];

export function PropertySheet({
  state,
  tileId,
  act,
  onClose,
  viewerId,
  canAct = true,
}: {
  state: GameState;
  tileId: number;
  act: (a: Action) => void;
  onClose: () => void;
  viewerId?: string | null;
  canAct?: boolean;
}) {
  const tile = TILES[tileId];
  const st = state.tiles[tileId];
  const owner = playerOf(state, st.owner);
  const turnPlayer = current(state);
  const me = viewerId ? playerOf(state, viewerId) : turnPlayer;
  const mine = owner?.id === me?.id;
  const myTurn = Boolean(me && turnPlayer?.id === me.id && canAct);
  const buyable = tile.price !== undefined;
  const group = tile.group;
  const complete = group ? groupComplete(state, group, me?.id ?? "") : false;
  const others = group ? GROUP_TILES[group].filter((id) => id !== tileId).map((id) => state.tiles[id].houses) : [];
  const minOther = others.length ? Math.min(...others) : 0;
  const maxOther = others.length ? Math.max(...others) : 0;
  const cost = buildCost(state, tileId, me ?? state.players[0]);
  const canBuild =
    mine &&
    myTurn &&
    state.phase === "post_roll" &&
    complete &&
    st.houses < 5 &&
    !st.mortgaged &&
    (st.houses === 4 ? state.hotelsBank > 0 : state.housesBank > 0) &&
    st.houses <= minOther &&
    (me?.cash ?? 0) >= cost;
  const canSell = mine && myTurn && st.houses > 0 && st.houses >= maxOther;
  const canMortgage = mine && myTurn && st.houses === 0 && !st.mortgaged;
  const canUnmortgage = mine && myTurn && st.mortgaged && (me?.cash ?? 0) >= Math.ceil(((tile.price ?? 0) / 2) * 1.1);

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div
          className="flex w-16 shrink-0 items-center justify-center border-[3px] border-ink text-2xl"
          style={{ background: group ? GROUP_COLORS[group] : "#EFE9DA" }}
        >
          {tile.icon}
        </div>
        <div className="flex-1 border-[3px] border-ink bg-surface px-2 py-1.5">
          <div className="font-display text-sm uppercase leading-tight">{tile.name}</div>
          <div className="text-[11px] font-bold uppercase opacity-60">
            {group ? `Grup ${GROUP_NAMES[group]}` : tile.type === "transport" ? "Transportasi" : "Utilitas"}
            {owner ? ` · milik ${owner.name}` : " · belum dimiliki"}
          </div>
        </div>
      </div>

      {buyable ? (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Harga" value={rp(tile.price ?? 0)} />
          <Stat label="Rumah/unit" value={tile.houseCost ? rp(tile.houseCost) : "—"} />
        </div>
      ) : null}

      {tile.type === "property" && tile.rents ? (
        <div className="border-[3px] border-ink">
          <div className="border-b-[2px] border-ink bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
            Tabel sewa
          </div>
          {tile.rents.map((rent, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between border-b border-dashed border-ink/20 px-2 py-1 text-xs",
                st.houses === i && "bg-yellow font-bold",
              )}
            >
              <span>{RENT_LABELS[i]}</span>
              <span className="money">{rp(rent)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {tile.type === "transport" ? (
        <div className="border-[3px] border-ink px-2 py-2 text-xs">
          Sewa: 1 unit {rp(25)} · 2 {rp(50)} · 3 {rp(100)} · 4 {rp(200)}
        </div>
      ) : null}

      {tile.type === "utility" ? (
        <div className="border-[3px] border-ink px-2 py-2 text-xs">Sewa: 4× mata dadu (1 utilitas) · 10× (2 utilitas)</div>
      ) : null}

      {group && mine ? (
        <div className="border-[3px] border-ink bg-muted px-2 py-1.5 text-[11px] font-bold uppercase">
          Rumah grup: {housesInGroup(state, group)} {complete ? "· MONOPOLI AKTIF" : "· belum lengkap"}
        </div>
      ) : null}

      {mine ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Button
              className="w-full text-xs"
              disabled={!canBuild}
              onClick={() => act({ type: "BUILD", tile: tileId })}
              title={
                !complete
                  ? "Butuh seluruh grup"
                  : st.houses >= 5
                    ? "Sudah hotel"
                    : st.houses > minOther
                      ? "Even-build: bangun grup lain dulu"
                      : (me?.cash ?? 0) < cost
                        ? `Butuh ${rp(cost)}`
                        : undefined
              }
            >
              {st.houses === 4 ? "Bangun Hotel" : "Bangun Rumah"} · {rp(cost)}
            </Button>
            {!canBuild ? (
              <p className="mt-1 text-[10px] font-bold uppercase opacity-60">
                {!myTurn
                  ? "Tunggu giliranmu"
                  : state.phase !== "post_roll"
                    ? "Lempar dadu dulu"
                    : !complete
                      ? "Butuh seluruh grup"
                      : st.houses >= 5
                        ? "Sudah hotel"
                        : st.houses > minOther
                          ? "Even-build: bangun grup lain dulu"
                          : (me?.cash ?? 0) < cost
                            ? `Butuh ${rp(cost)}`
                            : st.mortgaged
                              ? "Tebus gadai dulu"
                              : "Stok bank habis"}
              </p>
            ) : null}
          </div>
          <div>
            <Button
              className="w-full text-xs"
              disabled={!canSell}
              onClick={() => act({ type: "SELL_HOUSE", tile: tileId })}
              title={canSell ? undefined : "Even-build: jual dari grup terbanyak"}
            >
              Jual Bangunan
            </Button>
            {!canSell && st.houses > 0 ? (
              <p className="mt-1 text-[10px] font-bold uppercase opacity-60">Jual dari grup terbanyak dulu</p>
            ) : null}
          </div>
          <Button
            className="w-full text-xs"
            disabled={!canMortgage}
            onClick={() => act({ type: "MORTGAGE", tile: tileId })}
            title={!canMortgage ? (st.houses > 0 ? "Jual bangunan dulu" : "Sudah digadaikan") : undefined}
          >
            Gadai · {rp(Math.floor((tile.price ?? 0) / 2))}
          </Button>
          <Button
            className="w-full text-xs"
            disabled={!canUnmortgage}
            onClick={() => act({ type: "UNMORTGAGE", tile: tileId })}
          >
            Tebus · {rp(Math.ceil(((tile.price ?? 0) / 2) * 1.1))}
          </Button>
        </div>
      ) : (
        <p className="border-[3px] border-dashed border-ink/40 px-2 py-2 text-[11px] font-bold uppercase opacity-60">
          {st.owner ? "Bukan propertimu." : "Belum ada pemilik. Beli saat mendarat di petak ini."}
        </p>
      )}

      <Button variant="ghost" className="w-full text-xs" onClick={onClose}>
        Tutup
      </Button>
    </div>
  );
}

export function MissionCard({ state, seat }: { state: GameState; seat: number }) {
  const p = state.players[seat];
  if (!p || !features(state).missions) return null;
  const mission = MISSIONS.find((m) => m.id === p.mission);
  return (
    <div className="border-[3px] border-ink bg-violet/20 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Misi rahasia</span>
        {p.missionDone ? <Chip color="#3DDC97">SELESAI</Chip> : <Chip>BERJALAN</Chip>}
      </div>
      <div className="mt-1 font-display text-sm uppercase">{mission?.title}</div>
      <p className="text-[11px] font-bold opacity-70">{mission?.desc}</p>
      <p className="mt-1 text-[10px] uppercase opacity-50">Jangan tunjukkan ke pemain lain.</p>
    </div>
  );
}

export function PlayerInspect({
  state,
  playerId,
  onClose,
}: {
  state: GameState;
  playerId: string;
  onClose: () => void;
}) {
  const p = playerOf(state, playerId);
  if (!p) return null;
  const character = CHARACTERS.find((c) => c.id === p.character);
  const groups = ownedGroupCount(state, p.id);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center border-[3px] border-ink text-3xl"
          style={{ background: p.color }}
        >
          {p.token}
        </div>
        <div>
          <div className="font-display text-lg uppercase leading-none">{p.name}</div>
          <div className="text-[11px] font-bold uppercase opacity-60">
            {character?.name} · {p.isBot ? "Bot" : "Manusia"}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Cash" value={rp(p.cash)} />
        <Stat label="Net worth" value={rp(netWorth(state, p))} />
        <Stat label="Skor" value={scoreOf(state, p)} />
        <Stat label="Grup" value={groups} />
        <Stat label="Sewa diterima" value={rp(p.stats.rentEarned)} />
        <Stat label="Sewa dibayar" value={rp(p.stats.rentPaid)} />
      </div>
      {character ? (
        <div className="border-[3px] border-ink bg-muted p-2 text-xs">
          <p><b>Kelebihan:</b> {character.perk}</p>
          <p><b>Kelemahan:</b> {character.flaw}</p>
        </div>
      ) : null}
      <div className="border-[3px] border-ink p-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-60">Properti</div>
        {p.properties.length === 0 ? <p className="text-xs opacity-60">Belum punya.</p> : null}
        <div className="flex flex-wrap gap-1">
          {p.properties.map((id) => {
            const t = TILES[id];
            return (
              <span
                key={id}
                className="border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: t.group ? GROUP_COLORS[t.group] : "#EFE9DA" }}
              >
                {t.short}
                {state.tiles[id].houses > 0 ? ` ${state.tiles[id].houses === 5 ? "🏨" : "🏠".repeat(state.tiles[id].houses)}` : ""}
              </span>
            );
          })}
        </div>
      </div>
      {p.shares.length ? (
        <div className="flex flex-wrap gap-1">
          {p.shares.map((g) => (
            <Chip key={g} color={GROUP_COLORS[g]}>Saham {GROUP_NAMES[g]}</Chip>
          ))}
        </div>
      ) : null}
      <Button variant="ghost" className="w-full text-xs" onClick={onClose}>
        Tutup
      </Button>
    </div>
  );
}

export function RentBreakdown({ state }: { state: GameState }) {
  const r = state.lastRent;
  if (!r) return null;
  return (
    <div className="border-[3px] border-ink bg-mint/20 p-2 text-[11px]">
      <div className="flex items-center justify-between font-bold uppercase">
        <span>Rincian sewa</span>
        <span className="money text-sm">{rp(r.final)}</span>
      </div>
      <ul className="mt-1 space-y-0.5 opacity-70">
        {r.notes.map((n, i) => (
          <li key={i}>· {n}</li>
        ))}
      </ul>
    </div>
  );
}
