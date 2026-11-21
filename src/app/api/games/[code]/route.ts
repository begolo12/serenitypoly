import { NextResponse } from "next/server";
import { applyAction, playerOf } from "@/engine/actions";
import { botAction } from "@/engine/bot";
import type { Action, GameState } from "@/engine/types";
import { dbGetGame, dbGetRoom, dbUpdateGame, dbUpdateRoom, seatAuth } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type IncomingAction = Action | { type: "BOT_STEP" };

function actorFor(state: GameState, action: Action): string | null {
  if (action.type === "BID" || action.type === "PASS_BID") return state.auction?.current ?? null;
  if (action.type === "TRADE_RESPOND") return state.trade?.to ?? null;
  if (action.type === "TRADE_OFFER") {
    if (state.trade?.to === action.offer.from) return action.offer.from;
    return state.players[state.turnIndex]?.id === action.offer.from ? action.offer.from : null;
  }
  return state.players[state.turnIndex]?.id ?? null;
}

function pendingActorId(state: GameState): string | null {
  if (state.auction) return state.auction.current;
  if (state.trade) return state.trade.to;
  return state.players[state.turnIndex]?.id ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const game = await dbGetGame(code);
  if (!game) return NextResponse.json({ error: "Game tidak ditemukan" }, { status: 404 });
  if (since && since === game.version) {
    return NextResponse.json({ version: game.version, unchanged: true });
  }
  return NextResponse.json({ version: game.version, state: game.state });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    tv?: boolean;
    hostToken?: string;
    action?: IncomingAction;
  };
  if (!body.action) return NextResponse.json({ error: "Aksi kosong" }, { status: 400 });

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const isBotStep = body.action.type === "BOT_STEP";
  const hasSeat = Boolean(seatAuth(room, body.playerId ?? "", body.token ?? ""));
  const hasTvAuth = Boolean(body.tv) || Boolean(body.hostToken && room.host_token === body.hostToken);

  if (isBotStep) {
    if (!hasSeat && !hasTvAuth) {
      return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });
    }
  } else if (!hasSeat) {
    return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const game = await dbGetGame(code);
    if (!game) return NextResponse.json({ error: "Game tidak ditemukan" }, { status: 404 });
    if (game.state.phase === "game_over") {
      return NextResponse.json({ version: game.version, state: game.state, unchanged: true });
    }

    let resolvedAction: Action;
    if (isBotStep) {
      const targetId = pendingActorId(game.state);
      const target = playerOf(game.state, targetId);
      if (!target || !target.isBot) {
        return NextResponse.json({ version: game.version, state: game.state, unchanged: true });
      }
      resolvedAction = botAction(game.state) ?? { type: "END_TURN" };
    } else {
      resolvedAction = body.action as Action;
      const expectedActor = actorFor(game.state, resolvedAction);
      if (expectedActor !== body.playerId) {
        return NextResponse.json({ error: "Bukan giliranmu", version: game.version }, { status: 403 });
      }
    }

    const prev = game.state;
    const next = applyAction(prev, resolvedAction);
    if (next === prev) {
      return NextResponse.json({ error: "Aksi tidak sah", version: game.version, state: prev }, { status: 409 });
    }

    const nextVersion = await dbUpdateGame(room.code, game.id, game.version, next);
    if (nextVersion !== null) {
      if (next.phase === "game_over") {
        await dbUpdateRoom(room.code, { status: "finished" });
      }
      return NextResponse.json({ version: nextVersion, state: next });
    }
  }

  return NextResponse.json({ error: "Konflik, coba lagi" }, { status: 409 });
}
