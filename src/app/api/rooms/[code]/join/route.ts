import { NextResponse } from "next/server";
import { BOT_NAMES } from "@/engine/data";
import { dbGetRoom, dbUpdateRoom, makeToken, publicRoom, type RoomSeat } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    addBot?: boolean;
    removeBot?: boolean;
    reclaimId?: string;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  if (body.reclaimId) {
    const seat = room.seats.find((s) => s.id === body.reclaimId && !s.isBot);
    if (!seat) return NextResponse.json({ error: "Kursi tidak ditemukan" }, { status: 404 });
    return NextResponse.json({
      playerId: seat.id,
      token: seat.token,
      room: publicRoom(room),
    });
  }

  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  if (body.removeBot) {
    const idx = [...room.seats].reverse().findIndex((s) => s.isBot);
    if (idx < 0) return NextResponse.json({ error: "Tidak ada bot" }, { status: 404 });
    const realIdx = room.seats.length - 1 - idx;
    const seats = room.seats
      .filter((_, i) => i !== realIdx)
      .map((s, i) => ({ ...s, id: `p${i + 1}` }));
    await dbUpdateRoom(room.code, { seats });
    return NextResponse.json({ room: publicRoom({ ...room, seats }) });
  }

  if (room.seats.length >= 4) return NextResponse.json({ error: "Room penuh (maks 4)" }, { status: 409 });

  if (body.addBot) {
    const botIdx = room.seats.filter((s) => s.isBot).length;
    const seat: RoomSeat = {
      id: `p${room.seats.length + 1}`,
      name: BOT_NAMES[botIdx] ?? `Bot ${botIdx + 1}`,
      token: makeToken(),
      ready: true,
      isHost: false,
      isBot: true,
    };
    const seats = [...room.seats, seat];
    await dbUpdateRoom(room.code, { seats });
    return NextResponse.json({
      playerId: seat.id,
      room: publicRoom({ ...room, seats }),
    });
  }

  const hasHumanHost = room.seats.some((s) => s.isHost && !s.isBot);
  const seat: RoomSeat = {
    id: `p${room.seats.length + 1}`,
    name: String(body.name || `Pemain ${room.seats.length + 1}`).slice(0, 20),
    token: makeToken(),
    ready: false,
    isHost: !hasHumanHost,
    isBot: false,
  };

  const seats = [...room.seats, seat];
  await dbUpdateRoom(room.code, { seats });

  return NextResponse.json({
    playerId: seat.id,
    token: seat.token,
    room: publicRoom({ ...room, seats }),
  });
}
