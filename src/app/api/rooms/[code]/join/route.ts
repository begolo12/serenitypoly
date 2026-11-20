import { NextResponse } from "next/server";
import { hasDb, makeToken, publicRoom, sql, type RoomRecord, type RoomSeat } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const { name } = (await request.json().catch(() => ({}))) as { name?: string };

  const rows = (await sql`
    select code, settings, seats, status, game_id, created_at
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as RoomRecord[];
  const room = rows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });
  if (room.seats.length >= 4) return NextResponse.json({ error: "Room penuh (maks 4)" }, { status: 409 });

  const seat: RoomSeat = {
    id: `p${room.seats.length + 1}`,
    name: String(name || `Pemain ${room.seats.length + 1}`).slice(0, 20),
    token: makeToken(),
    ready: false,
    isHost: false,
  };

  const seats = [...room.seats, seat];
  await sql`update sp_rooms set seats = ${JSON.stringify(seats)}::jsonb, updated_at = now() where code = ${room.code}`;

  return NextResponse.json({
    playerId: seat.id,
    token: seat.token,
    room: publicRoom({ ...room, seats }),
  });
}
