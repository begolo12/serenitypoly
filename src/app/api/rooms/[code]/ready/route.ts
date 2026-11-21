import { NextResponse } from "next/server";
import { CHARACTERS, TOKENS } from "@/engine/data";
import type { CharacterId } from "@/engine/types";
import { dbGetRoom, dbUpdateRoom, hasDb, publicRoom, seatAuth, sql, type RoomSeat } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    ready?: boolean;
    character?: CharacterId | null;
    tokenIndex?: number;
  };

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "Game sudah dimulai" }, { status: 409 });

  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  const idx = room.seats.findIndex((s) => s.id === seat.id);
  if (idx < 0) return NextResponse.json({ error: "Kursi tidak ditemukan" }, { status: 404 });

  const validChar =
    body.character !== undefined
      ? body.character === null
        ? null
        : CHARACTERS.some((c) => c.id === body.character)
          ? body.character
          : undefined
      : undefined;
  const validTok =
    typeof body.tokenIndex === "number" &&
    Number.isInteger(body.tokenIndex) &&
    body.tokenIndex >= 0 &&
    body.tokenIndex < TOKENS.length
      ? body.tokenIndex
      : undefined;

  if (hasDb) {
    // Setiap field diubah dengan jsonb_set terpisah agar update kursi lain tidak tertimpa.
    if (body.ready !== undefined) {
      await sql`
        update sp_rooms set seats = jsonb_set(seats, array[${idx}::text, 'ready'], to_jsonb(${Boolean(body.ready)}::boolean)), updated_at = now()
        where code = ${room.code} and seats -> ${idx}::int ->> 'id' = ${seat.id}
      `;
    }
    if (validChar !== undefined) {
      if (validChar === null) {
        await sql`
          update sp_rooms set seats = seats #- array[${idx}::text, 'character'], updated_at = now()
          where code = ${room.code} and seats -> ${idx}::int ->> 'id' = ${seat.id}
        `;
      } else {
        await sql`
          update sp_rooms set seats = jsonb_set(seats, array[${idx}::text, 'character'], to_jsonb(${validChar}::text)), updated_at = now()
          where code = ${room.code} and seats -> ${idx}::int ->> 'id' = ${seat.id}
        `;
      }
    }
    if (validTok !== undefined) {
      await sql`
        update sp_rooms set seats = jsonb_set(seats, array[${idx}::text, 'tokenIndex'], to_jsonb(${validTok}::int)), updated_at = now()
        where code = ${room.code} and seats -> ${idx}::int ->> 'id' = ${seat.id}
      `;
    }
    const fresh = await dbGetRoom(room.code);
    return NextResponse.json({ room: publicRoom(fresh ?? room) });
  }

  const seats: RoomSeat[] = room.seats.map((s) => {
    if (s.id !== seat.id) return s;
    const next = { ...s };
    if (body.ready !== undefined) next.ready = Boolean(body.ready);
    if (validChar !== undefined) {
      next.character = validChar === null ? undefined : validChar;
    }
    if (validTok !== undefined) next.tokenIndex = validTok;
    return next;
  });
  await dbUpdateRoom(room.code, { seats });

  return NextResponse.json({ room: publicRoom({ ...room, seats }) });
}
