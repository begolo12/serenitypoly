"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGame, type SeatConfig } from "@/engine/create";
import { applyAction, current, features, living, playerOf } from "@/engine/actions";
import { botAction } from "@/engine/bot";
import { TILES, WAVE_LABEL } from "@/engine/data";
import type { Action, GameState, Settings } from "@/engine/types";
import { Board } from "@/components/game/Board";
import { MissionCard, PlayerRail, PropertySheet, RentBreakdown } from "@/components/game/Panels";
import {
  AuctionDialog,
  BankDialog,
  MissionDialog,
  PassGate,
  PlayerDetailDialog,
  ResultDialog,
  RulesDialog,
  ShopDialog,
  TradeDialog,
} from "@/components/game/Dialogs";
import { Button, Chip, Modal } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import { initMute, isBgmPlaying, isMuted, setMuted, sfx, stopBgm, toggleBgm } from "@/lib/sfx";

export type PanelKind = "bank" | "shop" | "trade" | "mission" | "rules" | "property" | "result" | null;

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
  const [muted, setMutedState] = useState(false);
  const [bgm, setBgm] = useState(false);
  const [timer, setTimer] = useState(settings.turnTimer);
  const lastTurn = useRef<string>("");

  useEffect(() => {
    initMute();
    setMutedState(isMuted());
    setBgm(isBgmPlaying());
    return () => stopBgm();
  }, []);

  const act = useCallback((action: Action) => {
    const prev = stateRef.current;
    const next = applyAction(prev, action);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);

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

    if (next.phase === "game_over" && prev.phase !== "game_over") {
      sfx.win();
      setPanel("result");
    } else {
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

  useEffect(() => {
    if (!me?.id) return;
    if (state.phase === "game_over") return;
    if (lastTurn.current === me.id) return;
    lastTurn.current = me.id;
    setTimer(settings.turnTimer);
    if (settings.mode === "hotseat" && !me.isBot) {
      setGateOpen(true);
    }
  }, [me?.id, state.phase, settings.mode, settings.turnTimer]);

  useEffect(() => {
    if (state.phase === "game_over" || gateOpen) return;
    if (!botPending) return;
    const t = window.setTimeout(() => {
      const action = botAction(state);
      act(action ?? { type: "END_TURN" });
    }, 650);
    return () => window.clearTimeout(t);
  }, [state.version, state.phase, gateOpen, botPending, state, act]);

  useEffect(() => {
    if (!settings.turnTimer || gateOpen || isBot || state.phase === "game_over") return;
    if (state.phase === "auction" || state.trade) return;
    if (timer <= 0) return;
    const t = window.setTimeout(() => setTimer((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timer, settings.turnTimer, gateOpen, isBot, state.phase, state.trade]);

  useEffect(() => {
    if (!settings.turnTimer || timer > 0 || isBot || gateOpen) return;
    if (state.phase === "await_roll" || state.phase === "jail") act({ type: "ROLL" });
    else if (state.phase === "post_roll") act({ type: "END_TURN" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer]);

  const openShared = (kind: PanelKind) => {
    sfx.click();
    setPanel(kind);
  };

  const restart = () => {
    localStorage.removeItem("sp-game");
    const fresh = createGame(settings, seats);
    stateRef.current = fresh;
    setState(fresh);
    lastTurn.current = "";
    setGateOpen(settings.mode === "hotseat");
    setPanel(null);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (next) setBgm(false);
  };

  const handleBgm = () => {
    const active = toggleBgm();
    setBgm(active);
    if (active) setMutedState(false);
  };

  const canAct = !isBot && !gateOpen && state.phase !== "auction" && !state.trade;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2 p-2 md:p-3">
      <header className="flex flex-wrap items-center gap-2">
        <div className="font-display text-lg uppercase leading-none tracking-tighter md:text-xl">
          Serenity<span className="bg-yellow px-1">Poly</span>
        </div>
        <Chip color="#FFD43B">
          Ronde {state.round} · {WAVE_LABEL[state.wave]}
        </Chip>
        <Chip>{living(state).length} pemain</Chip>
        {state.event ? <Chip color="#FF8A3D" title={state.event.text}>{state.event.label}</Chip> : null}
        {settings.turnTimer ? (
          <Chip color={timer <= 5 ? "#FF4D4D" : "#EFE9DA"}>⏱ {Math.max(0, timer)}s</Chip>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" className="px-2 text-xs" onClick={() => openShared("mission")}>
            🎯 Misi
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => openShared("bank")}>
            🏦 Bank
          </Button>
          {features(state).shop ? (
            <Button variant="ghost" className="px-2 text-xs" onClick={() => openShared("shop")}>
              🛒 Toko
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="px-2 text-xs"
            disabled={!canAct}
            onClick={() => openShared("trade")}
          >
            🤝 Dagang
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={handleBgm} aria-label="Musik latar" title="Musik latar">
            {bgm ? "🎵" : "🎶"}
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={toggleMute} aria-label="Suara">
            {muted ? "🔇" : "🔊"}
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => openShared("rules")}>
            📖
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        <aside className="lg:w-[228px] lg:shrink-0">
          <PlayerRail state={state} onInspect={setInspectId} />
        </aside>

        <main className="min-w-0 flex-1">
          <Board
            state={state}
            selected={selectedTile}
            onSelect={(id) => {
              setSelectedTile(id);
              setPanel("property");
            }}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 lg:hidden">
            <span className="chip">Cash {rp(me?.cash ?? 0)}</span>
            <span className="chip">{me?.name}</span>
          </div>
        </main>

        <aside className="flex w-full flex-col gap-2 lg:w-[340px] lg:shrink-0">
          <TurnCard state={state} />
          <ActionPanel state={state} act={act} canAct={!!canAct} onOpen={openShared} setSelectedTile={setSelectedTile} />
          <RentBreakdown state={state} />
          {settings.mode !== "hotseat" ? <MissionCard state={state} seat={state.turnIndex} /> : null}
          <div className="hidden lg:block">
            <Button variant="ghost" className="w-full text-xs" onClick={onExit}>
              ← Kembali ke menu
            </Button>
          </div>
        </aside>
      </div>

      {gateOpen && me ? <PassGate name={me.name} onContinue={() => setGateOpen(false)} /> : null}
      {state.auction ? <AuctionDialog state={state} act={act} /> : null}
      <TradeDialog state={state} act={act} open={panel === "trade"} onClose={() => setPanel(null)} />
      <ShopDialog state={state} act={act} open={panel === "shop"} onClose={() => setPanel(null)} />
      <BankDialog state={state} act={act} open={panel === "bank"} onClose={() => setPanel(null)} />
      <MissionDialog state={state} open={panel === "mission"} onClose={() => setPanel(null)} />
      <RulesDialog open={panel === "rules"} onClose={() => setPanel(null)} />
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
          />
        ) : null}
      </Modal>
      {state.phase === "game_over" || panel === "result" ? (
        <ResultDialog state={state} onRestart={restart} onExit={onExit} />
      ) : null}
    </div>
  );
}

function TurnCard({ state }: { state: GameState }) {
  const me = current(state);
  const character = me?.character;
  return (
    <div className="panel p-2" style={{ borderTop: `8px solid ${me?.color ?? "#0A0A0A"}` }}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{me?.token}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm uppercase leading-none">{me?.name}</div>
          <div className="text-[10px] font-bold uppercase opacity-60">
            {me?.isBot ? "Bot" : "Pemain"} · {character}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase opacity-60">Cash</div>
          <div className="money text-sm font-bold">{rp(me?.cash ?? 0)}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <MiniStat label="Petak" value={me?.position ?? 0} />
        <MiniStat label="Properti" value={me?.properties.length ?? 0} />
        <MiniStat label="Grup" value={me ? new Set(me.properties.map((id) => TILES[id].group).filter(Boolean)).size : 0} />
      </div>
      {me?.inJail ? (
        <div className="mt-2 border-[3px] border-ink bg-red/20 px-2 py-1 text-[10px] font-bold uppercase">
          Di penjara · percobaan {me.jailTurns}/3
        </div>
      ) : null}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-[2px] border-ink bg-muted px-1 py-0.5">
      <div className="text-[8px] font-bold uppercase opacity-60">{label}</div>
      <div className="money text-[11px] font-bold">{value}</div>
    </div>
  );
}

export function ActionPanel({
  state,
  act,
  canAct,
  onOpen,
  setSelectedTile,
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
      <div className="panel p-2 text-center text-xs font-bold uppercase">Permainan selesai.</div>
    );
  }

  if (auction) {
    return (
      <div className="panel p-2 text-center text-xs font-bold uppercase">
        Lelang berjalan — tunggu penawar.
      </div>
    );
  }

  if (state.offer) {
    const tile = TILES[state.offer.tile];
    const price = state.offer.price;
    const affordable = me.cash >= price;
    return (
      <div className={cn("panel space-y-2 p-2")}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase opacity-60">Tawaran beli</span>
          <Chip color="#FFD43B">{tile.short}</Chip>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase opacity-60">Harga</div>
            <div className="money text-lg font-bold">{rp(price)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase opacity-60">Sewa</div>
            <div className="money text-sm">{rp(state.offer.rent)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            disabled={!canAct || !affordable}
            onClick={() => act({ type: "BUY" })}
          >
            Beli
          </Button>
          <Button disabled={!canAct} onClick={() => act({ type: "DECLINE" })}>
            Lelang / Lewati
          </Button>
        </div>
        {!affordable ? (
          <p className="text-[10px] font-bold uppercase text-red">Butuh {rp(price - me.cash)} lagi.</p>
        ) : null}
      </div>
    );
  }

  if (phase === "jail") {
    const jailFine = me.character === "bandar" ? 100 : 50;
    return (
      <div className={cn("panel space-y-2 p-2")}>
        <div className="text-[10px] font-bold uppercase opacity-60">Kamu di penjara</div>
        <div className="grid grid-cols-3 gap-1">
          <Button className="px-1 text-[10px]" disabled={!canAct || me.cash < jailFine} onClick={() => act({ type: "PAY_JAIL" })}>
            Bayar {jailFine}
          </Button>
          <Button
            className="px-1 text-[10px]"
            disabled={!canAct || me.jailCards === 0}
            onClick={() => act({ type: "USE_JAIL_CARD" })}
          >
            Pakai Surat
          </Button>
          <Button variant="primary" className="px-1 text-[10px]" disabled={!canAct} onClick={() => act({ type: "ROLL" })}>
            Coba Dobel
          </Button>
        </div>
        <p className="text-[10px] uppercase opacity-60">Dobel = keluar. Gagal 3× = bayar denda.</p>
      </div>
    );
  }

  if (phase === "await_roll") {
    return (
      <div className={cn("panel space-y-2 p-2")}>
        <Button
          variant="primary"
          className="w-full animate-[pulse-ring_1.8s_ease-out_infinite] text-base"
          disabled={!canAct}
          onClick={() => act({ type: "ROLL" })}
        >
          🎲 Lempar Dadu
        </Button>
        {features(state).golden && !me.goldenUsed ? (
          <Button className="w-full text-xs" disabled={!canAct} onClick={() => act({ type: "DECLARE_GOLDEN" })}>
            ⚡ Giliran Emas (sekali per game)
          </Button>
        ) : null}
        <p className="text-center text-[10px] font-bold uppercase opacity-60">
          {me.isBot ? "Bot berpikir…" : "Giliranmu"}
        </p>
      </div>
    );
  }

  const nextBuildable = me.properties.find((id) => {
    const t = TILES[id];
    return t.group && state.tiles[id].houses < 5;
  });
  const mortgageable = me.properties.find((id) => state.tiles[id].houses === 0 && !state.tiles[id].mortgaged);

  return (
    <div className={cn("panel space-y-2 p-2")}>
      <div className="grid grid-cols-2 gap-1">
        <Button variant="primary" className="col-span-2 text-sm" disabled={!canAct} onClick={() => act({ type: "END_TURN" })}>
          Akhiri Giliran →
        </Button>
        <Button
          className="text-[10px]"
          disabled={!canAct || !nextBuildable}
          onClick={() => {
            if (nextBuildable !== undefined) {
              setSelectedTile(nextBuildable);
              onOpen("property");
            }
          }}
        >
          🏠 Bangun
        </Button>
        <Button
          className="text-[10px]"
          disabled={!canAct || !mortgageable}
          onClick={() => {
            if (mortgageable !== undefined) {
              setSelectedTile(mortgageable);
              onOpen("property");
            }
          }}
        >
          🏦 Gadai
        </Button>
        {!compact ? (
          <>
            <Button className="text-[10px]" disabled={!canAct} onClick={() => onOpen("trade")}>
              🤝 Dagang
            </Button>
            <Button className="text-[10px]" disabled={!canAct} onClick={() => onOpen("bank")}>
              🏦 Bank & Saham
            </Button>
            {features(state).shop ? (
              <Button className="text-[10px]" disabled={!canAct} onClick={() => onOpen("shop")}>
                🛒 Pasar Loak
              </Button>
            ) : null}
            <Button className="text-[10px]" onClick={() => onOpen("mission")}>
              🎯 Misi
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-center text-[10px] font-bold uppercase opacity-60">
        {me.isBot ? "Bot menyelesaikan giliran…" : "Bangun / gadai lewat tombol atau klik petak."}
      </p>
    </div>
  );
}
