import {
  BOT_NAMES,
  CHARACTERS,
  ENGINE_VERSION,
  MISSIONS,
  PLAYER_COLORS,
  SHOP_CARDS,
  TOKENS,
} from "./data";
import { pick, randInt, shuffle } from "./rng";
import type { CharacterId, GameState, Player, Settings } from "./types";

export interface SeatConfig {
  name: string;
  isBot: boolean;
  character?: CharacterId;
  tokenIndex?: number;
}

export function defaultSettings(): Settings {
  return {
    mode: "bot",
    preset: "standar",
    players: 4,
    startCash: 1500,
    auction: true,
    freeParkingPot: false,
    doubleRent: false,
    turnTimer: 0,
    maxRounds: 17,
  };
}

export function createGame(
  settings: Settings,
  seats: SeatConfig[],
  seed = Math.floor(Math.random() * 2 ** 31),
): GameState {
  const state: GameState = {
    version: 0,
    seed,
    rng: seed >>> 0,
    round: 1,
    wave: 1,
    turnIndex: 0,
    phase: "await_roll",
    players: [],
    tiles: Array.from({ length: 40 }, () => ({ owner: null, houses: 0, mortgaged: false })),
    effects: [],
    event: null,
    shop: [],
    shopBought: false,
    log: [],
    nextLogId: 1,
    lastMove: null,
    lastRent: null,
    offer: null,
    auction: null,
    trade: null,
    dice: null,
    doubles: 0,
    pendingRoll: false,
    winner: null,
    settings,
    housesBank: 32,
    hotelsBank: 12,
    freeParkingPot: 0,
    lastCard: null,
    reactions: [],
    engineVersion: ENGINE_VERSION,
  };

  const characters = shuffle(state, CHARACTERS.map((c) => c.id));
  const missions = shuffle(state, MISSIONS.map((m) => m.id));
  const usedTokens = new Set<number>(
    seats
      .map((s) => s.tokenIndex)
      .filter((x): x is number => x !== undefined && Number.isInteger(x) && x >= 0 && x < TOKENS.length),
  );

  state.players = seats.map((seat, i) => {
    let tokenIndex =
      seat.tokenIndex !== undefined && Number.isInteger(seat.tokenIndex) && seat.tokenIndex >= 0 && seat.tokenIndex < TOKENS.length
        ? seat.tokenIndex
        : -1;
    if (tokenIndex < 0) {
      for (let offset = 0; offset < TOKENS.length; offset++) {
        const candidate = (i + offset) % TOKENS.length;
        if (!usedTokens.has(candidate)) {
          tokenIndex = candidate;
          usedTokens.add(candidate);
          break;
        }
      }
      if (tokenIndex < 0) tokenIndex = i % TOKENS.length;
    }

    const player: Player = {
      id: `p${i + 1}`,
      name: seat.name || (seat.isBot ? BOT_NAMES[i] : `Pemain ${i + 1}`),
      character: seat.character ?? characters[i % characters.length],
      color: PLAYER_COLORS[i],
      token: TOKENS[tokenIndex],
      tokenIndex,
      cash: settings.startCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: 0,
      properties: [],
      bankrupt: false,
      goldenUsed: false,
      goldenActive: false,
      diplomatVetoUsed: false,
      mission: missions[i % missions.length],
      missionDone: false,
      loans: [],
      shares: [],
      hand: [],
      isBot: seat.isBot,
      stats: {
        rentPaid: 0,
        rentEarned: 0,
        trades: 0,
        tradeAttempts: 0,
        auctionsWon: 0,
        jailVisits: 0,
        goPasses: 0,
      },
    };
    return player;
  });

  if (state.settings.preset !== "klasik" && state.settings.preset !== "pemula") {
    for (const p of state.players) {
      if (p.character === "bandar") p.cash += 300;
    }
  }

  state.shop = pickShop(state);

  const first = randInt(state, 0, state.players.length - 1);
  state.turnIndex = first;

  state.log.push({
    id: state.nextLogId++,
    round: 1,
    tone: "good",
    text: `${state.players[first].name} mulai lebih dulu.`,
  });

  return state;
}

export function pickShop(state: { rng: number }): string[] {
  const pool = SHOP_CARDS.filter((c) => c.kind !== "legalitas" || true).map((c) => c.id);
  const shuffled = shuffle(state, pool);
  return shuffled.slice(0, 2);
}
