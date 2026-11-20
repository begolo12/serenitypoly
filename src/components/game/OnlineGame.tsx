"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Action, GameState } from "@/engine/types";
import { current, features, living, playerOf } from "@/engine/actions";
import { TILES, WAVE_LABEL } from "@/engine/data";
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

type Identity = { playerId: string; token: string };

export function OnlineGame({ code, tv }: { code: string; tv: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [origin, setOrigin] = useState("");
  const versionRef = useRef(0);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (tv) return;
    const raw = localStorage.getItem(`sp-seat-${code}`);
    if (raw) {
      try {
        setIdentity(JSON.parse(raw) as Identity);
      } catch {
        /* ignore */
      }
    }
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
            versionRef.current = data.version;
            setState(data.state as GameState);
          }
        } else if (!alive || res.status !== 404) {
          /* keep last state */
        }
        if (!state) {
          const rr = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
          if (rr.ok) {
            const rd = await rr.json();
            if (alive) setRoom(rd.room);
          }
        }
      } catch {
        /* offline; retry next tick */
      }
      if (alive) timer = window.setTimeout(tick, 1200);
    };

    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
          versionRef.current = data.version;
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

  if (!state) {
    return (
      <WaitRoom
        code={code}
        room={room}
        origin={origin}
        tv={tv}
        onBack={() => router.push("/")}
      />
    );
  }

  const me = current(state);
  const myId = identity?.playerId;
  const isMyTurn = Boolean(myId && me?.id === myId);
  const canAct = isMyTurn && !state.trade && state.phase !== "auction" && state.phase !== "game_over";

  if (tv) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col gap-2 p-2 md:p-4">
        <header className="flex flex-wrap items-center gap-2">
          <div className="font-display text-xl uppercase leading-none tracking-tighter md:text-2xl">
            Serenity<span className="bg-yellow px-1">Poly</span>
          </div>
          <Chip color="#FFD43B">
            Ronde {state.round} · {WAVE_LABEL[state.wave]}
          </Chip>
          <Chip>Kode {code}</Chip>
          <Chip color={me?.color}>{me?.name} · giliran</Chip>
          {state.event ? <Chip color="#FF8A3D">{state.event.label}</Chip> : null}
        </header>
        <div className="flex flex-col gap-2 lg:flex-row">
          <main className="min-w-0 flex-1">
            <Board
              state={state}
              selected={null}
              onSelect={() => {
                /* display only */
              }}
            />
          </main>
          <aside className="flex w-full flex-col gap-2 lg:w-[280px]">
            <div className="panel p-2 text-center">
              <div className="text-[10px] font-bold uppercase opacity-60">Sekarang bermain</div>
              <div className="font-display text-xl uppercase" style={{ color: me?.color }}>
                {me?.name}
              </div>
              <div className="money text-lg font-bold">{rp(me?.cash ?? 0)}</div>
            </div>
            {living(state)
              .filter((p) => p.id !== me?.id)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2 border-[3px] border-ink bg-surface p-2">
                  <span>{p.token}</span>
                  <span className="flex-1 truncate text-xs font-bold">{p.name}</span>
                  <span className="money text-[11px]">{rp(p.cash)}</span>
                </div>
              ))}
          </aside>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-2 p-2 md:p-3">
      <header className="flex flex-wrap items-center gap-2">
        <div className="font-display text-lg uppercase leading-none tracking-tighter md:text-xl">
          Serenity<span className="bg-yellow px-1">Poly</span>
        </div>
        <Chip color="#FFD43B">
          Ronde {state.round} · {WAVE_LABEL[state.wave]}
        </Chip>
        <Chip>Room {code}</Chip>
        {state.event ? <Chip color="#FF8A3D">{state.event.label}</Chip> : null}
        {me?.id === myId ? <Chip color="#3DDC97">GILIRANMU</Chip> : <Chip>Menunggu {me?.name}</Chip>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button variant="ghost" className="px-2 text-xs" onClick={() => setPanel("mission")}>
            🎯
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => setPanel("bank")}>
            🏦
          </Button>
          {features(state).shop ? (
            <Button variant="ghost" className="px-2 text-xs" onClick={() => setPanel("shop")}>
              🛒
            </Button>
          ) : null}
          <Button variant="ghost" className="px-2 text-xs" disabled={!canAct} onClick={() => setPanel("trade")}>
            🤝
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => setPanel("rules")}>
            📖
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => router.push("/")}>
            ✕
          </Button>
        </div>
      </header>

      {err ? (
        <div className="border-[3px] border-ink bg-red/20 px-2 py-1 text-[11px] font-bold uppercase">{err}</div>
      ) : null}

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
        <aside className="flex w-full flex-col gap-2 lg:w-[340px] lg:shrink-0">
          <div className="panel p-2" style={{ borderTop: `8px solid ${me?.color ?? "#0A0A0A"}` }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{me?.token}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm uppercase leading-none">{me?.name}</div>
                <div className="text-[10px] font-bold uppercase opacity-60">
                  {isMyTurn ? "Giliranmu" : "Menunggu giliran"}
                </div>
              </div>
              <div className="money text-sm font-bold">{rp(me?.cash ?? 0)}</div>
            </div>
          </div>
          <ActionPanel
            state={state}
            act={act}
            canAct={canAct}
            onOpen={setPanel}
            setSelectedTile={setSelectedTile}
          />
          <RentBreakdown state={state} />
        </aside>
      </div>

      {state.auction && isMyTurn ? <AuctionDialog state={state} act={act} /> : null}
      {state.auction && !isMyTurn ? (
        <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-fit border-[3px] border-ink bg-yellow px-3 py-2 text-xs font-bold uppercase shadow-[4px_4px_0_#0A0A0A]">
          Lelang berjalan · {playerOf(state, state.auction.current)?.name}
        </div>
      ) : null}
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
          <PropertySheet state={state} tileId={selectedTile} act={act} onClose={() => setPanel(null)} />
        ) : null}
      </Modal>
      {state.phase === "game_over" ? (
        <ResultDialog state={state} onRestart={() => router.push("/")} onExit={() => router.push("/")} />
      ) : null}
      {!identity ? (
        <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-fit border-[3px] border-ink bg-muted px-3 py-2 text-xs font-bold uppercase">
          Mode penonton · buka link room untuk ikut bermain
        </div>
      ) : null}
    </div>
  );
}

function WaitRoom({
  code,
  room,
  origin,
  tv,
  onBack,
}: {
  code: string;
  room: PublicRoom | null;
  origin: string;
  tv: boolean;
  onBack: () => void;
}) {
  const joinUrl = `${origin}/room/${code}`;
  return (
    <main className={cn("mx-auto flex min-h-dvh w-full flex-col items-center justify-center gap-3 p-4", tv ? "max-w-4xl" : "max-w-xl")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">
        {tv ? "Papan tunggu" : "Menunggu game dimulai"}
      </div>
      <div className="font-display text-4xl uppercase leading-none">
        Kode <span className="bg-yellow px-2">{code}</span>
      </div>
      {origin ? <QrCode value={joinUrl} size={240} /> : null}
      <div className="break-all text-center text-[10px] font-bold uppercase opacity-60">{joinUrl}</div>
      <div className="flex flex-wrap justify-center gap-1">
        {room?.seats.length ? (
          room.seats.map((s) => (
            <Chip key={s.id} color={s.ready ? "#3DDC97" : "#EFE9DA"}>
              {s.name} {s.ready ? "✓" : "…"}
            </Chip>
          ))
        ) : (
          <Chip>Belum ada pemain</Chip>
        )}
      </div>
      <p className="max-w-sm text-center text-xs font-bold opacity-60">
        Buka link di HP masing-masing, tekan Siap, lalu host menekan Mulai Game.
      </p>
      <Button variant="ghost" className="text-xs" onClick={onBack}>
        ← Menu
      </Button>
    </main>
  );
}
