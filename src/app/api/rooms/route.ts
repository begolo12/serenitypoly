import { NextResponse } from "next/server";
import { defaultSettings } from "@/engine/create";
import { dbCreateRoom, getLanIp, makeCode, makeToken, type RoomSeat } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: string; tv?: boolean; settings?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const base = defaultSettings();
  const tv = Boolean(body.tv);
  const settings = {
    ...base,
    ...(body.settings ?? {}),
    mode: tv ? ("controller" as const) : ("online" as const),
    players: 4,
    turnTimer: 0,
  };
  const code = makeCode();
  const hostToken = makeToken();

  const seats: RoomSeat[] = tv
    ? []
    : [
        {
          id: "p1",
          name: String(body.name || "Pemain 1").slice(0, 20),
          token: makeToken(),
          ready: false,
          isHost: true,
        },
      ];

  try {
    await dbCreateRoom({
      code,
      settings,
      seats,
      status: "lobby",
      hostToken,
    });
  } catch (err) {
    console.error("create room failed", err);
    return NextResponse.json({ error: "Gagal membuat room" }, { status: 500 });
  }

  const seat = seats[0];
  return NextResponse.json({
    code,
    hostToken,
    playerId: seat?.id ?? null,
    token: seat?.token ?? null,
    lanIp: getLanIp(),
  });
}
