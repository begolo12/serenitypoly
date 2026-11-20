import { NextResponse } from "next/server";
import { hasDb, publicRoom, sql, type RoomRecord } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const rows = (await sql`
    select code, settings, seats, status, game_id, created_at
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as RoomRecord[];
  const room = rows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ room: publicRoom(room) });
}
