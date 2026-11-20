import { NextResponse } from "next/server";
import { applyAction } from "@/engine/actions";
import type { Action, GameState } from "@/engine/types";
import { hasDb, seatAuth, sql, type RoomRecord } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type GameRow = { id: string; code: string; state: GameState; version: number };

function actorFor(state: GameState, action: Action): string | null {
  if (action.type === "BID" || action.type === "PASS_BID") return state.auction?.current ?? null;
  if (action.type === "TRADE_RESPOND") return state.trade?.to ?? null;
  if (action.type === "TRADE_OFFER") return action.offer.from;
  return state.players[state.turnIndex]?.id ?? null;
}

async function loadGame(code: string) {
  const rows = (await sql`
    select id, code, state, version from sp_games where code = ${code.toUpperCase()} limit 1
  `) as GameRow[];
  return rows[0] ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const game = await loadGame(code);
  if (!game) return NextResponse.json({ error: "Game tidak ditemukan" }, { status: 404 });
  if (since && since === game.version) {
    return NextResponse.json({ version: game.version, unchanged: true });
  }
  return NextResponse.json({ version: game.version, state: game.state });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    action?: Action;
  };
  if (!body.action) return NextResponse.json({ error: "Aksi kosong" }, { status: 400 });

  const roomRows = (await sql`
    select code, settings, seats, status, game_id, created_at
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as RoomRecord[];
  const room = roomRows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (!seatAuth(room, body.playerId ?? "", body.token ?? "")) {
    return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const game = await loadGame(code);
    if (!game) return NextResponse.json({ error: "Game tidak ditemukan" }, { status: 404 });
    if (game.state.phase === "game_over") {
      return NextResponse.json({ version: game.version, state: game.state, unchanged: true });
    }

    const expectedActor = actorFor(game.state, body.action);
    if (expectedActor !== body.playerId) {
      return NextResponse.json({ error: "Bukan giliranmu", version: game.version }, { status: 403 });
    }

    const prev = game.state;
    const next = applyAction(prev, body.action);
    if (next === prev) {
      return NextResponse.json({ error: "Aksi tidak sah", version: game.version, state: prev }, { status: 409 });
    }

    const updated = (await sql`
      update sp_games
      set state = ${JSON.stringify(next)}::jsonb, version = version + 1, updated_at = now()
      where id = ${game.id} and version = ${game.version}
      returning version
    `) as Array<{ version: number }>;

    if (updated.length > 0) {
      if (next.phase === "game_over") {
        await sql`update sp_rooms set status = 'finished', updated_at = now() where code = ${room.code}`;
      }
      return NextResponse.json({ version: updated[0].version, state: next });
    }
  }

  return NextResponse.json({ error: "Konflik, coba lagi" }, { status: 409 });
}
