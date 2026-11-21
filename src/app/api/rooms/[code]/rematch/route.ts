import { NextResponse } from "next/server";
import { createGame } from "@/engine/create";
import type { Settings } from "@/engine/types";
import { dbGetRoom, dbResetGame, dbUpdateRoom, publicRoom, seatAuth } from "@/lib/online";

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
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const isHost =
    Boolean(body.hostToken && room.host_token && body.hostToken === room.host_token) ||
    Boolean(seatAuth(room, body.playerId ?? "", body.token ?? "")?.isHost) ||
    Boolean(body.fromTv);
  if (!isHost) return NextResponse.json({ error: "Hanya host" }, { status: 403 });
  if (room.seats.length < 2) return NextResponse.json({ error: "Butuh minimal 2 pemain" }, { status: 409 });

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

  const updated = await dbResetGame(room.code, freshState);
  await dbUpdateRoom(room.code, { seats, status: "playing", game_id: updated.id });

  return NextResponse.json({
    ok: true,
    version: updated.version,
    state: updated.state,
    room: publicRoom({ ...room, seats, status: "playing", game_id: updated.id }),
  });
}
