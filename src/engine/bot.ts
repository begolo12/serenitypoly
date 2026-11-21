import { GROUP_TILES, TILES } from "./data";
import { buildCost, buyPrice, current, features, groupComplete, hasEffect, living, playerOf } from "./actions";
import type { Action, GameState, Player } from "./types";

function completesGroupFor(s: GameState, playerId: string, tileId: number): boolean {
  const g = TILES[tileId]?.group;
  if (!g) return false;
  const ids = GROUP_TILES[g];
  const ownedOther = ids.filter((id) => id !== tileId && s.tiles[id].owner === playerId).length;
  return ownedOther >= ids.length - 1;
}

function valueOf(s: GameState, p: Player, tileId: number): number {
  const tile = TILES[tileId];
  let value = tile.price ?? 0;
  if (tile.group && groupComplete(s, tile.group, p.id)) value *= 1.6;
  else if (tile.group) {
    const owned = GROUP_TILES[tile.group].filter((id) => s.tiles[id].owner === p.id).length;
    value *= 1 + owned * 0.15;
  }
  return value;
}

export function botAction(s: GameState): Action | null {
  const p = current(s);
  if (!p || p.bankrupt || s.phase === "game_over") return null;

  if (s.auction) {
    const a = s.auction;
    const bidder = a.current ? playerOf(s, a.current) : null;
    if (!bidder || !bidder.isBot || bidder.bankrupt) return null;
    const price = TILES[a.tile].price ?? 100;
    const strategic =
      completesGroupFor(s, bidder.id, a.tile) ||
      living(s).some((other) => other.id !== bidder.id && completesGroupFor(s, other.id, a.tile));
    const limit = Math.round(price * (strategic ? 1.15 : 0.9));
    const next = a.bid === 0 ? Math.round(price * 0.5) : a.bid + Math.max(10, Math.round(price * 0.1));
    if (next <= limit && next <= bidder.cash - (strategic ? 60 : 120)) return { type: "BID", amount: next };
    return { type: "PASS_BID" };
  }

  if (s.trade) {
    const target = playerOf(s, s.trade.to);
    if (!target || !target.isBot || target.bankrupt) return null;
    const offer = s.trade;
    const gain = offer.giveCash + offer.giveProps.reduce((a, id) => a + valueOf(s, target, id), 0) + offer.giveCards * 150;
    const loss = offer.wantCash + offer.wantProps.reduce((a, id) => a + valueOf(s, target, id), 0) + offer.wantCards * 150;
    return { type: "TRADE_RESPOND", accept: gain > loss * 1.15 && offer.wantCash <= target.cash };
  }

  if (s.offer) {
    const price = s.offer.price;
    const completes =
      TILES[s.offer.tile].group !== undefined &&
      GROUP_TILES[TILES[s.offer.tile].group!].filter(
        (id) => id !== s.offer!.tile && s.tiles[id].owner === p.id,
      ).length >=
        GROUP_TILES[TILES[s.offer.tile].group!].length - 1;
    const reserve = completes ? 50 : 350;
    return p.cash - price >= reserve ? { type: "BUY" } : { type: "DECLINE" };
  }

  if (s.phase === "jail") {
    if (p.jailCards > 0) return { type: "USE_JAIL_CARD" };
    if (p.cash > 400) return { type: "PAY_JAIL" };
    return { type: "ROLL" };
  }

  if (s.phase === "await_roll") {
    if (s.settings.preset === "penuh" && !p.goldenUsed && p.cash < 400) {
      return { type: "DECLARE_GOLDEN" };
    }
    return { type: "ROLL" };
  }

  if (s.phase === "post_roll") {
    const loans = p.loans.reduce((a, l) => a + l.principal, 0);
    if (loans > 0 && p.cash > loans + 600) return { type: "REPAY_LOAN" };

    const mortgagedTarget = p.properties
      .filter((id) => s.tiles[id].mortgaged)
      .sort((a, b) => {
        const ag = TILES[a].group && groupComplete(s, TILES[a].group!, p.id) ? 0 : 1;
        const bg = TILES[b].group && groupComplete(s, TILES[b].group!, p.id) ? 0 : 1;
        return ag - bg || (TILES[a].price ?? 0) - (TILES[b].price ?? 0);
      })[0];
    if (mortgagedTarget !== undefined) {
      const redeemCost = Math.ceil(((TILES[mortgagedTarget].price ?? 0) / 2) * 1.1);
      if (p.cash > redeemCost + 450) return { type: "UNMORTGAGE", tile: mortgagedTarget };
    }

    if (features(s).shares && s.wave >= 2 && p.cash > 900) {
      const groups = Object.keys(GROUP_TILES) as Array<keyof typeof GROUP_TILES>;
      for (const g of groups) {
        if (p.shares.includes(g)) continue;
        const ids = GROUP_TILES[g];
        const rivalDeveloped = ids.some(
          (id) => s.tiles[id].owner && s.tiles[id].owner !== p.id && s.tiles[id].houses >= 1,
        );
        if (!rivalDeveloped) continue;
        const total = ids.reduce((a, id) => a + (TILES[id].price ?? 0), 0);
        const sharePrice = Math.round((total * 0.2) / 10) * 10;
        if (p.cash > sharePrice + 650) return { type: "BUY_SHARE", group: g };
      }
    }

    if (p.stats.tradeAttempts < 3 && p.cash > 700 && !hasEffect(s, "no_trade")) {
      const groups = Object.keys(GROUP_TILES) as Array<keyof typeof GROUP_TILES>;
      for (const g of groups) {
        const ids = GROUP_TILES[g];
        const mine = ids.filter((id) => s.tiles[id].owner === p.id);
        if (mine.length !== ids.length - 1) continue;
        const targetId = ids.find((id) => s.tiles[id].owner && s.tiles[id].owner !== p.id);
        if (targetId === undefined) continue;
        const owner = playerOf(s, s.tiles[targetId].owner);
        if (!owner || owner.bankrupt) continue;
        const offerCash = Math.min(p.cash - 450, Math.round(((TILES[targetId].price ?? 0) * 2.2) / 10) * 10);
        if (offerCash < 50) continue;
        return {
          type: "TRADE_OFFER",
          offer: {
            from: p.id,
            to: owner.id,
            giveCash: offerCash,
            giveProps: [],
            giveCards: 0,
            wantCash: 0,
            wantProps: [targetId],
            wantCards: 0,
          },
        };
      }
    }

    const buildable = p.properties
      .filter((id) => {
        const tile = TILES[id];
        if (tile.type !== "property" || !tile.group) return false;
        if (!groupComplete(s, tile.group, p.id)) return false;
        if (s.tiles[id].houses >= 5) return false;
        const others = GROUP_TILES[tile.group].filter((x) => x !== id).map((x) => s.tiles[x].houses);
        if (s.tiles[id].houses > Math.min(...others)) return false;
        return p.cash > buildCost(s, id, p) + 450;
      })
      .sort((a, b) => (TILES[a].houseCost ?? 0) - (TILES[b].houseCost ?? 0));

    if (buildable.length > 0) return { type: "BUILD", tile: buildable[0] };
    return { type: "END_TURN" };
  }

  return { type: "END_TURN" };
}

export function botShouldPayRent() {
  return true;
}

export function bidStep(price: number): number {
  return Math.max(10, Math.round(price * 0.1));
}

export function lowestNetWorth(s: GameState): Player | null {
  return living(s).slice().sort((a, b) => a.cash - b.cash)[0] ?? null;
}

export const findPlayer = playerOf;
export const buyCost = buyPrice;
