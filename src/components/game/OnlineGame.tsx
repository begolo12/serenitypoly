"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Action, GameState } from "@/engine/types";
import { current, features, groupComplete, living, netWorth, playerOf } from "@/engine/actions";
import { CHARACTERS, GROUP_COLORS, PLAYER_COLORS, TILES, TOKENS, WAVE_LABEL } from "@/engine/data";
import { Board } from "@/components/game/Board";
import { PlayerRail, PropertySheet, RentBreakdown } from "@/components/game/Panels";
import {
  AuctionDialog,
  BankDialog,
  MissionDialog,
  PlayerDetailDialog,
  ResultDialog,
  RulesDialog,
  ShopDialog,
  TradeDialog,
} from "@/components/game/Dialogs";
import { ActionPanel, type PanelKind } from "@/components/game/GameScreen";
import { QrCode } from "@/components/game/QrCode";
import { Button, Chip, Modal } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import type { PublicRoom } from "@/lib/online";
import { initMute, isBgmPlaying, isMuted, setMuted, sfx, stopBgm, toggleBgm } from "@/lib/sfx";

type Identity = { playerId: string; token: string };

function playDeltaSfx(prev: GameState | null, next: GameState) {
  if (!prev) {
    sfx.turn();
    return;
  }
  if (next.phase === "game_over" && prev.phase !== "game_over") {
    sfx.win();
    return;
  }
  if (next.round > prev.round && next.event && next.event.id !== prev.event?.id) {
    sfx.event();
    return;
  }
  const diceRolled =
    Boolean(next.dice) &&
    (next.turnIndex !== prev.turnIndex ||
      next.doubles !== prev.doubles ||
      next.lastMove?.to !== prev.lastMove?.to ||
      next.dice?.[0] !== prev.dice?.[0] ||
      next.dice?.[1] !== prev.dice?.[1]);
  if (diceRolled && next.lastMove) {
    sfx.dice();
    return;
  }
  if (next.auction && (!prev.auction || next.auction.bid > prev.auction.bid)) {
    sfx.auction();
    return;
  }
  const last = next.log[next.log.length - 1];
  const prevLast = prev.log[prev.log.length - 1];
  if (last && last.id !== prevLast?.id) {
    if (last.tone === "warn") sfx.bad();
    else if (last.tone === "money") sfx.coin();
    else if (last.tone === "good") sfx.buy();
    else sfx.click();
  }
}

function pendingActorIsBot(state: GameState): boolean {
  if (state.phase === "game_over") return false;
  if (state.auction) {
    return Boolean(state.auction.current && playerOf(state, state.auction.current)?.isBot);
  }
  if (state.trade) {
    return Boolean(playerOf(state, state.trade.to)?.isBot);
  }
  return Boolean(current(state)?.isBot);
}

export function OnlineGame({ code, tv }: { code: string; tv: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [origin, setOrigin] = useState("");
  const [muted, setMutedState] = useState(false);
  const [bgm, setBgm] = useState(false);
  const [showBoardOnMobile, setShowBoardOnMobile] = useState(false);
  const [showPropsTab, setShowPropsTab] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [busy, setBusy] = useState(false);

  const versionRef = useRef(0);
  const prevSeatsRef = useRef<number | null>(null);
  const botBusyRef = useRef(false);
  const prevMyTurnRef = useRef(false);

  useEffect(() => {
    initMute();
    setMutedState(isMuted());
    setBgm(isBgmPlaying());
    setOrigin(window.location.origin);
    if (!tv) {
      const raw = localStorage.getItem(`sp-seat-${code}`);
      if (raw) {
        try {
          setIdentity(JSON.parse(raw) as Identity);
        } catch {
          /* ignore */
        }
      }
    }
    return () => stopBgm();
  }, [code, tv]);

  useEffect(() => {
    let alive = true;
    let timer = 0;

    const tick = async () => {
      try {
        const res = await fetch(`/api/games/${code}?since=${versionRef.current}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (alive && data.state) {
            const nextState = data.state as GameState;
            if (data.version !== versionRef.current) {
              playDeltaSfx(stateRef.current, nextState);
              versionRef.current = data.version;
              stateRef.current = nextState;
              setState(nextState);
            }
          }
        }
        if (!stateRef.current) {
          const rr = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
          if (rr.ok) {
            const rd = await rr.json();
            if (alive) {
              const nextRoom = rd.room as PublicRoom;
              if (prevSeatsRef.current !== null && nextRoom.seats.length > prevSeatsRef.current) {
                sfx.join();
              }
              prevSeatsRef.current = nextRoom.seats.length;
              setRoom(nextRoom);
              if (rd.lanIp) setLanIp(rd.lanIp as string);
            }
          }
        }
      } catch {
        /* offline; retry next tick */
      }
      if (alive) timer = window.setTimeout(tick, 1100);
    };

    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code]);

  // Bot turn runner (TV screen or first living human client as fallback)
  useEffect(() => {
    if (!state || state.phase === "game_over") return;
    if (!pendingActorIsBot(state)) return;

    const firstHuman = state.players.find((p) => !p.isBot && !p.bankrupt);
    const shouldDrive = tv || (identity?.playerId && firstHuman?.id === identity.playerId);
    if (!shouldDrive) return;

    const delay = tv ? 650 : 1100;
    const t = window.setTimeout(async () => {
      if (botBusyRef.current) return;
      botBusyRef.current = true;
      try {
        const hostToken = tv ? localStorage.getItem(`sp-host-${code}`) ?? undefined : undefined;
        const res = await fetch(`/api/games/${code}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(identity ?? {}),
            tv,
            hostToken,
            action: { type: "BOT_STEP" },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.state && data.version && data.version !== versionRef.current) {
          playDeltaSfx(stateRef.current, data.state as GameState);
          versionRef.current = data.version;
          stateRef.current = data.state as GameState;
          setState(data.state as GameState);
        }
      } catch {
        /* ignore */
      } finally {
        botBusyRef.current = false;
      }
    }, delay);

    return () => window.clearTimeout(t);
  }, [state, tv, code, identity]);

  // Notify mobile controller when turn or auction/trade attention switches to them
  useEffect(() => {
    if (tv || !state || !identity?.playerId || state.phase === "game_over") return;
    const myId = identity.playerId;
    const myTurn = current(state)?.id === myId;
    const myBid = state.auction?.current === myId;
    const myTrade = state.trade?.to === myId;
    const nowActive = Boolean(myTurn || myBid || myTrade);
    if (nowActive && !prevMyTurnRef.current) {
      sfx.turn();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(60);
      }
    }
    prevMyTurnRef.current = nowActive;
  }, [state, tv, identity?.playerId]);

  const act = useCallback(
    async (action: Action) => {
      if (!identity) return;
      try {
        const res = await fetch(`/api/games/${code}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...identity, action }),
        });
        const data = await res.json();
        if (data.state) {
          playDeltaSfx(stateRef.current, data.state as GameState);
          versionRef.current = data.version;
          stateRef.current = data.state as GameState;
          setState(data.state as GameState);
        }
        if (!res.ok && data.error) setErr(data.error);
        else setErr("");
      } catch {
        setErr("Koneksi bermasalah");
      }
    },
    [code, identity],
  );

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

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  };

  const reclaimSeat = async (playerId: string) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reclaimId: playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal klaim kursi");
      const idn: Identity = { playerId: data.playerId, token: data.token };
      localStorage.setItem(`sp-seat-${code}`, JSON.stringify(idn));
      setIdentity(idn);
      sfx.join();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal klaim kursi");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <WaitRoom
        code={code}
        room={room}
        origin={origin}
        lanIp={lanIp}
        tv={tv}
        identity={identity}
        onRoomUpdate={(r) => setRoom(r)}
        onStartGame={() => {
          /* polling will pick up game immediately */
        }}
        onBack={() => router.push("/")}
      />
    );
  }

  const me = current(state);
  const myId = identity?.playerId ?? null;
  const myPlayer = myId ? playerOf(state, myId) : null;
  const isMyTurn = Boolean(myId && me?.id === myId);
  const canAct = isMyTurn && !state.trade && state.phase !== "auction" && state.phase !== "game_over";

  const joinBaseUrl = (() => {
    if (!origin) return "";
    try {
      const u = new URL(origin);
      if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && lanIp) {
        return `${u.protocol}//${lanIp}${u.port ? `:${u.port}` : ""}/room/${code}`;
      }
    } catch {
      /* ignore */
    }
    return `${origin}/room/${code}`;
  })();

  if (tv) {
    const tvAuctionBidder = state.auction?.current ? playerOf(state, state.auction.current) : null;
    const tvAuctionLeader = state.auction?.leader ? playerOf(state, state.auction.leader) : null;
    const tvTradeFrom = state.trade ? playerOf(state, state.trade.from) : null;
    const tvTradeTo = state.trade ? playerOf(state, state.trade.to) : null;
    const tvOfferTile = state.offer ? TILES[state.offer.tile] : null;
    const meChar = CHARACTERS.find((c) => c.id === me?.character);

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2 p-2 md:p-4">
        <header className="flex flex-wrap items-center gap-2">
          <div className="font-display text-xl uppercase leading-none tracking-tighter md:text-2xl">
            Serenity<span className="bg-yellow px-1">Poly</span>
          </div>
          <Chip color="#FFD43B">
            Ronde {state.round}/{state.settings.maxRounds} · {WAVE_LABEL[state.wave]}
          </Chip>
          <Chip color="#EFE9DA">KODE {code}</Chip>
          <Chip color={me?.color}>{me?.token} {me?.name} · giliran</Chip>
          {state.event ? <Chip color="#FF8A3D">⚡ {state.event.label}</Chip> : null}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button className="px-2.5 text-xs" onClick={() => setQrModalOpen(true)}>
              📱 QR &amp; Kode
            </Button>
            <Button variant="ghost" className="px-2 text-xs" onClick={handleBgm} title="Musik latar">
              {bgm ? "🎵" : "🎶"}
            </Button>
            <Button variant="ghost" className="px-2 text-xs" onClick={toggleMute} title="Suara">
              {muted ? "🔇" : "🔊"}
            </Button>
            <Button variant="ghost" className="px-2 text-xs" onClick={toggleFullscreen} title="Layar Penuh">
              ⛶
            </Button>
            <Button variant="ghost" className="px-2 text-xs" onClick={() => router.push("/")}>
              ← Menu
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <aside className="lg:w-[236px] lg:shrink-0">
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
          </main>

          <aside className="flex w-full flex-col gap-2 lg:w-[320px] lg:shrink-0">
            <div className="panel p-3" style={{ borderTop: `10px solid ${me?.color ?? "#0A0A0A"}` }}>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sekarang bermain</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl">{me?.token}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xl uppercase leading-none">{me?.name}</div>
                  <div className="text-[11px] font-bold uppercase opacity-60">
                    {me?.isBot ? "Bot AI" : "Kontroler HP"} · {meChar?.name}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t-2 border-dashed border-ink/20 pt-2">
                <span className="text-[10px] font-bold uppercase opacity-60">Cash</span>
                <span className="money text-xl font-bold">{rp(me?.cash ?? 0)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs">
                <span className="font-bold uppercase opacity-60">Posisi</span>
                <span className="font-bold">{me ? TILES[me.position].name : "—"}</span>
              </div>
              {me?.inJail ? (
                <div className="mt-2 border-2 border-ink bg-red/20 px-2 py-1 text-[10px] font-bold uppercase">
                  🚔 Di Penjara ({me.jailTurns}/3)
                </div>
              ) : null}
            </div>

            {state.auction ? (
              <div className="panel space-y-1.5 bg-yellow/40 p-3">
                <div className="flex items-center justify-between">
                  <Chip color="#FF4D4D">🔨 LELANG LIVE</Chip>
                  <span className="font-display text-sm uppercase">{TILES[state.auction.tile].name}</span>
                </div>
                <div className="money text-2xl font-bold">{rp(state.auction.bid)}</div>
                <div className="text-xs font-bold">
                  Pemimpin: {tvAuctionLeader?.name ?? "Belum ada"} · Penawar: {tvAuctionBidder?.name ?? "—"}
                </div>
              </div>
            ) : state.trade ? (
              <div className="panel space-y-1 bg-sky/25 p-3">
                <Chip color="#4CC9F0">🤝 NEGOSIASI DAGANG</Chip>
                <div className="text-xs font-bold">
                  {tvTradeFrom?.name} ⇄ {tvTradeTo?.name}
                </div>
                <div className="text-[11px] opacity-75">Menunggu respon {tvTradeTo?.name} dari HP…</div>
              </div>
            ) : state.offer && tvOfferTile ? (
              <div className="panel space-y-1 bg-mint/25 p-3">
                <div className="flex items-center justify-between">
                  <Chip color="#3DDC97">🏷️ TAWARAN BELI</Chip>
                  <span className="font-display text-sm uppercase">{tvOfferTile.name}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="money text-lg font-bold">{rp(state.offer.price)}</span>
                  <span className="text-xs font-bold opacity-70">Sewa {rp(state.offer.rent)}</span>
                </div>
                <div className="text-[11px] font-bold opacity-65">Menunggu keputusan {me?.name}…</div>
              </div>
            ) : null}

            <RentBreakdown state={state} />

            <div className="panel flex items-center gap-3 p-2.5">
              {joinBaseUrl ? <QrCode value={joinBaseUrl} size={96} /> : null}
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-bold uppercase tracking-widest opacity-60">Gabung / Reconnect HP</div>
                <div className="font-mono text-xl font-bold tracking-widest">{code}</div>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="mt-1 border-2 border-ink bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase"
                >
                  Perbesar QR
                </button>
              </div>
            </div>
          </aside>
        </div>

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
              act={() => {}}
              canAct={false}
              onClose={() => setPanel(null)}
            />
          ) : null}
        </Modal>
        <Modal open={qrModalOpen} onClose={() => setQrModalOpen(false)} title={`Sambungkan HP · Room ${code}`} width="max-w-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            {joinBaseUrl ? <QrCode value={joinBaseUrl} size={220} /> : null}
            <div className="border-[3px] border-ink bg-yellow px-4 py-1.5 font-mono text-2xl font-bold tracking-[0.25em]">
              {code}
            </div>
            <p className="break-all text-[11px] font-bold opacity-70">{joinBaseUrl}</p>
          </div>
        </Modal>
        {state.phase === "game_over" ? (
          <ResultDialog state={state} onRestart={() => router.push("/")} onExit={() => router.push("/")} />
        ) : null}
      </main>
    );
  }

  // Mobile / Online Controller View
  const myChar = myPlayer ? CHARACTERS.find((c) => c.id === myPlayer.character) : null;
  const needsMyBid = Boolean(myId && state.auction?.current === myId);
  const needsMyTradeResp = Boolean(myId && state.trade?.to === myId);
  const isMyAction = isMyTurn || needsMyBid || needsMyTradeResp;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2 p-2 md:p-3">
      <header className="flex flex-wrap items-center gap-1.5">
        <div className="font-display text-base uppercase leading-none tracking-tighter md:text-xl">
          Serenity<span className="bg-yellow px-1">Poly</span>
        </div>
        <Chip color="#FFD43B">
          R{state.round} · {WAVE_LABEL[state.wave]}
        </Chip>
        <Chip>Room {code}</Chip>
        {state.event ? <Chip color="#FF8A3D">{state.event.label}</Chip> : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {myPlayer ? (
            <Button
              variant={showBoardOnMobile ? "primary" : "default"}
              className="min-h-0 px-2 py-1 text-[11px]"
              onClick={() => setShowBoardOnMobile((v) => !v)}
            >
              {showBoardOnMobile ? "🎮 Kontroler" : "🗺️ Papan"}
            </Button>
          ) : null}
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={handleBgm} title="Musik latar">
            {bgm ? "🎵" : "🎶"}
          </Button>
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={toggleMute} title="Suara">
            {muted ? "🔇" : "🔊"}
          </Button>
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={() => setPanel("rules")}>
            📖
          </Button>
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={() => router.push("/")}>
            ✕
          </Button>
        </div>
      </header>

      {err ? (
        <div className="border-[3px] border-ink bg-red/20 px-2 py-1 text-[11px] font-bold uppercase">{err}</div>
      ) : null}

      {!myPlayer ? (
        <section className="mx-auto mt-4 w-full max-w-lg space-y-3">
          <div className="panel space-y-3 p-4">
            <h2 className="font-display text-xl uppercase leading-none">Klaim Kursi Kontroler</h2>
            <p className="text-xs font-bold opacity-70">
              Pilih namamu di bawah untuk menyambungkan HP ini sebagai kontroler, atau buka tampilan papan TV.
            </p>
            <div className="space-y-2">
              {state.players
                .filter((p) => !p.isBot)
                .map((p) => (
                  <button
                    key={p.id}
                    disabled={busy}
                    onClick={() => void reclaimSeat(p.id)}
                    className="flex w-full items-center gap-3 border-[3px] border-ink bg-surface p-3 text-left shadow-[3px_3px_0_#0A0A0A] hover:bg-yellow/40"
                    style={{ borderLeft: `8px solid ${p.color}` }}
                  >
                    <span className="text-2xl">{p.token}</span>
                    <div className="flex-1">
                      <div className="font-display text-sm uppercase">{p.name}</div>
                      <div className="money text-xs opacity-70">{rp(p.cash)}</div>
                    </div>
                    <Chip color="#3DDC97">Masuk →</Chip>
                  </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button onClick={() => router.push(`/watch/${code}`)}>📺 Layar Papan TV</Button>
              <Button variant="ghost" onClick={() => router.push("/")}>← Menu</Button>
            </div>
          </div>
          <Board state={state} selected={selectedTile} onSelect={() => {}} />
        </section>
      ) : showBoardOnMobile ? (
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
          </main>
          <aside className="flex w-full flex-col gap-2 lg:w-[320px] lg:shrink-0">
            <ActionPanel state={state} act={act} canAct={canAct} onOpen={setPanel} setSelectedTile={setSelectedTile} />
            <RentBreakdown state={state} />
          </aside>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2.5 pb-6">
          <div
            className={cn(
              "border-[3px] border-ink px-3 py-2 text-center font-display text-sm uppercase shadow-[4px_4px_0_#0A0A0A]",
              state.phase === "game_over"
                ? "bg-yellow"
                : isMyAction
                  ? "animate-[pulse-ring_1.8s_ease-out_infinite] bg-mint"
                  : "bg-muted",
            )}
          >
            {state.phase === "game_over"
              ? "🏆 Permainan Selesai"
              : needsMyBid
                ? "🔨 Giliranmu Menawar di Lelang!"
                : needsMyTradeResp
                  ? "🤝 Ada Tawaran Dagang untukmu!"
                  : isMyTurn
                    ? "🎲 GILIRANMU SEKARANG!"
                    : `⏳ Menunggu giliran ${me?.name ?? "…"}`}
          </div>

          <div className="panel p-3" style={{ borderTop: `10px solid ${myPlayer.color}` }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-[3px] border-ink text-2xl shadow-[2px_2px_0_#0A0A0A]"
                style={{ background: myPlayer.color }}
              >
                {myPlayer.token}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg uppercase leading-none">{myPlayer.name}</div>
                <div className="mt-0.5 text-[11px] font-bold uppercase opacity-70">
                  {myChar ? `${myChar.name} · ${myChar.perk}` : "Pemain"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-bold uppercase opacity-60">Cash Kamu</div>
                <div className="money text-xl font-bold text-[#0a7a4a]">{rp(myPlayer.cash)}</div>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
              <div className="border-2 border-ink bg-muted/60 px-1.5 py-1">
                <div className="text-[8px] font-bold uppercase opacity-60">Posisi</div>
                <div className="truncate text-[11px] font-bold">{TILES[myPlayer.position].short}</div>
              </div>
              <div className="border-2 border-ink bg-muted/60 px-1.5 py-1">
                <div className="text-[8px] font-bold uppercase opacity-60">Net Worth</div>
                <div className="money text-[11px] font-bold">{rp(netWorth(state, myPlayer))}</div>
              </div>
              <div className="border-2 border-ink bg-muted/60 px-1.5 py-1">
                <div className="text-[8px] font-bold uppercase opacity-60">Aset</div>
                <div className="text-[11px] font-bold">{myPlayer.properties.length} petak</div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {myPlayer.inJail ? <Chip color="#FF4D4D">🚔 Di Penjara ({myPlayer.jailTurns}/3)</Chip> : null}
              {myPlayer.jailCards > 0 ? <Chip color="#3DDC97">🎟️ Bebas Penjara ×{myPlayer.jailCards}</Chip> : null}
              {myPlayer.loans.length > 0 ? (
                <Chip color="#FF7AC6">
                  💳 Utang {rp(myPlayer.loans.reduce((a, l) => a + l.principal, 0))}
                </Chip>
              ) : null}
              {myPlayer.shares.length > 0 ? <Chip color="#4CC9F0">📈 {myPlayer.shares.length} Saham</Chip> : null}
              {myPlayer.missionDone ? <Chip color="#FFD43B">⭐ Misi Selesai</Chip> : null}
            </div>
          </div>

          {isMyTurn ? (
            <ActionPanel
              state={state}
              act={act}
              canAct={canAct}
              onOpen={setPanel}
              setSelectedTile={setSelectedTile}
            />
          ) : (
            <div className="panel space-y-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Info Giliran Aktif</span>
                {state.dice ? (
                  <Chip color="#FFD43B">
                    🎲 {state.dice[0]} + {state.dice[1]} = {state.dice[0] + state.dice[1]}
                  </Chip>
                ) : null}
              </div>
              <div className="text-xs font-bold">
                {me?.token} {me?.name} di <b>{me ? TILES[me.position].name : "—"}</b>
              </div>
              <div className="space-y-1 border-t-2 border-dashed border-ink/20 pt-2">
                {state.log.slice(-3).reverse().map((entry) => (
                  <div key={entry.id} className="text-[11px] leading-snug opacity-80">
                    <span className="mr-1 font-mono opacity-50">R{entry.round}</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={showPropsTab ? "primary" : "default"}
              className="text-xs"
              onClick={() => setShowPropsTab((v) => !v)}
            >
              🏠 Propertiku ({myPlayer.properties.length})
            </Button>
            <Button className="text-xs" onClick={() => setPanel("bank")}>
              🏦 Bank &amp; Saham
            </Button>
            {features(state).shop ? (
              <Button className="text-xs" onClick={() => setPanel("shop")}>
                🛒 Pasar Loak
              </Button>
            ) : null}
            <Button className="text-xs" disabled={!canAct} onClick={() => setPanel("trade")}>
              🤝 Dagang
            </Button>
            <Button className="text-xs" onClick={() => setPanel("mission")}>
              🎯 Misi Rahasia
            </Button>
            <Button className="text-xs" onClick={() => setShowBoardOnMobile(true)}>
              🗺️ Lihat Papan
            </Button>
          </div>

          {showPropsTab ? (
            <div className="panel space-y-2 p-3">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                Daftar Propertimu (Ketuk untuk bangun / gadai)
              </div>
              {myPlayer.properties.length === 0 ? (
                <p className="text-xs opacity-60">Belum punya properti.</p>
              ) : (
                <div className="grid gap-1.5">
                  {myPlayer.properties.map((id) => {
                    const t = TILES[id];
                    const st = state.tiles[id];
                    const mono = t.group ? groupComplete(state, t.group, myPlayer.id) : false;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedTile(id);
                          setPanel("property");
                        }}
                        className="flex items-center gap-2 border-[2px] border-ink bg-surface p-2 text-left hover:bg-yellow/25"
                      >
                        <span
                          className="h-6 w-3 shrink-0 border border-ink"
                          style={{ background: t.group ? GROUP_COLORS[t.group] : "#EFE9DA" }}
                        />
                        <span className="text-base">{t.icon}</span>
                        <span className="flex-1 truncate text-xs font-bold">
                          {t.name}
                          {mono ? " ★" : ""}
                        </span>
                        {st.houses > 0 ? (
                          <Chip color="#3DDC97">{st.houses === 5 ? "🏨" : `🏠×${st.houses}`}</Chip>
                        ) : null}
                        {st.mortgaged ? <Chip color="#FF4D4D">GADAI</Chip> : null}
                        <span className="text-[10px] font-bold uppercase opacity-60">Kelola →</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {isMyTurn && !myPlayer.bankrupt && state.phase !== "game_over" ? (
            <div className="pt-2">
              {!confirmSurrender ? (
                <Button
                  variant="ghost"
                  className="w-full text-[11px] text-red"
                  onClick={() => setConfirmSurrender(true)}
                >
                  🏳️ Menyerah
                </Button>
              ) : (
                <div className="flex gap-2 border-[2px] border-ink bg-red/15 p-2">
                  <Button
                    variant="danger"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setConfirmSurrender(false);
                      void act({ type: "SURRENDER" });
                    }}
                  >
                    Ya, Menyerah
                  </Button>
                  <Button className="flex-1 text-xs" onClick={() => setConfirmSurrender(false)}>
                    Batal
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {state.auction ? <AuctionDialog state={state} act={act} viewerId={myId} /> : null}
      <TradeDialog state={state} act={act} open={panel === "trade"} onClose={() => setPanel(null)} viewerId={myId} />
      <ShopDialog state={state} act={act} open={panel === "shop"} onClose={() => setPanel(null)} viewerId={myId} canAct={canAct} />
      <BankDialog state={state} act={act} open={panel === "bank"} onClose={() => setPanel(null)} viewerId={myId} canAct={canAct} />
      <MissionDialog state={state} open={panel === "mission"} onClose={() => setPanel(null)} viewerId={myId} />
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
            viewerId={myId}
            canAct={canAct}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </Modal>
      {state.phase === "game_over" ? (
        <ResultDialog state={state} onRestart={() => router.push("/")} onExit={() => router.push("/")} />
      ) : null}
    </div>
  );
}

function WaitRoom({
  code,
  room,
  origin,
  lanIp,
  tv,
  identity,
  onRoomUpdate,
  onStartGame,
  onBack,
}: {
  code: string;
  room: PublicRoom | null;
  origin: string;
  lanIp: string | null;
  tv: boolean;
  identity: Identity | null;
  onRoomUpdate: (r: PublicRoom) => void;
  onStartGame: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  const [useLan, setUseLan] = useState(true);
  const [customUrl, setCustomUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isLocalhost = useMemo(() => {
    if (!origin) return false;
    try {
      const u = new URL(origin);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }, [origin]);

  const computedUrl = useMemo(() => {
    if (customUrl.trim()) return customUrl.trim();
    if (!origin) return "";
    if (isLocalhost && lanIp && useLan) {
      try {
        const u = new URL(origin);
        const port = u.port ? `:${u.port}` : "";
        return `${u.protocol}//${lanIp}${port}/room/${code}`;
      } catch {
        /* ignore */
      }
    }
    return `${origin}/room/${code}`;
  }, [customUrl, origin, isLocalhost, lanIp, useLan, code]);

  const seats = room?.seats ?? [];
  const allReady = seats.length >= 2 && seats.every((s) => s.ready);
  const hasBot = seats.some((s) => s.isBot);
  const me = seats.find((s) => s.id === identity?.playerId);
  const canManage = tv || Boolean(me?.isHost);

  const botSeat = async (payload: { addBot?: boolean; removeBot?: boolean }) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal ubah bot");
      onRoomUpdate(data.room as PublicRoom);
      sfx.click();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal ubah bot");
    } finally {
      setBusy(false);
    }
  };

  const startFromWait = async () => {
    setBusy(true);
    setErr("");
    try {
      const hostToken = tv ? localStorage.getItem(`sp-host-${code}`) ?? undefined : undefined;
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(identity ?? {}),
          hostToken,
          fromTv: tv,
          forceReady: !allReady,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai permainan");
      sfx.turn();
      onStartGame();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal memulai permainan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={cn("mx-auto flex min-h-dvh w-full flex-col items-center justify-center gap-4 p-4", tv ? "max-w-4xl" : "max-w-xl")}>
      <div className="text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-60">
          {tv ? "Papan Tunggu · TV / Laptop" : "Menunggu Game Dimulai"}
        </div>
        <div className="mt-1 font-display text-5xl uppercase leading-none tracking-wider">
          Kode <span className="border-[3px] border-ink bg-yellow px-3 py-0.5 shadow-[4px_4px_0_#0A0A0A]">{code}</span>
        </div>
      </div>

      {err ? (
        <div className="w-full max-w-2xl border-[3px] border-ink bg-red/20 p-2 text-center text-xs font-bold uppercase">
          {err}
        </div>
      ) : null}

      <div className="grid w-full gap-4 md:grid-cols-[auto_1fr]">
        <div className="panel flex flex-col items-center gap-2 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Scan QR dari HP</div>
          {computedUrl ? <QrCode value={computedUrl} size={tv ? 230 : 190} /> : null}
          {isLocalhost && lanIp ? (
            <button
              type="button"
              onClick={() => setUseLan((v) => !v)}
              className="border-2 border-ink bg-muted px-2 py-1 text-[10px] font-bold uppercase"
            >
              {useLan ? `Wi-Fi LAN: ${lanIp}` : "Mode Localhost"} (Ganti)
            </button>
          ) : null}
          <div className="flex w-full max-w-[250px] gap-1">
            <input
              className="field min-h-0 flex-1 px-2 py-1 text-[10px]"
              placeholder="URL kustom (opsional)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <Button
              className="min-h-0 px-2 py-1 text-[10px]"
              onClick={async () => {
                await navigator.clipboard?.writeText(computedUrl);
                setCopied(true);
                sfx.click();
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "✓" : "Salin"}
            </Button>
          </div>
          <div className="max-w-[250px] break-all text-center text-[10px] font-bold opacity-60">{computedUrl}</div>
        </div>

        <div className="panel flex flex-col justify-between gap-3 p-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl uppercase">Kursi Pemain ({seats.length}/4)</h2>
              {canManage ? (
                <div className="flex gap-1.5">
                  <Button
                    className="min-h-0 px-2.5 py-1 text-xs"
                    disabled={busy || seats.length >= 4}
                    onClick={() => void botSeat({ addBot: true })}
                  >
                    + Tambah Bot
                  </Button>
                  {hasBot ? (
                    <Button
                      className="min-h-0 px-2.5 py-1 text-xs"
                      disabled={busy}
                      onClick={() => void botSeat({ removeBot: true })}
                    >
                      − Hapus Bot
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {[0, 1, 2, 3].map((i) => {
                const s = seats[i];
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 border-[3px] border-ink p-2.5",
                      s ? "bg-surface" : "border-dashed bg-muted/40",
                    )}
                    style={s ? { borderLeft: `8px solid ${PLAYER_COLORS[i]}` } : undefined}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-base"
                      style={{ background: s ? PLAYER_COLORS[i] : "#EFE9DA" }}
                    >
                      {s ? TOKENS[i] : i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-bold">
                      {s ? s.name : "Scan QR atau masukkan kode di HP…"}
                    </span>
                    {s?.isHost ? <Chip color="#FFD43B">HOST</Chip> : null}
                    {s?.isBot ? <Chip color="#9B7BFF">BOT</Chip> : null}
                    {s ? <Chip color={s.ready ? "#3DDC97" : "#EFE9DA"}>{s.ready ? "SIAP ✓" : "BELUM"}</Chip> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t-[3px] border-ink pt-3">
            {canManage ? (
              <Button
                variant="primary"
                className="w-full text-base"
                disabled={busy || seats.length < 2}
                onClick={() => void startFromWait()}
              >
                {seats.length < 2
                  ? "Menunggu minimal 2 pemain…"
                  : allReady
                    ? "▶ Mulai Permainan Sekarang!"
                    : "▶ Mulai Permainan (Siapkan Semua)"}
              </Button>
            ) : !identity ? (
              <Button variant="primary" className="w-full" onClick={() => router.push(`/room/${code}`)}>
                📱 Masuk Lobi &amp; Gabung Kursi
              </Button>
            ) : (
              <div className="border-[2px] border-ink bg-muted p-2 text-center text-xs font-bold uppercase">
                Menunggu Host / Layar TV memulai game…
              </div>
            )}
            <p className="text-center text-[10px] font-bold uppercase opacity-60">
              Buka website ini di HP lalu masukkan kode <b>{code}</b> atau scan QR di samping.
            </p>
          </div>
        </div>
      </div>

      <Button variant="ghost" className="text-xs" onClick={onBack}>
        ← Kembali ke Menu
      </Button>
    </main>
  );
}
