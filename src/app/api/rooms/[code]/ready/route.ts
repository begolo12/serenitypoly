import { NextResponse } from "next/server";
import { CHARACTERS, TOKENS } from "@/engine/data";
import type { CharacterId } from "@/engine/types";
import { dbGetRoom, dbUpdateRoom, publicRoom, seatAuth } from "@/lib/online";

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

  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  const seats = room.seats.map((s) => {
    if (s.id !== seat.id) return s;
    const next = { ...s };
    if (body.ready !== undefined) next.ready = Boolean(body.ready);
    if (body.character !== undefined) {
      next.character =
        body.character === null
          ? undefined
          : CHARACTERS.some((c) => c.id === body.character)
            ? body.character
            : s.character;
    }
    if (
      typeof body.tokenIndex === "number" &&
      Number.isInteger(body.tokenIndex) &&
      body.tokenIndex >= 0 &&
      body.tokenIndex < TOKENS.length
    ) {
      next.tokenIndex = body.tokenIndex;
    }
    return next;
  });
  await dbUpdateRoom(room.code, { seats });

  return NextResponse.json({ room: publicRoom({ ...room, seats }) });
}
