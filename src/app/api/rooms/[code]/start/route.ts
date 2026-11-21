import { NextResponse } from "next/server";
import { createGame } from "@/engine/create";
import type { Settings } from "@/engine/types";
import {
  dbCreateGame,
  dbGetRoom,
  dbUpdateRoom,
  hasDb,
  hostAuth,
  makeToken,
  publicRoom,
  sql,
} from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    hostToken?: string;
    forceReady?: boolean;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  if (!hostAuth(room, body.hostToken, body.playerId, body.token)) {
    return NextResponse.json({ error: "Hanya host" }, { status: 403 });
  }

  if (room.seats.length < 2) return NextResponse.json({ error: "Butuh minimal 2 pemain" }, { status: 409 });
  if (!body.forceReady && !room.seats.every((s) => s.ready)) {
    return NextResponse.json({ error: "Masih ada pemain belum siap" }, { status: 409 });
  }

  const seats = body.forceReady ? room.seats.map((s) => ({ ...s, ready: true })) : room.seats;
  const settings = {
    ...(room.settings as Settings),
    players: seats.length,
  };
  const state = createGame(
    settings,
    seats.map((s) => ({
      name: s.name,
      isBot: Boolean(s.isBot),
      character: s.character,
      tokenIndex: s.tokenIndex,
    })),
  );
  const gameId = `g_${room.code}_${makeToken().slice(0, 8)}`;

  if (hasDb) {
    // Klaim room secara atomik supaya dua request start tidak membuat dua game.
    const claimed = (await sql`
      update sp_rooms
      set status = 'playing', game_id = ${gameId}, seats = ${JSON.stringify(seats)}::jsonb, updated_at = now()
      where code = ${room.code} and status = 'lobby'
      returning code
    `) as Array<{ code: string }>;
    if (!claimed[0]) return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

    try {
      await dbCreateGame({ id: gameId, code: room.code, state });
    } catch (err) {
      console.error("start game failed", err);
      await sql`
        update sp_rooms
        set status = 'lobby', game_id = null, seats = ${JSON.stringify(room.seats)}::jsonb, updated_at = now()
        where code = ${room.code} and game_id = ${gameId}
      `;
      return NextResponse.json({ error: "Gagal memulai game, coba lagi" }, { status: 503 });
    }
  } else {
    await dbCreateGame({ id: gameId, code: room.code, state });
    await dbUpdateRoom(room.code, { seats, status: "playing", game_id: gameId });
  }

  return NextResponse.json({
    ok: true,
    gameId,
    room: publicRoom({ ...room, seats, status: "playing", game_id: gameId }),
  });
}
