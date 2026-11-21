import { NextResponse } from "next/server";
import { BOT_NAMES, CHARACTERS, TOKENS } from "@/engine/data";
import type { CharacterId } from "@/engine/types";
import {
  clientIp,
  dbGetRoom,
  dbUpdateRoom,
  hasDb,
  hitRateLimit,
  hostAuth,
  makeToken,
  publicRoom,
  sql,
  type RoomSeat,
} from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nextFreeTokenIndex(seats: RoomSeat[]): number {
  const used = new Set(seats.map((s) => s.tokenIndex).filter((x): x is number => x !== undefined));
  for (let i = 0; i < TOKENS.length; i++) {
    if (!used.has(i)) return i;
  }
  return seats.length % TOKENS.length;
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    addBot?: boolean;
    removeBot?: boolean;
    playerId?: string;
    token?: string;
    reconnectKey?: string;
    hostToken?: string;
    character?: CharacterId;
    tokenIndex?: number;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  // Pemulihan kursi hanya bila tidak ada perintah lain (tambah/hapus bot, gabung baru).
  const wantsReconnect =
    Boolean(body.reconnectKey) && !body.addBot && !body.removeBot && body.name === undefined;
  if (wantsReconnect) {
    const allowed = await hitRateLimit(`reconnect:${clientIp(request)}`, 30, 10 * 60_000);
    if (!allowed) return NextResponse.json({ error: "Terlalu banyak percobaan" }, { status: 429 });
    const seat = room.seats.find(
      (s) => s.id === body.playerId && !s.isBot && s.reconnectKey && s.reconnectKey === body.reconnectKey,
    );
    if (!seat) return NextResponse.json({ error: "Kunci kursi tidak cocok" }, { status: 403 });
    return NextResponse.json({
      playerId: seat.id,
      token: seat.token,
      reconnectKey: seat.reconnectKey,
      room: publicRoom(room),
    });
  }
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  const isHost = hostAuth(room, body.hostToken, body.playerId, body.token);

  if (body.removeBot) {
    if (!isHost) return NextResponse.json({ error: "Hanya host" }, { status: 403 });
    const seats = [...room.seats];
    if (!seats[seats.length - 1]?.isBot) {
      return NextResponse.json({ error: "Hanya bot di kursi terakhir yang bisa dihapus" }, { status: 409 });
    }
    seats.pop();
    await dbUpdateRoom(room.code, { seats });
    return NextResponse.json({ room: publicRoom({ ...room, seats }) });
  }

  if (body.addBot && !isHost) return NextResponse.json({ error: "Hanya host" }, { status: 403 });
  if (room.seats.length >= 4) return NextResponse.json({ error: "Room penuh (maks 4)" }, { status: 409 });

  if (body.addBot) {
    const botIdx = room.seats.filter((s) => s.isBot).length;
    const token = makeToken();
    const reconnectKey = makeToken();
    const name = BOT_NAMES[botIdx] ?? `Bot ${botIdx + 1}`;
    const tokenIndex = nextFreeTokenIndex(room.seats);

    if (hasDb) {
      const rows = (await sql`
        update sp_rooms r
        set seats = r.seats || jsonb_build_array(jsonb_build_object(
          'id', 'p' || (jsonb_array_length(r.seats) + 1),
          'name', ${name}::text,
          'token', ${token}::text,
          'reconnectKey', ${reconnectKey}::text,
          'ready', true,
          'isHost', false,
          'isBot', true,
          'character', null,
          'tokenIndex', ${tokenIndex}::int
        )), updated_at = now()
        where r.code = ${room.code} and r.status = 'lobby' and jsonb_array_length(r.seats) < 4
        returning r.seats
      `) as Array<{ seats: RoomSeat[] }>;
      if (!rows[0]) return NextResponse.json({ error: "Room penuh (maks 4)" }, { status: 409 });
      return NextResponse.json({ room: publicRoom({ ...room, seats: rows[0].seats }) });
    }

    const seat: RoomSeat = {
      id: `p${room.seats.length + 1}`,
      name,
      token,
      reconnectKey,
      ready: true,
      isHost: false,
      isBot: true,
      tokenIndex,
    };
    const seats = [...room.seats, seat];
    await dbUpdateRoom(room.code, { seats });
    return NextResponse.json({ room: publicRoom({ ...room, seats }) });
  }

  const validChar = CHARACTERS.some((c) => c.id === body.character) ? body.character : undefined;
  const validTok =
    typeof body.tokenIndex === "number" &&
    Number.isInteger(body.tokenIndex) &&
    body.tokenIndex >= 0 &&
    body.tokenIndex < TOKENS.length
      ? body.tokenIndex
      : nextFreeTokenIndex(room.seats);

  const token = makeToken();
  const reconnectKey = makeToken();
  const name = String(body.name || `Pemain ${room.seats.length + 1}`).trim().slice(0, 20) || "Pemain";
  const hasHumanHost = room.seats.some((s) => s.isHost && !s.isBot);

  if (hasDb) {
    const rows = (await sql`
      update sp_rooms r
      set seats = r.seats || jsonb_build_array(jsonb_build_object(
        'id', 'p' || (jsonb_array_length(r.seats) + 1),
        'name', ${name}::text,
        'token', ${token}::text,
        'reconnectKey', ${reconnectKey}::text,
        'ready', false,
        'isHost', not exists (
          select 1 from jsonb_array_elements(r.seats) e
          where coalesce((e->>'isHost')::boolean, false)
            and not coalesce((e->>'isBot')::boolean, false)
        ),
        'isBot', false,
        'character', ${validChar ?? null}::text,
        'tokenIndex', ${validTok}::int
      )), updated_at = now()
      where r.code = ${room.code} and r.status = 'lobby' and jsonb_array_length(r.seats) < 4
      returning r.seats
    `) as Array<{ seats: RoomSeat[] }>;
    const seats = rows[0]?.seats;
    if (!seats) return NextResponse.json({ error: "Room penuh (maks 4)" }, { status: 409 });
    const created = seats[seats.length - 1];
    return NextResponse.json({
      playerId: created.id,
      token,
      reconnectKey,
      room: publicRoom({ ...room, seats }),
    });
  }

  const seat: RoomSeat = {
    id: `p${room.seats.length + 1}`,
    name,
    token,
    reconnectKey,
    ready: false,
    isHost: !hasHumanHost,
    isBot: false,
    character: validChar,
    tokenIndex: validTok,
  };
  const seats = [...room.seats, seat];
  await dbUpdateRoom(room.code, { seats });

  return NextResponse.json({
    playerId: seat.id,
    token,
    reconnectKey,
    room: publicRoom({ ...room, seats }),
  });
}
