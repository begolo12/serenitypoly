import { NextResponse } from "next/server";
import { CHAT_COOLDOWN_MS, isQuickChat, type ChatMessage } from "@/lib/chat";
import { hasDb, makeToken, seatAuth, sql, type RoomRecord } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRow = { id: string; player_id: string; name: string; text: string; at: Date };

function toMessage(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    playerId: row.player_id,
    name: row.name,
    text: row.text,
    at: new Date(row.at).getTime(),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const rows = (await sql`
    select id, player_id, name, text, at from (
      select id, player_id, name, text, at
      from sp_chats where code = ${code.toUpperCase()}
      order by at desc, id desc
      limit 50
    ) latest
    order by at asc, id asc
  `) as ChatRow[];
  return NextResponse.json({ messages: rows.map(toMessage) });
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!hasDb) return NextResponse.json({ error: "Database belum dikonfigurasi" }, { status: 503 });
  const { code } = await params;
  const roomRows = (await sql`
    select code, settings, seats, status, game_id, created_at
    from sp_rooms where code = ${code.toUpperCase()} limit 1
  `) as RoomRecord[];
  const room = roomRows[0];
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    playerId?: string;
    token?: string;
    text?: string;
  };
  const seat = seatAuth(room, body.playerId ?? "", body.token ?? "");
  if (!seat) return NextResponse.json({ error: "Sesi tidak sah" }, { status: 403 });

  const text = String(body.text ?? "").trim();
  if (!isQuickChat(text)) return NextResponse.json({ error: "Pesan tidak tersedia" }, { status: 400 });

  // Rate limit disimpan di DB supaya tetap berlaku lintas instance serverless.
  const lastRows = (await sql`
    select greatest(0, extract(epoch from (now() - at)) * 1000)::int as age_ms
    from sp_chats where code = ${room.code} and player_id = ${seat.id}
    order by at desc limit 1
  `) as Array<{ age_ms: number }>;
  const age = lastRows[0]?.age_ms ?? CHAT_COOLDOWN_MS;
  if (age < CHAT_COOLDOWN_MS) {
    const wait = Math.ceil((CHAT_COOLDOWN_MS - age) / 1000);
    return NextResponse.json({ error: `Tunggu ${wait} detik sebelum kirim lagi` }, { status: 429 });
  }

  const id = `c_${seat.id}_${makeToken().slice(0, 8)}`;
  const inserted = (await sql`
    insert into sp_chats (id, code, player_id, name, text)
    values (${id}, ${room.code}, ${seat.id}, ${seat.name}, ${text})
    returning id, player_id, name, text, at
  `) as ChatRow[];
  await sql`delete from sp_chats where code = ${room.code} and at < now() - interval '12 hours'`;

  const message = inserted[0]
    ? toMessage(inserted[0])
    : { id, playerId: seat.id, name: seat.name, text, at: Date.now() };
  return NextResponse.json({ ok: true, message });
}
