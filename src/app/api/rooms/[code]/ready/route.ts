import { NextResponse } from "next/server";
import { dbGetRoom, dbUpdateRoom, publicRoom, seatAuth } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    ready?: boolean;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  const seats = room.seats.map((s) => (s.id === seat.id ? { ...s, ready: Boolean(body.ready) } : s));
  await dbUpdateRoom(room.code, { seats });

  return NextResponse.json({ room: publicRoom({ ...room, seats }) });
}
