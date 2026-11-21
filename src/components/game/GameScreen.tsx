"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, type SeatConfig } from "@/engine/create";
import { applyAction, current, features, living, ownedGroupCount, playerOf } from "@/engine/actions";
import { botAction } from "@/engine/bot";
import { CHARACTERS, GROUP_NAMES, GROUP_TILES, TILES, WAVE_LABEL } from "@/engine/data";
import type { Action, GameState, Settings } from "@/engine/types";
import { Board } from "@/components/game/Board";
import { PawnAvatar, TileArtwork } from "@/components/game/CityArt";
import {
  AudioMixerButton,
  CardRevealOverlay,
  ConfettiBurst,
  EventBreakingBanner,
} from "@/components/game/GameFx";
import { MissionCard, PlayerRail, PropertySheet, RentBreakdown, useCashDeltas } from "@/components/game/Panels";
import {
  AuctionDialog,
  BankDialog,
  MissionDialog,
  PassGate,
  PlayerDetailDialog,
  PortfolioDialog,
  ResultDialog,
  RulesDialog,
  ShopDialog,
  TradeDialog,
} from "@/components/game/Dialogs";
import { Button, Chip, Modal, Tooltip } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import { initMute, isMuted, setMuted, sfx, stopBgm } from "@/lib/sfx";

export type PanelKind = "bank" | "shop" | "trade" | "portfolio" | "mission" | "rules" | "property" | "result" | "log" | null;

export function GameScreen({
  settings,
  seats,
  onExit,
  initial,
}: {
  settings: Settings;
  seats: SeatConfig[];
  onExit: () => void;
  initial?: GameState;
}) {
  const [state, setState] = useState<GameState>(() => initial ?? createGame(settings, seats));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [panel, setPanel] = useState<PanelKind>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [gateOpen, setGateOpen] = useState(settings.mode === "hotseat");
  const [tradeGate, setTradeGate] = useState<string | null>(null);
  const [botSpeed, setBotSpeed] = useState<1 | 2 | 3>(1);
  const [confettiKey, setConfettiKey] = useState<string | null>(null);
  const [timer, setTimer] = useState(settings.turnTimer);
  const lastTurnKey = useRef<string>("");
  const lastTurnPlayer = useRef<string>("");
  const dismissedTrade = useRef<string>("");
  const gatedTrade = useRef<string>("");
  const botAttempt = useRef<string>("");

  useEffect(() => {
    initMute();
    return () => stopBgm();
  }, []);

  const act = useCallback((action: Action) => {
    const prev = stateRef.current;
    const next = applyAction(prev, action);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);

    const newMono = next.players.some(
      (pl) => !pl.bankrupt && ownedGroupCount(next, pl.id) > ownedGroupCount(prev, pl.id),
    );
    const hitJackpot =
      Boolean(prev.settings.freeParkingPot) &&
      (prev.freeParkingPot ?? 0) > 0 &&
      (next.freeParkingPot ?? 0) === 0;
    const isCounter = Boolean(
      action.type === "TRADE_OFFER" && prev.trade && next.trade && next.trade.from === prev.trade.to,
    );

    if (hitJackpot) {
      sfx.jackpot();
      setConfettiKey(`pot-${next.version}`);
    } else if (newMono) {
      sfx.monopoly();
      setConfettiKey(`mono-${next.version}`);
    } else if (isCounter) {
      sfx.counterOffer();
    } else {
      switch (action.type) {
        case "ROLL":
          sfx.dice();
          break;
        case "BUY":
        case "BUY_SHARE":
        case "BUY_SHOP":
          sfx.buy();
          break;
        case "BUILD":
          sfx.build();
          break;
        case "BID":
        case "PASS_BID":
          sfx.auction();
          break;
        case "PAY_JAIL":
          sfx.jail();
          break;
        case "END_TURN":
          sfx.turn();
          break;
        default:
          sfx.click();
      }
    }

    if (next.phase === "game_over" && prev.phase !== "game_over") {
      sfx.win();
      setConfettiKey(`win-${next.version}`);
      setPanel("result");
    } else if (!hitJackpot && !newMono) {
      const last = next.log[next.log.length - 1];
      if (last?.tone === "warn") sfx.bad();
      else if (last?.tone === "money") sfx.coin();
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sp-game", JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state]);

  const me = current(state);
  const isBot = me?.isBot ?? false;
  const auctionBot = state.auction?.current ? playerOf(state, state.auction.current)?.isBot : false;
  const tradeBot = state.trade ? playerOf(state, state.trade.to)?.isBot : false;
  const botPending = isBot || !!auctionBot || !!tradeBot;

  const humanViewer =
    settings.mode === "hotseat"
      ? me && !me.isBot
        ? me
        : (state.players.find((p) => !p.isBot) ?? me)
      : (state.players.find((p) => !p.isBot) ?? me);
  const viewerId = humanViewer?.id ?? null;
  const viewerSeat = humanViewer ? state.players.findIndex((p) => p.id === humanViewer.id) : state.turnIndex;
  const tradeKey = state.trade
    ? [
        state.trade.from,
        state.trade.to,
        state.trade.giveCash,
        state.trade.wantCash,
        state.trade.giveProps.join("."),
        state.trade.wantProps.join("."),
        state.trade.giveCards ?? 0,
        state.trade.wantCards ?? 0,
      ].join("|")
    : "";
  const tradeViewerId = state.trade && settings.mode === "hotseat" ? state.trade.to : viewerId;

  useEffect(() => {
    if (!me?.id) return;
    if (state.phase === "game_over") return;
    const key = `${me.id}:${state.round}:${state.doubles}:${me.inJail ? "jail" : "free"}`;
    if (lastTurnKey.current !== key) {
      lastTurnKey.current = key;
      setTimer(settings.turnTimer);
    }
    if (lastTurnPlayer.current !== me.id) {
      lastTurnPlayer.current = me.id;
      if (settings.mode === "hotseat" && !me.isBot) setGateOpen(true);
    }
  }, [me?.id, me?.isBot, me?.inJail, state.round, state.doubles, state.phase, settings.mode, settings.turnTimer]);

  useEffect(() => {
    if (state.phase === "game_over" || gateOpen || tradeGate) return;
    if (!botPending) return;
    // Hanya auto-aksi untuk aktor bot. Lelang/trade yang menunggu pemain manusia tidak boleh memicu act().
    if (state.phase === "auction" && !auctionBot) return;
    if (state.trade && !tradeBot) return;
    const delay = botSpeed === 3 ? 150 : botSpeed === 2 ? 340 : 650;
    const t = window.setTimeout(() => {
      const action = botAction(state);
      if (!action) return;
      const sig = `${state.version}:${JSON.stringify(action)}`;
      if (botAttempt.current === sig) return;
      botAttempt.current = sig;
      act(action);
    }, delay);
    return () => window.clearTimeout(t);
  }, [state.version, state.phase, gateOpen, tradeGate, botPending, auctionBot, tradeBot, botSpeed, state, act]);

  useEffect(() => {
    if (!settings.turnTimer || gateOpen || isBot || state.phase === "game_over") return;
    if (state.phase === "auction" || state.trade) return;
    if (panel !== null || inspectId) return;
    if (timer <= 0) return;
    const t = window.setTimeout(() => setTimer((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timer, settings.turnTimer, gateOpen, isBot, state.phase, state.trade, panel, inspectId]);

  useEffect(() => {
    if (!settings.turnTimer) return;
    if (panel === null && !inspectId) return;
    setTimer((v) => (v <= 0 ? settings.turnTimer : v));
  }, [panel, inspectId, settings.turnTimer]);

  useEffect(() => {
    if (!settings.turnTimer || timer > 0 || isBot || gateOpen) return;
    if (panel !== null || inspectId) return;
    if (state.phase === "auction" || state.trade) return;
    if (state.phase === "await_roll" || state.phase === "jail") act({ type: "ROLL" });
    else if (state.phase === "post_roll") act({ type: "END_TURN" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, panel, inspectId]);

  useEffect(() => {
    if (!state.trade) {
      if (tradeGate) setTradeGate(null);
      return;
    }
    if (dismissedTrade.current === tradeKey) return;
    const recipient = playerOf(state, state.trade.to);
    if (!recipient || recipient.isBot) return;
    if (settings.mode === "hotseat") {
      if (gatedTrade.current === tradeKey) return;
      gatedTrade.current = tradeKey;
      setTradeGate(recipient.id);
      setPanel(null);
      return;
    }
    if (panel !== null) return;
    setPanel("trade");
  }, [state.trade, tradeKey, panel, settings.mode, tradeGate]);

  const openShared = (kind: PanelKind) => {
    sfx.click();
    setPanel(kind);
  };

  const restart = () => {
    localStorage.removeItem("sp-game");
    const fresh = createGame(settings, seats);
    stateRef.current = fresh;
    setState(fresh);
    lastTurnKey.current = "";
    lastTurnPlayer.current = "";
    dismissedTrade.current = "";
    gatedTrade.current = "";
    botAttempt.current = "";
    setTimer(settings.turnTimer);
    setTradeGate(null);
    setGateOpen(settings.mode === "hotseat");
    setPanel(null);
  };

  const canAct = !isBot && !gateOpen && state.phase !== "auction" && !state.trade;
  const canRollOnBoard = Boolean(canAct && (state.phase === "await_roll" || state.phase === "jail") && !state.offer);
  const waveText = WAVE_LABEL[state.wave].charAt(0) + WAVE_LABEL[state.wave].slice(1).toLowerCase();
  const cardPlayer = state.lastCard ? playerOf(state, state.lastCard.playerId) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "m") {
        setMuted(!isMuted());
        return;
      }
      if (panel || inspectId || gateOpen || state.phase === "game_over") return;
      if (e.code === "Space" && canAct && !state.offer) {
        if (state.phase === "await_roll" || state.phase === "jail") {
          e.preventDefault();
          act({ type: "ROLL" });
        } else if (state.phase === "post_roll") {
          e.preventDefault();
          act({ type: "END_TURN" });
        }
        return;
      }
      if (k === "b") setPanel("bank");
      else if (k === "a") setPanel("portfolio");
      else if (k === "t" && canAct) setPanel("trade");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, inspectId, gateOpen, state.phase, state.offer, canAct, act]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2 px-2.5 pt-2 pb-[132px] sm:px-3 md:px-5 lg:gap-3 lg:py-2.5 lg:pb-3">
      <ConfettiBurst triggerKey={confettiKey} />
      <CardRevealOverlay
        card={state.lastCard}
        playerName={cardPlayer?.name}
        playerColor={cardPlayer?.color}
        round={state.round}
      />
      <EventBreakingBanner event={state.event} round={state.round} />

      {/* Mobile Compact Single-Row Header (< lg) */}
      <header className="flex items-center justify-between gap-1.5 lg:hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onExit}
            aria-label="Kembali ke menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xs font-extrabold text-ink active:scale-95 sm:h-8 sm:w-8"
          >
            ←
          </button>
          <span className="font-display truncate text-[15px] font-extrabold tracking-tight text-ink">
            Serenity<span className="text-tomato">Poly</span>
          </span>
          <span className="shrink-0 rounded-full border-2 border-ink bg-sun px-2 py-0.5 font-mono text-[10.5px] font-extrabold text-ink">
            R{state.round}/{state.settings.maxRounds}
          </span>
          {settings.turnTimer ? (
            <span
              className={cn(
                "shrink-0 rounded-full border-2 border-ink px-1.5 py-0.5 font-mono text-[10px] font-extrabold",
                timer <= 5 ? "bg-tomato text-white" : "bg-tint text-ink",
              )}
            >
              ⏱{Math.max(0, timer)}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {state.players.some((p) => p.isBot) ? (
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setBotSpeed((v) => (v === 1 ? 2 : v === 2 ? 3 : 1));
              }}
              className="min-h-11 rounded-full border-2 border-ink bg-white px-2 py-1 font-mono text-[11px] font-bold text-ink sm:min-h-0"
              title="Kecepatan Bot"
            >
              ⏩{botSpeed}×
            </button>
          ) : null}
          <AudioMixerButton />
          <button
            type="button"
            onClick={() => openShared("rules")}
            aria-label="Buku aturan"
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white text-xs sm:h-8 sm:w-8"
          >
            📖
          </button>
        </div>
      </header>

      {/* Desktop Top Navbar (lg+) */}
      <header className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-ink bg-sun text-sm">
            🎲
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight md:text-xl">
            Serenity<span className="text-tomato">Poly</span>
          </span>
        </div>

        <Tooltip tip={`Fase ${waveText}: pengali sewa & aturan ekonomi saat ini`} position="bottom">
          <Chip color="#FFD23F">
            Ronde {state.round} · {waveText}
          </Chip>
        </Tooltip>
        <Chip color="#DFE6FF">{living(state).length} pemain aktif</Chip>
        {state.event ? (
          <Tooltip tip={state.event.text} position="bottom">
            <Chip color="#FFE4DD">⚡ {state.event.label}</Chip>
          </Tooltip>
        ) : null}
        {settings.turnTimer ? (
          <Tooltip tip="Batas waktu giliran aktif" position="bottom">
            <Chip color={timer <= 5 ? "#FF5A3C" : "#EDEDF3"}>⏱ {Math.max(0, timer)}s</Chip>
          </Tooltip>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Tooltip tip="Kelola, bangun rumah, dan gadaikan propertimu (A)" position="bottom">
            <Button variant="ghost" className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs" onClick={() => openShared("portfolio")}>
              🏘️ Asetku
            </Button>
          </Tooltip>
          <Tooltip tip="Lihat misi rahasiamu" position="bottom">
            <Button variant="ghost" className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs" onClick={() => openShared("mission")}>
              🎯 Misi
            </Button>
          </Tooltip>
          <Tooltip tip="Ajukan pinjaman atau beli saham grup kota (B)" position="bottom">
            <Button variant="ghost" className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs" onClick={() => openShared("bank")}>
              🏦 Bank
            </Button>
          </Tooltip>
          {features(state).shop ? (
            <Tooltip tip="Beli & pakai kartu aksi spesial" position="bottom">
              <Button variant="ghost" className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs" onClick={() => openShared("shop")}>
                🛒 Toko
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip tip={canAct ? "Tawarkan barter properti atau uang ke pemain lain (T)" : "Tunggu giliranmu untuk berdagang"} position="bottom">
            <Button
              variant="ghost"
              className="min-h-11 sm:min-h-0 px-3 py-1.5 text-xs"
              disabled={!canAct}
              onClick={() => openShared("trade")}
            >
              🤝 Dagang
            </Button>
          </Tooltip>
          {state.players.some((p) => p.isBot) ? (
            <Tooltip tip="Kecepatan giliran Bot AI (1× / 2× / 3×)" position="bottom">
              <Button
                variant="ghost"
                className="min-h-11 sm:min-h-0 px-2.5 py-1.5 font-mono text-xs"
                onClick={() => {
                  sfx.click();
                  setBotSpeed((v) => (v === 1 ? 2 : v === 2 ? 3 : 1));
                }}
              >
                ⏩ {botSpeed}×
              </Button>
            </Tooltip>
          ) : null}
          <AudioMixerButton />
          <Tooltip tip="Buku aturan ringkas" position="bottom">
            <Button variant="ghost" className="min-h-11 sm:min-h-0 px-2.5 py-1.5 text-xs" onClick={() => openShared("rules")}>
              📖
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-3">
        <aside className="lg:w-[236px] lg:shrink-0">
          <PlayerRail state={state} onInspect={setInspectId} />
        </aside>

        <main className="min-w-0 flex-1">
          <Board
            state={state}
            selected={selectedTile}
            onRoll={() => act({ type: "ROLL" })}
            canRoll={canRollOnBoard}
            onSelect={(id) => {
              setSelectedTile(id);
              setPanel("property");
            }}
          />
        </main>

        <aside className="flex w-full flex-col gap-3 lg:w-[340px] lg:shrink-0">
          <div className="hidden space-y-3 lg:block">
            <TurnCard state={state} />
            <ActionPanel state={state} act={act} canAct={!!canAct} onOpen={openShared} setSelectedTile={setSelectedTile} />
          </div>
          <RentBreakdown state={state} />
          {settings.mode !== "hotseat" ? <MissionCard state={state} seat={viewerSeat} /> : null}
          <div className="hidden lg:block">
            <Button variant="ghost" className="w-full text-xs text-ink-soft" onClick={onExit}>
              ← Kembali ke Menu Utama
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile Fixed Sticky Bottom Action Dock */}
      {state.phase !== "game_over" && me ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t-[2.5px] border-ink bg-white/95 px-2.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-sm lg:hidden">
          <div className="mx-auto max-w-lg space-y-1.5">
            {state.auction ? (
              <div className="rounded-full border-2 border-ink bg-sun-pale px-3 py-2 text-center text-xs font-extrabold text-ink">
                🔨 Lelang berlangsung — tunggu semua penawar
              </div>
            ) : state.offer && canAct ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  className="min-h-11 sm:min-h-0 flex-1 py-2.5 text-xs"
                  disabled={me.cash < state.offer.price}
                  onClick={() => act({ type: "BUY" })}
                >
                  Beli {TILES[state.offer.tile].short} ({rp(state.offer.price)})
                </Button>
                <Button
                  className="min-h-11 sm:min-h-0 px-3 py-2.5 text-xs"
                  onClick={() => act({ type: "DECLINE" })}
                >
                  Lelang
                </Button>
                <Button
                  className="min-h-11 sm:min-h-0 px-2.5 py-2.5 text-xs"
                  onClick={() => {
                    setSelectedTile(state.offer!.tile);
                    setPanel("property");
                  }}
                >
                  ℹ️
                </Button>
              </div>
            ) : state.phase === "jail" && canAct ? (
              <div className="flex items-center gap-1.5">
                <Button variant="primary" className="min-h-11 sm:min-h-0 flex-1 py-2.5 text-xs" onClick={() => act({ type: "ROLL" })}>
                  🎲 Lempar Dobel
                </Button>
                <Button
                  className="min-h-11 sm:min-h-0 px-3 py-2.5 text-xs"
                  disabled={me.cash < (me.character === "bandar" ? 100 : 50)}
                  onClick={() => act({ type: "PAY_JAIL" })}
                >
                  Bayar {rp(me.character === "bandar" ? 100 : 50)}
                </Button>
                {me.jailCards > 0 ? (
                  <Button variant="mint" className="min-h-11 sm:min-h-0 px-2.5 py-2.5 text-xs" onClick={() => act({ type: "USE_JAIL_CARD" })}>
                    🎟️
                  </Button>
                ) : null}
              </div>
            ) : state.phase === "await_roll" ? (
              canAct ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="primary"
                    className="min-h-11 sm:min-h-0 flex-1 py-2.5 text-sm"
                    onClick={() => act({ type: "ROLL" })}
                  >
                    🎲 Lempar Dadu
                  </Button>
                  {features(state).golden && !me.goldenUsed ? (
                    <Button
                      variant="sun"
                      className="min-h-11 sm:min-h-0 px-3 py-2.5 text-xs"
                      onClick={() => act({ type: "DECLARE_GOLDEN" })}
                      title="Aktifkan Giliran Emas"
                    >
                      ⚡ Emas
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-full border-2 border-ink bg-tint px-3 py-2 text-center text-xs font-bold text-ink-soft">
                  🤖 {me.name} sedang bermain…
                </div>
              )
            ) : canAct ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  className="min-h-11 sm:min-h-0 flex-1 py-2.5 text-sm"
                  onClick={() => act({ type: "END_TURN" })}
                >
                  Akhiri Giliran →
                </Button>
                {me.properties.length > 0 ? (
                  <Button
                    variant="sun"
                    className="min-h-11 sm:min-h-0 px-3 py-2.5 text-xs"
                    onClick={() => openShared("portfolio")}
                  >
                    🏠 Bangun
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-full border-2 border-ink bg-tint px-3 py-2 text-center text-xs font-bold text-ink-soft">
                🤖 {me.name} menyelesaikan giliran…
              </div>
            )}

            <div className={cn("grid gap-1", features(state).shop ? "grid-cols-6" : "grid-cols-5")}>
              <button
                type="button"
                onClick={() => openShared("portfolio")}
                className="flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95"
              >
                <span>🏘️</span>
                <span>Aset</span>
              </button>
              <button
                type="button"
                onClick={() => openShared("bank")}
                className="flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95"
              >
                <span>🏦</span>
                <span>Bank</span>
              </button>
              <button
                type="button"
                disabled={!canAct}
                onClick={() => openShared("trade")}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95",
                  !canAct && "opacity-45",
                )}
              >
                <span>🤝</span>
                <span>Dagang</span>
              </button>
              <button
                type="button"
                onClick={() => openShared("mission")}
                className="flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95"
              >
                <span>🎯</span>
                <span>Misi</span>
              </button>
              {features(state).shop ? (
                <button
                  type="button"
                  onClick={() => openShared("shop")}
                  className="flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95"
                >
                  <span>🛒</span>
                  <span>Toko</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openShared("log")}
                className="flex min-h-11 flex-col items-center justify-center rounded-xl border-[1.5px] border-ink bg-tint py-1 text-[10px] font-bold text-ink active:scale-95"
              >
                <span>📜</span>
                <span>Log</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gateOpen && me ? <PassGate name={me.name} onContinue={() => setGateOpen(false)} /> : null}
      {tradeGate && !gateOpen ? (
        <PassGate
          name={playerOf(state, tradeGate)?.name ?? "Pemain"}
          onContinue={() => {
            setTradeGate(null);
            setPanel("trade");
          }}
        />
      ) : null}
      {state.auction ? (
        <AuctionDialog state={state} act={act} onFocusTile={(id) => setSelectedTile(id)} />
      ) : null}
      <TradeDialog
        state={state}
        act={act}
        open={panel === "trade"}
        viewerId={tradeViewerId}
        onClose={() => {
          if (state.trade) dismissedTrade.current = tradeKey;
          setPanel(null);
        }}
        onFocusTile={(id) => setSelectedTile(id)}
      />
      <PortfolioDialog
        state={state}
        act={act}
        open={panel === "portfolio"}
        onClose={() => setPanel(null)}
        viewerId={viewerId}
        canAct={!!canAct}
        onOpenBank={() => setPanel("bank")}
      />
      <ShopDialog state={state} act={act} open={panel === "shop"} onClose={() => setPanel(null)} viewerId={viewerId} />
      <BankDialog state={state} act={act} open={panel === "bank"} onClose={() => setPanel(null)} viewerId={viewerId} />
      <MissionDialog state={state} open={panel === "mission"} onClose={() => setPanel(null)} viewerId={viewerId} />
      <RulesDialog open={panel === "rules"} onClose={() => setPanel(null)} maxRounds={state.settings.maxRounds} />
      <PlayerDetailDialog state={state} playerId={inspectId} onClose={() => setInspectId(null)} />
      <Modal
        open={panel === "property" && selectedTile !== null}
        onClose={() => setPanel(null)}
        title={selectedTile !== null ? TILES[selectedTile].name : "Properti"}
        width="max-w-md"
      >
        {selectedTile !== null ? (
          <PropertySheet
            state={state}
            tileId={selectedTile}
            act={act}
            onClose={() => setPanel(null)}
            onSelectTile={(id) => setSelectedTile(id)}
          />
        ) : null}
      </Modal>
      <Modal
        open={panel === "log"}
        onClose={() => setPanel(null)}
        title="Riwayat Aktivitas"
        width="max-w-md"
      >
        <div className="divide-y divide-divider">
          {state.log
            .slice(-50)
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 py-2 text-xs">
                <span className="shrink-0 rounded-full border border-ink bg-tint px-2 py-0.5 font-mono text-[10px] font-bold">
                  R{entry.round}
                </span>
                <span
                  className={cn(
                    "flex-1 leading-snug",
                    entry.tone === "warn"
                      ? "font-semibold text-tomato"
                      : entry.tone === "money"
                        ? "font-semibold text-positive"
                        : entry.tone === "good"
                          ? "font-bold text-ink"
                          : "text-ink-soft",
                  )}
                >
                  {entry.text}
                </span>
              </div>
            ))}
        </div>
      </Modal>
      {state.phase === "game_over" || panel === "result" ? (
        <ResultDialog state={state} onRestart={restart} onExit={onExit} />
      ) : null}
    </div>
  );
}

function TurnCard({ state }: { state: GameState }) {
  const me = current(state);
  const charObj = CHARACTERS.find((c) => c.id === me?.character);
  const posTile = me ? TILES[me.position] : TILES[0];
  const deltas = useCashDeltas(state);
  const delta = me ? deltas[me.id] : undefined;
  return (
    <div className="panel relative p-4">
      {delta ? (
        <span
          key={delta.seq}
          className={cn(
            "pointer-events-none absolute -top-3 right-4 z-20 rounded-full border-2 border-ink px-2.5 py-0.5 font-mono text-xs font-extrabold animate-[float-delta_1.35s_ease-out_forwards]",
            delta.amount > 0 ? "bg-mint text-ink" : "bg-tomato text-white",
          )}
        >
          {delta.amount > 0 ? `+${rp(delta.amount)}` : `−${rp(Math.abs(delta.amount))}`}
        </span>
      ) : null}
      <div className="flex items-center gap-3">
        <PawnAvatar index={me?.tokenIndex ?? state.turnIndex} color={me?.color ?? "#FFD23F"} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-extrabold leading-tight">{me?.name}</div>
          <Tooltip
            tip={charObj ? `+ ${charObj.perk} · − ${charObj.flaw}` : undefined}
            position="bottom"
          >
            <div className="cursor-help text-xs font-semibold text-ink-soft underline decoration-dotted underline-offset-2">
              {me?.isBot ? "Bot AI" : "Pemain"} · {charObj?.name ?? me?.character}
            </div>
          </Tooltip>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-ink-soft">Cash</div>
          <div className="money text-lg font-extrabold text-positive">{rp(me?.cash ?? 0)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Posisi" value={posTile.short} />
        <MiniStat label="Properti" value={me?.properties.length ?? 0} />
        <MiniStat label="Grup" value={me ? new Set(me.properties.map((id) => TILES[id].group).filter(Boolean)).size : 0} />
      </div>

      {me?.inJail ? (
        <div className="mt-2.5 rounded-2xl border-2 border-ink bg-tomato-pale px-3 py-1.5 text-xs font-bold text-ink">
          🚔 Di penjara · Percobaan {me.jailTurns}/3
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-tint px-2 py-1.5">
      <div className="text-[10px] font-semibold text-ink-soft">{label}</div>
      <div className="money truncate text-xs font-bold">{value}</div>
    </div>
  );
}

export function ActionPanel({
  state,
  act,
  canAct,
  onOpen,
  compact,
}: {
  state: GameState;
  act: (a: Action) => void;
  canAct: boolean;
  onOpen: (p: PanelKind) => void;
  setSelectedTile: (id: number | null) => void;
  compact?: boolean;
}) {
  const me = current(state);
  const phase = state.phase;
  const auction = state.auction;

  if (!me || state.phase === "game_over") {
    return (
      <div className="panel p-4 text-center text-sm font-bold">Permainan selesai.</div>
    );
  }

  if (auction) {
    return (
      <div className="panel bg-sun-pale p-4 text-center text-sm font-bold">
        🔨 Lelang berjalan — tunggu semua penawar.
      </div>
    );
  }

  if (me.isBot) {
    return (
      <div className="panel space-y-1 p-4 text-center">
        <div className="font-display text-sm font-extrabold">🤖 {me.name} sedang bermain…</div>
        <p className="text-xs font-semibold text-ink-soft">
          {state.offer
            ? `Mempertimbangkan ${TILES[state.offer.tile].name} seharga ${rp(state.offer.price)}.`
            : "Bot mempertimbangkan langkah terbaiknya."}
        </p>
      </div>
    );
  }

  if (state.offer) {
    const tile = TILES[state.offer.tile];
    const price = state.offer.price;
    const affordable = me.cash >= price;
    const groupIds = tile.group ? GROUP_TILES[tile.group] : [];
    const ownedInGroup = groupIds.filter((id) => state.tiles[id].owner === me.id).length;
    const completesMonopoly = Boolean(tile.group && ownedInGroup === groupIds.length - 1);

    return (
      <div className="panel space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-sun-pale p-1">
            <TileArtwork tileId={tile.id} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-ink-soft">Tawaran beli kota</div>
            <div className="truncate font-display text-lg font-extrabold">{tile.name}</div>
          </div>
        </div>

        {tile.group ? (
          <div
            className={cn(
              "rounded-2xl border-2 border-ink px-3 py-1.5 text-xs font-bold",
              completesMonopoly ? "bg-mint text-ink" : "bg-tint text-ink-soft",
            )}
          >
            {completesMonopoly
              ? `✨ Beli ini untuk melengkapi Monopoli ${GROUP_NAMES[tile.group]}!`
              : `Grup ${GROUP_NAMES[tile.group]}: kamu sudah punya ${ownedInGroup}/${groupIds.length}`}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-ink bg-tint p-2.5">
          <div>
            <div className="text-[11px] font-semibold text-ink-soft">Harga beli</div>
            <div className="money text-lg font-extrabold">{rp(price)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-ink-soft">Sewa dasar</div>
            <div className="money text-base font-bold text-blue">{rp(state.offer.rent)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            disabled={!canAct || !affordable}
            onClick={() => act({ type: "BUY" })}
          >
            Beli Sekarang
          </Button>
          <Button disabled={!canAct} onClick={() => act({ type: "DECLINE" })}>
            Lelang / Lewati
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Tooltip tip="Ambil pinjaman bank atau jual saham untuk tambah modal" className="w-full">
            <Button
              className="min-h-11 sm:min-h-0 w-full px-2 py-1.5 text-[11px]"
              disabled={!canAct}
              onClick={() => onOpen("bank")}
            >
              🏦 Pinjam Bank
            </Button>
          </Tooltip>
          <Tooltip tip="Gadaikan atau jual rumah aset lain untuk tambah dana" className="w-full">
            <Button
              className="min-h-11 sm:min-h-0 w-full px-2 py-1.5 text-[11px]"
              disabled={!canAct || me.properties.length === 0}
              onClick={() => onOpen("portfolio")}
            >
              🏘️ Kelola / Gadai
            </Button>
          </Tooltip>
        </div>

        {!affordable ? (
          <p className="text-xs font-bold text-tomato">
            Dana kurang {rp(price - me.cash)} lagi — bisa pinjam bank atau gadai aset dulu!
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === "jail") {
    const jailFine = me.character === "bandar" ? 100 : 50;
    return (
      <div className="panel space-y-3 p-4">
        <div className="font-display text-base font-extrabold">Kamu sedang di penjara</div>
        <Button
          variant="primary"
          className="w-full text-sm"
          disabled={!canAct}
          onClick={() => act({ type: "ROLL" })}
        >
          🎲 Coba Lempar Dobel
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button className="text-xs" disabled={!canAct || me.cash < jailFine} onClick={() => act({ type: "PAY_JAIL" })}>
            Bayar {rp(jailFine)}
          </Button>
          <Button
            variant="mint"
            className="text-xs"
            disabled={!canAct || me.jailCards === 0}
            onClick={() => act({ type: "USE_JAIL_CARD" })}
          >
            Pakai Surat ({me.jailCards})
          </Button>
        </div>
        <p className="text-xs text-ink-soft">Dapat angka dobel = langsung bebas. Gagal 3× wajib bayar denda.</p>
      </div>
    );
  }

  if (phase === "await_roll") {
    return (
      <div className="panel space-y-2.5 p-4">
        <Button
          variant="primary"
          className="w-full py-3.5 text-base animate-[pulse-dot_1.8s_ease-out_infinite]"
          disabled={!canAct}
          onClick={() => act({ type: "ROLL" })}
        >
          🎲 Lempar Dadu
        </Button>
        {features(state).golden && !me.goldenUsed ? (
          <Button variant="sun" className="w-full text-xs" disabled={!canAct} onClick={() => act({ type: "DECLARE_GOLDEN" })}>
            ⚡ Aktifkan Giliran Emas (1× per game)
          </Button>
        ) : null}
        <p className="text-center text-xs font-semibold text-ink-soft">
          {me.isBot ? "Bot sedang berpikir…" : "Giliranmu! Lempar dadu atau ketuk Arena Dadu di papan."}
        </p>
      </div>
    );
  }

  const mortgageable = me.properties.find((id) => state.tiles[id].houses === 0 && !state.tiles[id].mortgaged);

  return (
    <div className="panel space-y-2.5 p-4">
      <Button variant="primary" className="w-full text-sm" disabled={!canAct} onClick={() => act({ type: "END_TURN" })}>
        Akhiri Giliran →
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Tooltip
          tip={
            me.properties.length === 0
              ? "Belum punya properti untuk dikelola"
              : "Lihat semua propertimu, bangun rumah/hotel, atau jual bangunan"
          }
          className="w-full"
        >
          <Button
            className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs"
            disabled={!canAct || me.properties.length === 0}
            onClick={() => onOpen("portfolio")}
          >
            🏠 Bangun / Aset
          </Button>
        </Tooltip>
        <Tooltip
          tip={
            !mortgageable
              ? "Tidak ada properti bebas bangunan yang bisa digadaikan"
              : "Gadaikan atau tebus properti milikmu"
          }
          className="w-full"
        >
          <Button
            className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs"
            disabled={!canAct || me.properties.length === 0}
            onClick={() => onOpen("portfolio")}
          >
            🏦 Gadai / Tebus
          </Button>
        </Tooltip>
        {!compact ? (
          <>
            <Tooltip tip="Ajukan barter uang atau properti dengan pemain lain" className="w-full">
              <Button className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs" disabled={!canAct} onClick={() => onOpen("trade")}>
                🤝 Dagang
              </Button>
            </Tooltip>
            <Tooltip tip="Ambil pinjaman bank atau investasi saham grup warna" className="w-full">
              <Button className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs" disabled={!canAct} onClick={() => onOpen("bank")}>
                💳 Bank &amp; Saham
              </Button>
            </Tooltip>
            {features(state).shop ? (
              <Tooltip tip="Beli kartu taktis dari Pasar Loak" className="w-full">
                <Button className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs" disabled={!canAct} onClick={() => onOpen("shop")}>
                  🛒 Pasar Loak
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip tip="Cek target misi rahasiamu" className="w-full">
              <Button className="min-h-11 sm:min-h-0 w-full px-3 py-2 text-xs" onClick={() => onOpen("mission")}>
                🎯 Misi
              </Button>
            </Tooltip>
          </>
        ) : null}
      </div>
      <p className="text-center text-xs font-medium text-ink-soft">
        {me.isBot ? "Bot menyelesaikan giliran…" : "Arahkan kursor atau ketuk salah satu petak di papan."}
      </p>
    </div>
  );
}
