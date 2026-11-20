import { NextResponse } from "next/server";
import { createGame } from "@/engine/create";
import type { Settings } from "@/engine/types";
import { hasDb, makeToken, publicRoom, seatAuth, sql, type RoomRecord } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    hostToken?: string;
  };

  const rows = (await sql`
    select code, settings, seats, status, game_id, created_at, host_token
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as Array<RoomRecord & { host_token: string | null }>;
  const room = rows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  const isHost =
    (body.hostToken && room.host_token && body.hostToken === room.host_token) ||
    Boolean(seatAuth(room, body.playerId ?? "", body.token ?? "")?.isHost);
  if (!isHost) return NextResponse.json({ error: "Hanya host" }, { status: 403 });

  if (room.seats.length < 2) return NextResponse.json({ error: "Butuh minimal 2 pemain" }, { status: 409 });
  if (!room.seats.every((s) => s.ready)) return NextResponse.json({ error: "Masih ada pemain belum siap" }, { status: 409 });

  const settings = room.settings as Settings;
  const state = createGame(
    settings,
    room.seats.map((s) => ({ name: s.name, isBot: false })),
  );
  const gameId = `g_${room.code}_${makeToken().slice(0, 8)}`;

  await sql`
    insert into sp_games (id, code, state, version)
    values (${gameId}, ${room.code}, ${JSON.stringify(state)}::jsonb, 1)
  `;
  await sql`update sp_rooms set status = 'playing', game_id = ${gameId}, updated_at = now() where code = ${room.code}`;

  return NextResponse.json({ ok: true, gameId, room: publicRoom({ ...room, status: "playing", game_id: gameId }) });
}
