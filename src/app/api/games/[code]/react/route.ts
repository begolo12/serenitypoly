import { NextResponse } from "next/server";
import { playerOf } from "@/engine/actions";
import { dbGetGame, dbGetRoom, dbUpdateGame, seatAuth } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EMOJIS = new Set(["❤️", "🔥", "👏", "😱", "🤣", "💸"]);

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    emoji?: string;
  };

  if (!body.emoji || !ALLOWED_EMOJIS.has(body.emoji)) {
    return NextResponse.json({ error: "Stiker tidak valid" }, { status: 400 });
  }

  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  for (let attempt = 0; attempt < 2; attempt++) {
    const game = await dbGetGame(code);
    if (!game) return NextResponse.json({ error: "Game tidak ditemukan" }, { status: 404 });

    const player = playerOf(game.state, seat.id);
    if (!player) return NextResponse.json({ error: "Pemain tidak ditemukan" }, { status: 404 });

    const now = Date.now();
    const mine = (game.state.reactions ?? [])
      .filter((r) => r.playerId === seat.id)
      .sort((a, b) => b.at - a.at)[0];
    if (mine && now - mine.at < 2000) {
      return NextResponse.json({ error: "Tunggu sebentar sebelum reaksi lagi" }, { status: 429 });
    }

    const fresh = (game.state.reactions ?? []).filter((r) => now - r.at < 15000);
    const nextReactions = [
      ...fresh.slice(-7),
      {
        id: `${seat.id}_${now}_${Math.random().toString(36).slice(2, 6)}`,
        playerId: seat.id,
        name: player.name,
        color: player.color,
        emoji: body.emoji,
        at: now,
      },
    ];

    const nextState = {
      ...game.state,
      reactions: nextReactions,
    };

    const nextVersion = await dbUpdateGame(room.code, game.id, game.version, nextState);
    if (nextVersion !== null) {
      return NextResponse.json({ ok: true, version: nextVersion, reactions: nextReactions });
    }
  }

  return NextResponse.json({ error: "Konflik, coba lagi" }, { status: 409 });
}
