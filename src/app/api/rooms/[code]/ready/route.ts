import { NextResponse } from "next/server";
import { hasDb, publicRoom, seatAuth, sql, type RoomRecord } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    ready?: boolean;
  };

  const rows = (await sql`
    select code, settings, seats, status, game_id, created_at
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as RoomRecord[];
  const room = rows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  const seats = room.seats.map((s) => (s.id === seat.id ? { ...s, ready: Boolean(body.ready) } : s));
  await sql`update sp_rooms set seats = ${JSON.stringify(seats)}::jsonb, updated_at = now() where code = ${room.code}`;

  return NextResponse.json({ room: publicRoom({ ...room, seats }) });
}
