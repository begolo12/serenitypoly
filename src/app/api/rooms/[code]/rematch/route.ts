import { NextResponse } from "next/server";
import { createGame } from "@/engine/create";
import type { Settings } from "@/engine/types";
import {
  dbGetGame,
  dbGetRoom,
  dbResetGame,
  dbUpdateRoom,
  hasDb,
  hostAuth,
  publicRoom,
  redactState,
  seatAuth,
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
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  if (!hostAuth(room, body.hostToken, body.playerId, body.token)) {
    return NextResponse.json({ error: "Hanya host" }, { status: 403 });
  }
  if (room.seats.length < 2) return NextResponse.json({ error: "Butuh minimal 2 pemain" }, { status: 409 });

  if (room.status !== "finished") {
    const game = await dbGetGame(room.code);
    if (!game || game.state.phase !== "game_over") {
      return NextResponse.json({ error: "Game belum selesai" }, { status: 409 });
    }
    await sql`update sp_rooms set status = 'finished', updated_at = now() where code = ${room.code} and status = 'playing'`;
  }

  const seats = room.seats.map((s) => ({ ...s, ready: true }));
  const settings = {
    ...(room.settings as Settings),
    players: seats.length,
  };
  const freshState = createGame(
    settings,
    seats.map((s) => ({
      name: s.name,
      isBot: Boolean(s.isBot),
      character: s.character,
      tokenIndex: s.tokenIndex,
    })),
  );

  if (hasDb) {
    const claimed = (await sql`
      update sp_rooms
      set status = 'playing', seats = ${JSON.stringify(seats)}::jsonb, updated_at = now()
      where code = ${room.code} and status = 'finished'
      returning code
    `) as Array<{ code: string }>;
    if (!claimed[0]) return NextResponse.json({ error: "Rematch sudah dimulai" }, { status: 409 });
  }

  let updated;
  try {
    updated = await dbResetGame(room.code, freshState);
  } catch (err) {
    console.error("rematch failed", err);
    if (hasDb) {
      await sql`update sp_rooms set status = 'finished', updated_at = now() where code = ${room.code}`;
    }
    return NextResponse.json({ error: "Gagal memulai ulang" }, { status: 503 });
  }

  if (!hasDb) {
    await dbUpdateRoom(room.code, { seats, status: "playing", game_id: updated.id });
  }

  const viewer = seatAuth(room, body.playerId ?? "", body.token ?? "");

  return NextResponse.json({
    ok: true,
    version: updated.version,
    state: redactState(updated.state, viewer?.id ?? null),
    room: publicRoom({ ...room, seats, status: "playing", game_id: updated.id }),
  });
}
