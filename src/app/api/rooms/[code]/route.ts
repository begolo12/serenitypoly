import { NextResponse } from "next/server";
import { dbGetRoom, getLanIp, publicRoom } from "@/lib/online";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await dbGetRoom(code);
  if (!room) return NextResponse.json({ error: "Room tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ room: publicRoom(room), lanIp: getLanIp() });
}
