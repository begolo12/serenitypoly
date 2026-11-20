import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

export const hasDb = Boolean(url);

export const sql = url
  ? neon(url)
  : ((null as unknown) as ReturnType<typeof neon>);

export type RoomSeat = {
  id: string;
  name: string;
  token: string;
  ready: boolean;
  isHost: boolean;
};

export type RoomRecord = {
  code: string;
  settings: unknown;
  seats: RoomSeat[];
  status: "lobby" | "playing" | "finished";
  game_id: string | null;
  created_at: string;
};

export type PublicSeat = Omit<RoomSeat, "token">;

export type PublicRoom = {
  code: string;
  seats: PublicSeat[];
  status: RoomRecord["status"];
  settings: unknown;
  hostName: string;
  playerCount: number;
};

export function makeCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function makeToken(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

export function publicRoom(room: RoomRecord): PublicRoom {
  return {
    code: room.code,
    seats: room.seats.map(({ token, ...rest }) => rest),
    status: room.status,
    settings: room.settings,
    hostName: room.seats.find((s) => s.isHost)?.name ?? "",
    playerCount: room.seats.length,
  };
}

export function seatAuth(room: RoomRecord, playerId: string, token: string): RoomSeat | null {
  const seat = room.seats.find((s) => s.id === playerId);
  if (!seat || seat.token !== token) return null;
  return seat;
}
