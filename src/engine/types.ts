export type GroupId =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export type TileType =
  | "go"
  | "property"
  | "transport"
  | "utility"
  | "tax"
  | "chance"
  | "community"
  | "jail"
  | "free"
  | "gotojail";

export type Wave = 1 | 2 | 3 | 4;

export type Phase = "await_roll" | "jail" | "post_roll" | "auction" | "game_over";

export type CharacterId = "saudagar" | "arsitek" | "diplomat" | "bandar" | "penjelajah";

export type Preset = "klasik" | "standar" | "penuh" | "pemula";
export type Mode = "bot" | "hotseat" | "controller" | "online";

export interface Settings {
  mode: Mode;
  preset: Preset;
  players: number;
  startCash: number;
  auction: boolean;
  freeParkingPot: boolean;
  doubleRent: boolean;
  turnTimer: number;
  maxRounds: number;
}

export interface Tile {
  id: number;
  type: TileType;
  name: string;
  short: string;
  icon: string;
  group?: GroupId;
  price?: number;
  rents?: number[];
  houseCost?: number;
  tax?: number;
}

export interface Loan {
  id: string;
  principal: number;
  rate: number;
}

export interface PlayerStats {
  rentPaid: number;
  rentEarned: number;
  trades: number;
  tradeAttempts: number;
  auctionsWon: number;
  jailVisits: number;
  goPasses: number;
}

export interface Player {
  id: string;
  name: string;
  character: CharacterId;
  color: string;
  token: string;
  tokenIndex?: number;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailCards: number;
  properties: number[];
  bankrupt: boolean;
  goldenUsed: boolean;
  goldenActive: boolean;
  diplomatVetoUsed?: boolean;
  mission: string;
  missionDone: boolean;
  loans: Loan[];
  shares: GroupId[];
  hand: string[];
  isBot: boolean;
  stats: PlayerStats;
}

export interface TileState {
  owner: string | null;
  houses: number;
  mortgaged: boolean;
}

export type EffectKind =
  | "rent_mult"
  | "build_mult"
  | "buy_discount"
  | "interest_mult"
  | "tax_mult"
  | "no_rent_group"
  | "no_auction"
  | "no_trade"
  | "shop_closed";

export interface Effect {
  id: string;
  kind: EffectKind;
  group?: GroupId;
  tile?: number;
  mult?: number;
  roundsLeft: number;
  label: string;
}

export interface LogEntry {
  id: number;
  round: number;
  text: string;
  tone: "info" | "money" | "warn" | "good";
}

export interface TradeOffer {
  from: string;
  to: string;
  giveCash: number;
  giveProps: number[];
  giveCards: number;
  wantCash: number;
  wantProps: number[];
  wantCards: number;
}

export interface AuctionState {
  tile: number;
  bid: number;
  leader: string | null;
  active: string[];
  current: string | null;
  forced?: boolean;
}

export interface RentBreakdown {
  base: number;
  waveMult: number;
  effectMult: number;
  afterEffects: number;
  shareCut: number;
  characterAdj: number;
  final: number;
  dividends?: Array<{ playerId: string; amount: number }>;
  notes: string[];
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  round: number;
  wave: Wave;
  turnIndex: number;
  phase: Phase;
  players: Player[];
  tiles: TileState[];
  effects: Effect[];
  event: { id: string; label: string; text: string } | null;
  shop: string[];
  shopBought: boolean;
  log: LogEntry[];
  nextLogId: number;
  lastMove: { playerId: string; from: number; to: number; steps: number } | null;
  lastRent: RentBreakdown | null;
  offer: { tile: number; price: number; rent: number; rentFull: number } | null;
  auction: AuctionState | null;
  trade: TradeOffer | null;
  dice: [number, number] | null;
  doubles: number;
  pendingRoll: boolean;
  winner: string | null;
  settings: Settings;
  housesBank: number;
  hotelsBank: number;
  freeParkingPot?: number;
  lastCard?: {
    deck: "chance" | "community";
    title: string;
    text: string;
    playerId: string;
  } | null;
  reactions?: Array<{
    id: string;
    playerId: string;
    name: string;
    color: string;
    emoji: string;
    at: number;
  }>;
  engineVersion: string;
}

export type Action =
  | { type: "ROLL" }
  | { type: "BUY" }
  | { type: "DECLINE" }
  | { type: "BID"; amount: number }
  | { type: "PASS_BID" }
  | { type: "BUILD"; tile: number }
  | { type: "SELL_HOUSE"; tile: number }
  | { type: "MORTGAGE"; tile: number }
  | { type: "UNMORTGAGE"; tile: number }
  | { type: "PAY_JAIL" }
  | { type: "USE_JAIL_CARD" }
  | { type: "BUY_SHARE"; group: GroupId }
  | { type: "SELL_SHARE"; group: GroupId }
  | { type: "TAKE_LOAN"; amount: number }
  | { type: "REPAY_LOAN" }
  | { type: "BUY_SHOP"; card: string }
  | { type: "USE_CARD"; card: string; target?: number }
  | { type: "DECLARE_GOLDEN" }
  | { type: "TRADE_OFFER"; offer: TradeOffer }
  | { type: "TRADE_RESPOND"; accept: boolean }
  | { type: "CLAIM_MISSION" }
  | { type: "END_TURN" }
  | { type: "SURRENDER" }
  | { type: "DISMISS" };

export interface CardDef {
  id: string;
  deck: "chance" | "community";
  text: string;
  kind:
    | "money"
    | "move_to"
    | "move_rel"
    | "jail"
    | "free"
    | "repairs"
    | "collect_all"
    | "pay_all"
    | "nearest_transport";
  amount?: number;
  target?: number;
  per?: number;
}

export interface MissionDef {
  id: string;
  title: string;
  desc: string;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  rounds: number;
  effects: Array<Omit<Effect, "id">>;
}

export interface ShopCardDef {
  id: string;
  name: string;
  desc: string;
  priceEarly: number;
  priceLate: number;
  kind: "jail_free" | "promo" | "audit" | "legalitas" | "sogok" | "operasi";
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  perk: string;
  flaw: string;
}
