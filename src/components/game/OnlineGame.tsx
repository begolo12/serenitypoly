"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Action, GameState } from "@/engine/types";
import { current, features, groupComplete, living, netWorth, ownedGroupCount, playerOf } from "@/engine/actions";
import { CHARACTERS, GROUP_COLORS, PLAYER_COLORS, TILES, WAVE_LABEL } from "@/engine/data";
import { Board } from "@/components/game/Board";
import { PawnAvatar, TileArtwork } from "@/components/game/CityArt";
import {
  AudioMixerButton,
  CardRevealOverlay,
  ConfettiBurst,
  EventBreakingBanner,
  ReactionOverlay,
} from "@/components/game/GameFx";
import { PlayerRail, PropertySheet, RentBreakdown, useCashDeltas } from "@/components/game/Panels";
import {
  AuctionDialog,
  BankDialog,
  MissionDialog,
  PlayerDetailDialog,
  PortfolioDialog,
  ResultDialog,
  RulesDialog,
  ShopDialog,
  TradeDialog,
} from "@/components/game/Dialogs";
import { ActionPanel, type PanelKind } from "@/components/game/GameScreen";
import { QrCode } from "@/components/game/QrCode";
import { Button, Chip, Modal, Tooltip } from "@/components/ui/kit";
import { cn, rp } from "@/lib/format";
import type { PublicRoom } from "@/lib/online";
import { initMute, sfx, stopBgm } from "@/lib/sfx";

type Identity = { playerId: string; token: string };

const REACTION_EMOJIS = ["❤️", "🔥", "👏", "😱", "🤣", "💸"] as const;

function handleTransitionFx(
  prev: GameState | null,
  next: GameState,
  onConfetti: (key: string) => void,
) {
  if (!prev) {
    sfx.turn();
    return;
  }
  const hitJackpot =
    Boolean(prev.settings.freeParkingPot) &&
    (prev.freeParkingPot ?? 0) > 0 &&
    (next.freeParkingPot ?? 0) === 0;
  const newMono = next.players.some(
    (pl) => !pl.bankrupt && ownedGroupCount(next, pl.id) > ownedGroupCount(prev, pl.id),
  );
  const isCounter = Boolean(prev.trade && next.trade && next.trade.from === prev.trade.to);

  if (next.phase === "game_over" && prev.phase !== "game_over") {
    sfx.win();
    onConfetti(`win-${next.version}`);
    return;
  }
  if (hitJackpot) {
    sfx.jackpot();
    onConfetti(`pot-${next.version}`);
    return;
  }
  if (newMono) {
    sfx.monopoly();
    onConfetti(`mono-${next.version}`);
    return;
  }
  if (isCounter) {
    sfx.counterOffer();
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
  const [confettiKey, setConfettiKey] = useState<string | null>(null);
  const [connRetry, setConnRetry] = useState(false);
  const [reactCoolUntil, setReactCoolUntil] = useState(0);
  const [showBoardOnMobile, setShowBoardOnMobile] = useState(false);
  const [showPropsTab, setShowPropsTab] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [busy, setBusy] = useState(false);
  const deltas = useCashDeltas(state);

  const versionRef = useRef(0);
  const prevSeatsRef = useRef<number | null>(null);
  const botBusyRef = useRef(false);
  const prevMyTurnRef = useRef(false);
  const pollFastRef = useRef(false);
  const failCountRef = useRef(0);

  useEffect(() => {
    const fast = Boolean(
      state &&
        state.phase !== "game_over" &&
        (state.auction ||
          state.trade ||
          (identity?.playerId && current(state)?.id === identity.playerId)),
    );
    pollFastRef.current = fast;
  }, [state, identity?.playerId]);

  useEffect(() => {
    initMute();
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
          failCountRef.current = 0;
          if (alive) setConnRetry(false);
          const data = await res.json();
          if (alive && data.state) {
            const nextState = data.state as GameState;
            if (data.version !== versionRef.current) {
              handleTransitionFx(stateRef.current, nextState, setConfettiKey);
              versionRef.current = data.version;
              stateRef.current = nextState;
              setState(nextState);
            }
          }
        } else if (res.status >= 500) {
          failCountRef.current += 1;
          if (alive && failCountRef.current >= 2) setConnRetry(true);
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
        failCountRef.current += 1;
        if (alive && failCountRef.current >= 2) setConnRetry(true);
      }
      if (alive) {
        const waitMs =
          typeof document !== "undefined" && document.hidden
            ? 3000
            : failCountRef.current > 0
              ? Math.min(4000, 1100 * (failCountRef.current + 1))
              : pollFastRef.current
                ? 750
                : 1350;
        timer = window.setTimeout(tick, waitMs);
      }
    };

    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code]);

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
          handleTransitionFx(stateRef.current, data.state as GameState, setConfettiKey);
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
          handleTransitionFx(stateRef.current, data.state as GameState, setConfettiKey);
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

  const sendReaction = async (emoji: string) => {
    if (!identity || Date.now() < reactCoolUntil) return;
    setReactCoolUntil(Date.now() + 1500);
    window.setTimeout(() => setReactCoolUntil(0), 1520);
    sfx.click();
    try {
      const res = await fetch(`/api/games/${code}/react`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identity, emoji }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && stateRef.current && data.reactions) {
        const updated = { ...stateRef.current, reactions: data.reactions };
        versionRef.current = data.version ?? versionRef.current;
        stateRef.current = updated;
        setState(updated);
      }
    } catch {
      /* ignore */
    }
  };

  const rematch = async () => {
    setBusy(true);
    setErr("");
    try {
      const hostToken = localStorage.getItem(`sp-host-${code}`) ?? undefined;
      const res = await fetch(`/api/rooms/${code}/rematch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(identity ?? {}),
          hostToken,
          fromTv: tv,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai ulang");
      if (data.state) {
        versionRef.current = data.version;
        stateRef.current = data.state as GameState;
        setState(data.state as GameState);
        sfx.turn();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hanya host / TV yang dapat memulai ulang");
    } finally {
      setBusy(false);
    }
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
        onStartGame={() => {}}
        onBack={() => router.push("/")}
      />
    );
  }

  const me = current(state);
  const myId = identity?.playerId ?? null;
  const myPlayer = myId ? playerOf(state, myId) : null;
  const isMyTurn = Boolean(myId && me?.id === myId);
  const canAct = isMyTurn && !state.trade && state.phase !== "auction" && state.phase !== "game_over";
  const waveText = WAVE_LABEL[state.wave].charAt(0) + WAVE_LABEL[state.wave].slice(1).toLowerCase();

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
    const cardPlayer = state.lastCard ? playerOf(state, state.lastCard.playerId) : null;

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-3 px-3 py-2.5 md:px-5">
        <ConfettiBurst triggerKey={confettiKey} />
        <CardRevealOverlay
          card={state.lastCard}
          playerName={cardPlayer?.name}
          playerColor={cardPlayer?.color}
          round={state.round}
        />
        <EventBreakingBanner event={state.event} round={state.round} />
        <ReactionOverlay reactions={state.reactions} />
        <header className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-ink bg-sun text-sm">
              🎲
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight md:text-2xl">
              Serenity<span className="text-tomato">Poly</span>
            </span>
          </div>
          <Chip color="#FFD23F">
            Ronde {state.round}/{state.settings.maxRounds} · {waveText}
          </Chip>
          <Chip color="#DFE6FF">Kode {code}</Chip>
          <Chip color={connRetry ? "#FFE4DD" : "#D5F7E8"}>
            {connRetry ? "🟡 Menyambung…" : "🟢 Live"}
          </Chip>
          <Chip color={me?.color}>{me?.name} · Giliran</Chip>
          {state.event ? <Chip color="#FFE4DD">⚡ {state.event.label}</Chip> : null}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button className="min-h-0 px-3 py-1.5 text-xs" onClick={() => setQrModalOpen(true)}>
              📱 QR &amp; Kode
            </Button>
            <AudioMixerButton />
            <Button variant="ghost" className="min-h-0 px-2.5 py-1.5 text-xs" onClick={toggleFullscreen} title="Layar Penuh">
              ⛶
            </Button>
            <Button variant="ghost" className="min-h-0 px-3 py-1.5 text-xs" onClick={() => router.push("/")}>
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

          <aside className="flex w-full flex-col gap-3 lg:w-[320px] lg:shrink-0">
            <div className="panel relative p-4">
              {me && deltas[me.id] ? (
                <span
                  key={deltas[me.id].seq}
                  className={cn(
                    "pointer-events-none absolute -top-3 right-4 z-20 rounded-full border-2 border-ink px-2.5 py-0.5 font-mono text-xs font-extrabold animate-[float-delta_1.35s_ease-out_forwards]",
                    deltas[me.id].amount > 0 ? "bg-mint text-ink" : "bg-tomato text-white",
                  )}
                >
                  {deltas[me.id].amount > 0 ? `+${rp(deltas[me.id].amount)}` : `−${rp(Math.abs(deltas[me.id].amount))}`}
                </span>
              ) : null}
              <div className="text-xs font-bold text-ink-soft">Sekarang bermain</div>
              <div className="mt-2 flex items-center gap-3">
                <PawnAvatar index={me?.tokenIndex ?? state.turnIndex} color={me?.color ?? "#FFD23F"} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xl font-extrabold leading-tight">{me?.name}</div>
                  <Tooltip tip={meChar ? `+ ${meChar.perk} · − ${meChar.flaw}` : undefined} position="bottom">
                    <div className="cursor-help text-xs font-semibold text-ink-soft underline decoration-dotted underline-offset-2">
                      {me?.isBot ? "Bot AI" : "Kontroler HP"} · {meChar?.name}
                    </div>
                  </Tooltip>
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between rounded-2xl border-2 border-ink bg-tint px-3 py-2">
                <span className="text-xs font-semibold text-ink-soft">Cash</span>
                <span className="money text-xl font-extrabold text-[#0e8a5a]">{rp(me?.cash ?? 0)}</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-ink-soft">Posisi saat ini</span>
                <span className="font-bold">{me ? TILES[me.position].name : "—"}</span>
              </div>
              {me?.inJail ? (
                <div className="mt-2 rounded-2xl border-2 border-ink bg-tomato-pale px-3 py-1.5 text-xs font-bold">
                  🚔 Di Penjara ({me.jailTurns}/3)
                </div>
              ) : null}
            </div>

            {state.auction ? (
              <div className="panel space-y-2 bg-sun-pale p-4">
                <div className="flex items-center justify-between">
                  <Chip color="#FF5A3C">🔨 Lelang Live</Chip>
                  <span className="font-display text-sm font-extrabold">{TILES[state.auction.tile].name}</span>
                </div>
                <div className="money text-2xl font-extrabold">{rp(state.auction.bid)}</div>
                <div className="text-xs font-semibold text-ink-soft">
                  Pemimpin: <b className="text-ink">{tvAuctionLeader?.name ?? "Belum ada"}</b> · Penawar:{" "}
                  <b className="text-ink">{tvAuctionBidder?.name ?? "—"}</b>
                </div>
              </div>
            ) : state.trade ? (
              <div className="panel space-y-1.5 bg-blue-pale p-4">
                <Chip color="#2F5BFF">🤝 Negosiasi Dagang</Chip>
                <div className="text-sm font-bold">
                  {tvTradeFrom?.name} ⇄ {tvTradeTo?.name}
                </div>
                <div className="text-xs font-medium text-ink-soft">Menunggu respon {tvTradeTo?.name} dari HP…</div>
              </div>
            ) : state.offer && tvOfferTile ? (
              <div className="panel space-y-2 bg-mint-pale p-4">
                <div className="flex items-center justify-between">
                  <Chip color="#2FD592">🏷️ Tawaran Beli</Chip>
                  <span className="font-display text-sm font-extrabold">{tvOfferTile.name}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="money text-lg font-extrabold">{rp(state.offer.price)}</span>
                  <span className="text-xs font-semibold text-ink-soft">Sewa {rp(state.offer.rent)}</span>
                </div>
                <div className="text-xs font-medium text-ink-soft">Menunggu keputusan {me?.name}…</div>
              </div>
            ) : null}

            <RentBreakdown state={state} />

            <div className="panel flex items-center gap-3 bg-tint p-3">
              {joinBaseUrl ? <QrCode value={joinBaseUrl} size={96} /> : null}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-ink-soft">Gabung / Reconnect HP</div>
                <div className="font-mono text-xl font-extrabold tracking-widest">{code}</div>
                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="mt-1.5 rounded-full border-2 border-ink bg-sun px-3 py-1 text-[11px] font-bold"
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
              onSelectTile={(id) => setSelectedTile(id)}
              onClose={() => setPanel(null)}
            />
          ) : null}
        </Modal>
        <Modal open={qrModalOpen} onClose={() => setQrModalOpen(false)} title={`Sambungkan HP · Room ${code}`} width="max-w-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            {joinBaseUrl ? <QrCode value={joinBaseUrl} size={220} /> : null}
            <div className="rounded-2xl border-[2.5px] border-ink bg-sun px-4 py-1.5 font-mono text-2xl font-extrabold tracking-[0.25em]">
              {code}
            </div>
            <p className="break-all text-xs font-medium text-ink-soft">{joinBaseUrl}</p>
          </div>
        </Modal>
        {state.phase === "game_over" ? (
          <ResultDialog state={state} onRestart={() => void rematch()} onExit={() => router.push("/")} />
        ) : null}
      </main>
    );
  }

  // Mobile / Online Controller View
  const myChar = myPlayer ? CHARACTERS.find((c) => c.id === myPlayer.character) : null;
  const needsMyBid = Boolean(myId && state.auction?.current === myId);
  const needsMyTradeResp = Boolean(myId && state.trade?.to === myId);
  const isMyAction = isMyTurn || needsMyBid || needsMyTradeResp;
  const canRollOnBoard = Boolean(canAct && (state.phase === "await_roll" || state.phase === "jail") && !state.offer);
  const cardPlayer = state.lastCard ? playerOf(state, state.lastCard.playerId) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2.5 px-3 py-2.5 md:px-5">
      <ConfettiBurst triggerKey={confettiKey} />
      <CardRevealOverlay
        card={state.lastCard}
        playerName={cardPlayer?.name}
        playerColor={cardPlayer?.color}
        round={state.round}
      />
      <EventBreakingBanner event={state.event} round={state.round} />
      <ReactionOverlay reactions={state.reactions} />
      <header className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-sun text-xs">
            🎲
          </span>
          <span className="hidden font-display text-base font-extrabold tracking-tight sm:inline md:text-xl">
            Serenity<span className="text-tomato">Poly</span>
          </span>
          <Chip color="#FFD23F" className="text-[11px]">
            R{state.round}
          </Chip>
          <Chip color="#DFE6FF" className="hidden sm:inline-flex">
            {waveText} · {code}
          </Chip>
          <Chip color={connRetry ? "#FFE4DD" : "#D5F7E8"} className="text-[11px]">
            {connRetry ? "🟡 Retry" : "🟢 Live"}
          </Chip>
          {state.event ? <Chip color="#FFE4DD" className="hidden sm:inline-flex">⚡ {state.event.label}</Chip> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {myPlayer ? (
            <Button
              variant={showBoardOnMobile ? "sun" : "default"}
              className="min-h-0 px-2.5 py-1 text-xs"
              onClick={() => setShowBoardOnMobile((v) => !v)}
            >
              {showBoardOnMobile ? "🎮 Kontroler" : "🗺️ Papan"}
            </Button>
          ) : null}
          <AudioMixerButton />
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={() => setPanel("rules")}>
            📖
          </Button>
          <Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" onClick={() => router.push("/")}>
            ✕
          </Button>
        </div>
      </header>

      {err ? (
        <div className="rounded-2xl border-[2.5px] border-ink bg-tomato-pale px-3 py-2 text-xs font-bold">
          ⚠️ {err}
        </div>
      ) : null}

      {!myPlayer ? (
        <section className="mx-auto mt-3 w-full max-w-lg space-y-4">
          <div className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl font-extrabold leading-tight">Klaim Kursi Kontroler</h2>
            <p className="text-xs font-medium text-ink-soft">
              Pilih namamu di bawah untuk menyambungkan HP ini sebagai kontroler, atau buka layar papan TV.
            </p>
            <div className="space-y-2">
              {state.players
                .filter((p) => !p.isBot)
                .map((p) => {
                  const seatIdx = Math.max(0, state.players.findIndex((x) => x.id === p.id));
                  return (
                    <button
                      key={p.id}
                      disabled={busy}
                      onClick={() => void reclaimSeat(p.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border-[2.5px] border-ink bg-white p-3 text-left transition-colors hover:bg-sun-pale"
                    >
                      <PawnAvatar index={p.tokenIndex ?? seatIdx} color={p.color} size={42} />
                      <div className="flex-1">
                        <div className="font-display text-sm font-extrabold">{p.name}</div>
                        <div className="money text-xs text-ink-soft">{rp(p.cash)}</div>
                      </div>
                      <Chip color="#2FD592">Masuk →</Chip>
                    </button>
                  );
                })}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button onClick={() => router.push(`/watch/${code}`)}>📺 Layar Papan TV</Button>
              <Button variant="ghost" onClick={() => router.push("/")}>← Menu</Button>
            </div>
          </div>
          <Board state={state} selected={selectedTile} onSelect={() => {}} />
        </section>
      ) : showBoardOnMobile ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <aside className="lg:w-[228px] lg:shrink-0">
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
          <aside className="flex w-full flex-col gap-3 lg:w-[320px] lg:shrink-0">
            <ActionPanel state={state} act={act} canAct={canAct} onOpen={setPanel} setSelectedTile={setSelectedTile} />
            <RentBreakdown state={state} />
          </aside>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 pb-6">
          <div
            className={cn(
              "rounded-full border-[3px] border-ink px-4 py-2.5 text-center font-display text-sm font-extrabold",
              state.phase === "game_over"
                ? "bg-sun"
                : isMyAction
                  ? "animate-[pulse-mint_1.8s_ease-out_infinite] bg-mint"
                  : "bg-tint text-ink-soft",
            )}
          >
            {state.phase === "game_over"
              ? "🏆 Permainan selesai"
              : needsMyBid
                ? "🔨 Giliranmu menawar di lelang!"
                : needsMyTradeResp
                  ? "🤝 Ada tawaran dagang untukmu!"
                  : isMyTurn
                    ? "🎲 Giliranmu sekarang!"
                    : `⏳ Menunggu giliran ${me?.name ?? "…"}`}
          </div>

          <div className="panel relative p-4">
            {deltas[myPlayer.id] ? (
              <span
                key={deltas[myPlayer.id].seq}
                className={cn(
                  "pointer-events-none absolute -top-3 right-4 z-20 rounded-full border-2 border-ink px-2.5 py-0.5 font-mono text-xs font-extrabold animate-[float-delta_1.35s_ease-out_forwards]",
                  deltas[myPlayer.id].amount > 0 ? "bg-mint text-ink" : "bg-tomato text-white",
                )}
              >
                {deltas[myPlayer.id].amount > 0
                  ? `+${rp(deltas[myPlayer.id].amount)}`
                  : `−${rp(Math.abs(deltas[myPlayer.id].amount))}`}
              </span>
            ) : null}
            <div className="flex items-center gap-3">
              <PawnAvatar
                index={myPlayer.tokenIndex ?? Math.max(0, state.players.findIndex((x) => x.id === myPlayer.id))}
                color={myPlayer.color}
                size={48}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-extrabold leading-tight">{myPlayer.name}</div>
                <Tooltip tip={myChar ? `+ ${myChar.perk} · − ${myChar.flaw}` : undefined} position="bottom">
                  <div className="cursor-help text-xs font-semibold text-ink-soft underline decoration-dotted underline-offset-2">
                    {myChar ? `${myChar.name} · ${myChar.perk}` : "Pemain"}
                  </div>
                </Tooltip>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold text-ink-soft">Cash kamu</div>
                <div className="money text-xl font-extrabold text-[#0e8a5a]">{rp(myPlayer.cash)}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border-2 border-ink bg-tint px-2 py-1.5">
                <div className="text-[10px] font-semibold text-ink-soft">Posisi</div>
                <div className="truncate text-xs font-bold">{TILES[myPlayer.position].short}</div>
              </div>
              <div className="rounded-2xl border-2 border-ink bg-tint px-2 py-1.5">
                <div className="text-[10px] font-semibold text-ink-soft">Net worth</div>
                <div className="money text-xs font-bold">{rp(netWorth(state, myPlayer))}</div>
              </div>
              <div className="rounded-2xl border-2 border-ink bg-tint px-2 py-1.5">
                <div className="text-[10px] font-semibold text-ink-soft">Aset</div>
                <div className="text-xs font-bold">{myPlayer.properties.length} petak</div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {myPlayer.inJail ? <Chip color="#FF5A3C">🚔 Di Penjara ({myPlayer.jailTurns}/3)</Chip> : null}
              {myPlayer.jailCards > 0 ? <Chip color="#2FD592">🎟️ Bebas Penjara ×{myPlayer.jailCards}</Chip> : null}
              {myPlayer.loans.length > 0 ? (
                <Chip color="#FFE4DD">
                  💳 Utang {rp(myPlayer.loans.reduce((a, l) => a + l.principal, 0))}
                </Chip>
              ) : null}
              {myPlayer.shares.length > 0 ? <Chip color="#DFE6FF">📈 {myPlayer.shares.length} Saham</Chip> : null}
              {myPlayer.missionDone ? <Chip color="#FFD23F">⭐ Misi Selesai</Chip> : null}
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
            <div className="panel space-y-2.5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-soft">Info giliran aktif</span>
                {state.dice ? (
                  <Chip color="#FFD23F">
                    🎲 {state.dice[0]} + {state.dice[1]} = {state.dice[0] + state.dice[1]}
                  </Chip>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border-2 border-ink bg-tint p-2.5">
                <div className="h-9 w-9 shrink-0">
                  <TileArtwork tileId={me?.position ?? 0} />
                </div>
                <div className="text-xs font-bold">
                  {me?.token} {me?.name} sedang di <b>{me ? TILES[me.position].name : "—"}</b>
                </div>
              </div>
              <div className="space-y-1 divide-y divide-divider">
                {state.log.slice(-3).reverse().map((entry) => (
                  <div key={entry.id} className="pt-1 text-xs text-ink-soft">
                    <span className="mr-1.5 font-mono font-bold text-ink">R{entry.round}</span>
                    {entry.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-2xl border-[2.5px] border-ink bg-white px-2.5 py-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.8px] text-ink-soft">Reaksi</span>
            <div className="grid flex-1 grid-cols-6 gap-1">
              {REACTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  disabled={reactCoolUntil > 0}
                  onClick={() => void sendReaction(em)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-full border-2 border-ink bg-tint text-sm transition active:scale-90",
                    reactCoolUntil > 0 ? "opacity-45" : "hover:bg-sun-pale",
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={showPropsTab ? "sun" : "default"}
              className="text-xs"
              onClick={() => setShowPropsTab((v) => !v)}
            >
              🏠 Propertiku ({myPlayer.properties.length})
            </Button>
            <Button className="text-xs" onClick={() => setPanel("portfolio")}>
              🏘️ Bangun / Gadai
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
            <div className="panel space-y-2.5 p-4">
              <div className="text-xs font-bold text-ink-soft">
                Daftar propertimu (ketuk untuk bangun atau gadai)
              </div>
              {myPlayer.properties.length === 0 ? (
                <p className="text-xs text-ink-soft">Belum memiliki properti.</p>
              ) : (
                <div className="grid gap-2">
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
                        className="flex items-center gap-2.5 rounded-2xl border-[2px] border-ink bg-white p-2.5 text-left transition-colors hover:bg-sun-pale"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink p-1"
                          style={{ background: t.group ? GROUP_COLORS[t.group] : "#DFE6FF" }}
                        >
                          <TileArtwork tileId={id} />
                        </div>
                        <span className="flex-1 truncate text-xs font-bold">
                          {t.name}
                          {mono ? " ★" : ""}
                        </span>
                        {st.houses > 0 ? (
                          <Chip color="#2FD592">{st.houses === 5 ? "★ Hotel" : `🏠×${st.houses}`}</Chip>
                        ) : null}
                        {st.mortgaged ? <Chip color="#FF5A3C">Gadai</Chip> : null}
                        <span className="text-xs font-bold text-blue">Kelola →</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {isMyTurn && !myPlayer.bankrupt && state.phase !== "game_over" ? (
            <div className="pt-1">
              {!confirmSurrender ? (
                <Button
                  variant="ghost"
                  className="w-full text-xs text-tomato"
                  onClick={() => setConfirmSurrender(true)}
                >
                  🏳️ Menyerah
                </Button>
              ) : (
                <div className="flex gap-2 rounded-2xl border-2 border-ink bg-tomato-pale p-2.5">
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

      {state.auction ? (
        <AuctionDialog
          state={state}
          act={act}
          viewerId={myId}
          onFocusTile={(id) => {
            setSelectedTile(id);
            setShowBoardOnMobile(true);
          }}
        />
      ) : null}
      <TradeDialog
        state={state}
        act={act}
        open={panel === "trade"}
        onClose={() => setPanel(null)}
        viewerId={myId}
        onFocusTile={(id) => {
          setSelectedTile(id);
          setShowBoardOnMobile(true);
        }}
      />
      <PortfolioDialog
        state={state}
        act={act}
        open={panel === "portfolio"}
        onClose={() => setPanel(null)}
        viewerId={myId}
        canAct={canAct}
        onOpenBank={() => setPanel("bank")}
      />
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
            onSelectTile={(id) => setSelectedTile(id)}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </Modal>
      {state.phase === "game_over" ? (
        <ResultDialog state={state} onRestart={() => void rematch()} onExit={() => router.push("/")} />
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
    <main className={cn("mx-auto flex min-h-dvh w-full flex-col items-center justify-center gap-5 px-4 py-6", tv ? "max-w-4xl" : "max-w-xl")}>
      <div className="text-center">
        <span className="sticker -rotate-2 bg-sun text-xs">
          {tv ? "Papan Tunggu · TV / Laptop" : "Menunggu Game Dimulai"}
        </span>
        <div className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Kode Room{" "}
          <span className="inline-block rounded-2xl border-[3px] border-ink bg-sun px-4 py-1 font-mono tracking-[0.2em]">
            {code}
          </span>
        </div>
      </div>

      {err ? (
        <div className="w-full max-w-2xl rounded-2xl border-[2.5px] border-ink bg-tomato-pale p-3 text-center text-xs font-bold">
          ⚠️ {err}
        </div>
      ) : null}

      <div className="grid w-full gap-5 md:grid-cols-[auto_1fr]">
        <div className="panel flex flex-col items-center gap-3 bg-tint p-5">
          <div className="text-xs font-bold uppercase tracking-[1px] text-ink-soft">Scan QR dari HP</div>
          {computedUrl ? <QrCode value={computedUrl} size={tv ? 225 : 190} /> : null}
          {isLocalhost && lanIp ? (
            <button
              type="button"
              onClick={() => setUseLan((v) => !v)}
              className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[11px] font-bold"
            >
              {useLan ? `Wi-Fi LAN: ${lanIp}` : "Mode Localhost"} (Ganti)
            </button>
          ) : null}
          <div className="flex w-full max-w-[250px] gap-1.5">
            <input
              className="field min-h-0 flex-1 px-3 py-1.5 text-[11px]"
              placeholder="URL kustom (opsional)"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <Button
              className="min-h-0 px-3 py-1.5 text-[11px]"
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
          <div className="max-w-[250px] break-all text-center text-[11px] font-medium text-ink-soft">{computedUrl}</div>
        </div>

        <div className="panel flex flex-col justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-extrabold">Kursi Pemain ({seats.length}/4)</h2>
              {canManage ? (
                <div className="flex gap-1.5">
                  <Button
                    className="min-h-0 px-3 py-1.5 text-xs"
                    disabled={busy || seats.length >= 4}
                    onClick={() => void botSeat({ addBot: true })}
                  >
                    + Tambah Bot
                  </Button>
                  {hasBot ? (
                    <Button
                      className="min-h-0 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void botSeat({ removeBot: true })}
                    >
                      − Hapus Bot
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-3 space-y-2.5">
              {[0, 1, 2, 3].map((i) => {
                const s = seats[i];
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border-[2.5px] border-ink p-2.5",
                      s ? "bg-white" : "border-dashed bg-tint/60",
                    )}
                  >
                    {s ? (
                      <PawnAvatar index={s.tokenIndex ?? i} color={PLAYER_COLORS[i]} size={34} />
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink text-base font-bold"
                        style={{ background: "#EDEDF3" }}
                      >
                        {i + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">
                        {s ? s.name : "Scan QR atau ketik kode di HP…"}
                      </div>
                      {s?.character ? (
                        <div className="text-[11px] font-semibold text-ink-soft">
                          {CHARACTERS.find((c) => c.id === s.character)?.name}
                        </div>
                      ) : null}
                    </div>
                    {s?.isHost ? <Chip color="#FFD23F">Host</Chip> : null}
                    {s?.isBot ? <Chip color="#DFE6FF">Bot</Chip> : null}
                    {s ? <Chip color={s.ready ? "#2FD592" : "#EDEDF3"}>{s.ready ? "Siap ✓" : "Belum"}</Chip> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 border-t-[2px] border-divider pt-3">
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
              <div className="rounded-2xl border-2 border-ink bg-tint p-3 text-center text-xs font-bold text-ink-soft">
                Menunggu Host / Layar TV memulai game…
              </div>
            )}
            <p className="text-center text-xs font-medium text-ink-soft">
              Buka website ini di HP lalu masukkan kode <b className="font-mono text-ink">{code}</b> atau scan QR di samping.
            </p>
          </div>
        </div>
      </div>

      <Button variant="ghost" className="text-xs text-ink-soft" onClick={onBack}>
        ← Kembali ke Menu Utama
      </Button>
    </main>
  );
}
