import { NextResponse } from "next/server";
import { createGame } from "@/engine/create";
import type { Settings } from "@/engine/types";
import { dbCreateGame, dbGetRoom, dbUpdateRoom, makeToken, publicRoom, seatAuth } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    hostToken?: string;
    fromTv?: boolean;
    forceReady?: boolean;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  const isHost =
    Boolean(body.hostToken && room.host_token && body.hostToken === room.host_token) ||
    Boolean(seatAuth(room, body.playerId ?? "", body.token ?? "")?.isHost) ||
    Boolean(body.fromTv);
  if (!isHost) return NextResponse.json({ error: "Hanya host" }, { status: 403 });

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

  await dbCreateGame({ id: gameId, code: room.code, state });
  await dbUpdateRoom(room.code, { seats, status: "playing", game_id: gameId });

  return NextResponse.json({
    ok: true,
    gameId,
    room: publicRoom({ ...room, seats, status: "playing", game_id: gameId }),
  });
}
