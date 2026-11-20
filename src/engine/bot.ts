import { GROUP_TILES, TILES } from "./data";
import { buildCost, buyPrice, current, groupComplete, hasEffect, living, playerOf } from "./actions";
import type { Action, GameState, Player } from "./types";

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
    const limit = Math.round(price * 0.85);
    const next = a.bid === 0 ? Math.round(price * 0.5) : a.bid + Math.max(10, Math.round(price * 0.1));
    if (next <= limit && next <= bidder.cash - 100) return { type: "BID", amount: next };
    return { type: "PASS_BID" };
  }

  if (s.trade) {
    const target = playerOf(s, s.trade.to);
    if (!target || !target.isBot || target.bankrupt) return null;
    const offer = s.trade;
    const gain = offer.giveCash + offer.giveProps.reduce((a, id) => a + valueOf(s, target, id), 0) + offer.giveCards * 150;
    const loss = offer.wantCash + offer.wantProps.reduce((a, id) => a + valueOf(s, target, id), 0) + offer.wantCards * 150;
    return { type: "TRADE_RESPOND", accept: gain > loss * 1.15 && offer.giveCash <= target.cash };
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
