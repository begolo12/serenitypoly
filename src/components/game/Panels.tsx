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
import { REGION_LABELS, TileArtwork } from "@/components/game/CityArt";
import { Button, Chip, Stat } from "@/components/ui/kit";

export function PlayerRail({ state, onInspect }: { state: GameState; onInspect: (id: string) => void }) {
  const cur = current(state);
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
      {state.players.map((p) => {
        const groups = ownedGroupCount(state, p.id);
        const active = cur?.id === p.id && state.phase !== "game_over";
        return (
          <button
            key={p.id}
            onClick={() => onInspect(p.id)}
            className={cn(
              "relative min-w-[168px] flex-1 rounded-[22px] border-[3px] border-ink p-3 text-left transition-all duration-200",
              active ? "bg-sun-pale -translate-y-0.5" : "bg-white hover:bg-tint",
              p.bankrupt && "opacity-40 grayscale",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink text-lg"
                style={{ background: p.color }}
              >
                {p.token}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-extrabold leading-tight text-ink">{p.name}</div>
                <div className="text-[11px] font-semibold text-ink-soft">
                  {p.isBot ? "Bot AI" : "Pemain"}
                </div>
              </div>
              {active ? (
                <span className="flex items-center gap-1 rounded-full border-2 border-ink bg-mint px-2 py-0.5 text-[10px] font-bold text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                  Aktif
                </span>
              ) : null}
            </div>

            <div className="money mt-2 text-lg font-extrabold text-ink">{rp(p.cash)}</div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold">
              <span className="rounded-full border border-ink/25 bg-tint px-2 py-0.5 text-ink">
                {p.properties.length} petak
              </span>
              <span className="rounded-full border border-ink/25 bg-tint px-2 py-0.5 text-ink">
                {groups} grup
              </span>
              {p.inJail ? <span className="rounded-full border border-ink bg-tomato px-2 py-0.5 text-white">Penjara</span> : null}
              {p.jailCards > 0 ? <span className="rounded-full border border-ink bg-mint-pale px-2 py-0.5">🎟️ {p.jailCards}</span> : null}
              {p.loans.length > 0 ? <span className="rounded-full border border-ink bg-tomato-pale px-2 py-0.5">💳 Utang</span> : null}
              {p.shares.length > 0 ? <span className="rounded-full border border-ink bg-blue-pale px-2 py-0.5">📈 {p.shares.length}</span> : null}
              {p.hand.length > 0 ? <span className="rounded-full border border-ink bg-sun-pale px-2 py-0.5">🃏 {p.hand.length}</span> : null}
              {p.missionDone ? <span className="rounded-full border border-ink bg-sun px-2 py-0.5">★ Misi</span> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const RENT_LABELS = ["Tanah kosong", "1 rumah", "2 rumah", "3 rumah", "4 rumah", "Hotel"];

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
    <div className="space-y-3.5">
      <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-tint p-3">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-ink p-1.5"
          style={{ background: group ? GROUP_COLORS[group] : "#FFF4C7" }}
        >
          <TileArtwork tileId={tile.id} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold leading-tight">{tile.name}</div>
          <div className="text-xs font-semibold text-ink-soft">
            {group ? `${GROUP_NAMES[group]} · ${REGION_LABELS[group]}` : tile.type === "transport" ? "Transportasi" : "Utilitas"}
          </div>
          <div className="mt-1">
            <Chip color={owner ? owner.color : "#FFF4C7"}>
              {owner ? `Milik ${owner.name}` : "Belum dimiliki"}
            </Chip>
          </div>
        </div>
      </div>

      {buyable ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Harga beli" value={rp(tile.price ?? 0)} />
          <Stat label="Biaya rumah" value={tile.houseCost ? rp(tile.houseCost) : "—"} />
        </div>
      ) : null}

      {tile.type === "property" && tile.rents ? (
        <div className="overflow-hidden rounded-2xl border-[2.5px] border-ink">
          <div className="border-b-[2px] border-ink bg-tint px-3 py-1.5 text-xs font-bold text-ink-soft">
            Tabel sewa
          </div>
          <div className="divide-y divide-divider">
            {tile.rents.map((rent, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-xs",
                  st.houses === i && "bg-sun-pale font-bold",
                )}
              >
                <span>{RENT_LABELS[i]}</span>
                <span className="money">{rp(rent)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tile.type === "transport" ? (
        <div className="rounded-2xl border-[2.5px] border-ink bg-blue-pale px-3 py-2.5 text-xs font-semibold">
          Sewa: 1 unit {rp(25)} · 2 {rp(50)} · 3 {rp(100)} · 4 {rp(200)}
        </div>
      ) : null}

      {tile.type === "utility" ? (
        <div className="rounded-2xl border-[2.5px] border-ink bg-tint px-3 py-2.5 text-xs font-semibold">
          Sewa: 4× mata dadu (1 utilitas) · 10× mata dadu (2 utilitas)
        </div>
      ) : null}

      {group && mine ? (
        <div className="rounded-2xl border-[2px] border-ink bg-mint-pale px-3 py-2 text-xs font-bold">
          Total bangunan grup: {housesInGroup(state, group)} {complete ? "· Monopoli aktif ★" : "· Belum lengkap"}
        </div>
      ) : null}

      {mine ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Button
              variant="sun"
              className="w-full text-xs"
              disabled={!canBuild}
              onClick={() => act({ type: "BUILD", tile: tileId })}
            >
              {st.houses === 4 ? "Bangun Hotel" : "Bangun Rumah"} · {rp(cost)}
            </Button>
            {!canBuild ? (
              <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                {!myTurn
                  ? "Tunggu giliranmu"
                  : state.phase !== "post_roll"
                    ? "Lempar dadu dulu"
                    : !complete
                      ? "Butuh seluruh grup warna"
                      : st.houses >= 5
                        ? "Sudah mencapai Hotel"
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
            >
              Jual Bangunan
            </Button>
            {!canSell && st.houses > 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-ink-soft">Jual dari bangunan terbanyak dulu</p>
            ) : null}
          </div>
          <Button
            className="w-full text-xs"
            disabled={!canMortgage}
            onClick={() => act({ type: "MORTGAGE", tile: tileId })}
          >
            Gadai · +{rp(Math.floor((tile.price ?? 0) / 2))}
          </Button>
          <Button
            variant="mint"
            className="w-full text-xs"
            disabled={!canUnmortgage}
            onClick={() => act({ type: "UNMORTGAGE", tile: tileId })}
          >
            Tebus · {rp(Math.ceil(((tile.price ?? 0) / 2) * 1.1))}
          </Button>
        </div>
      ) : (
        <p className="rounded-2xl border-[2px] border-dashed border-ink/35 bg-tint px-3 py-2.5 text-xs font-semibold text-ink-soft">
          {st.owner ? "Properti ini milik pemain lain." : "Belum ada pemilik. Bisa dibeli saat mendarat di petak ini."}
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
    <div className="rounded-[22px] border-[3px] border-ink bg-blue-pale p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[1px] text-blue">Misi rahasia</span>
        {p.missionDone ? <Chip color="#2FD592">Selesai ✓</Chip> : <Chip color="#FFFFFF">Berjalan</Chip>}
      </div>
      <div className="mt-1.5 font-display text-base font-extrabold">{mission?.title}</div>
      <p className="mt-0.5 text-xs font-medium text-ink-soft">{mission?.desc}</p>
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
    <div className="space-y-3.5">
      <div className="flex items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-tint p-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-ink text-3xl"
          style={{ background: p.color }}
        >
          {p.token}
        </div>
        <div>
          <div className="font-display text-xl font-extrabold leading-tight">{p.name}</div>
          <div className="text-xs font-semibold text-ink-soft">
            {character?.name} · {p.isBot ? "Bot AI" : "Manusia"}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Cash" value={rp(p.cash)} />
        <Stat label="Net worth" value={rp(netWorth(state, p))} />
        <Stat label="Skor" value={scoreOf(state, p)} />
        <Stat label="Grup lengkap" value={groups} />
        <Stat label="Sewa diterima" value={rp(p.stats.rentEarned)} />
        <Stat label="Sewa dibayar" value={rp(p.stats.rentPaid)} />
      </div>
      {character ? (
        <div className="rounded-2xl border-[2.5px] border-ink bg-sun-pale p-3 text-xs">
          <p className="font-bold text-[#0e8a5a]">+ Kelebihan: {character.perk}</p>
          <p className="mt-0.5 font-semibold text-tomato">− Kelemahan: {character.flaw}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border-[2.5px] border-ink bg-white p-3">
        <div className="mb-2 text-xs font-bold text-ink-soft">Properti ({p.properties.length})</div>
        {p.properties.length === 0 ? <p className="text-xs text-ink-soft">Belum memiliki properti.</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {p.properties.map((id) => {
            const t = TILES[id];
            return (
              <span
                key={id}
                className="rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold"
                style={{ background: t.group ? GROUP_COLORS[t.group] : "#DFE6FF" }}
              >
                {t.short}
                {state.tiles[id].houses > 0 ? ` ${state.tiles[id].houses === 5 ? "★H" : `🏠×${state.tiles[id].houses}`}` : ""}
              </span>
            );
          })}
        </div>
      </div>
      {p.shares.length ? (
        <div className="flex flex-wrap gap-1.5">
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
    <div className="rounded-[22px] border-[3px] border-ink bg-mint-pale p-3 text-xs">
      <div className="flex items-center justify-between font-bold">
        <span>Rincian sewa terakhir</span>
        <span className="money text-sm font-extrabold">{rp(r.final)}</span>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-ink-soft">
        {r.notes.map((n, i) => (
          <li key={i}>• {n}</li>
        ))}
      </ul>
    </div>
  );
}
