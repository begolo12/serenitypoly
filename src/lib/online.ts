import os from "node:os";
import { neon } from "@neondatabase/serverless";
import type { CharacterId, GameState } from "@/engine/types";

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
  isBot?: boolean;
  character?: CharacterId;
  tokenIndex?: number;
};

export type RoomRecord = {
  code: string;
  settings: unknown;
  seats: RoomSeat[];
  status: "lobby" | "playing" | "finished";
  game_id: string | null;
  created_at: string;
};

export type StoredRoom = RoomRecord & { host_token: string | null };

export type StoredGame = {
  id: string;
  code: string;
  state: GameState;
  version: number;
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

type MemoryStore = {
  rooms: Map<string, StoredRoom>;
  games: Map<string, StoredGame>;
};

const g = globalThis as unknown as { __spMemoryStore?: MemoryStore };

function mem(): MemoryStore {
  if (!g.__spMemoryStore) {
    g.__spMemoryStore = {
      rooms: new Map<string, StoredRoom>(),
      games: new Map<string, StoredGame>(),
    };
  }
  return g.__spMemoryStore;
}

export function getLanIp(): string | null {
  try {
    const nets = os.networkInterfaces();
    const candidates: Array<{ address: string; priority: number }> = [];
    for (const [name, list] of Object.entries(nets)) {
      if (!list) continue;
      const lower = name.toLowerCase();
      const isVirtual =
        lower.includes("vethernet") ||
        lower.includes("virtual") ||
        lower.includes("vmware") ||
        lower.includes("vbox") ||
        lower.includes("docker") ||
        lower.includes("wsl") ||
        lower.includes("tailscale") ||
        lower.includes("hamachi");
      for (const iface of list) {
        if (iface.family !== "IPv4" || iface.internal) continue;
        const addr = iface.address;
        let priority = isVirtual ? 0 : 10;
        if (addr.startsWith("192.168.")) priority += 5;
        else if (addr.startsWith("10.")) priority += 3;
        else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(addr)) priority += 2;
        if (lower.includes("wi-fi") || lower.includes("wifi") || lower.includes("wlan")) priority += 4;
        candidates.push({ address: addr, priority });
      }
    }
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0]?.address ?? null;
  } catch {
    return null;
  }
}

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
    seats: room.seats.map(({ token: _token, ...rest }) => rest),
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

export async function dbCreateRoom(input: {
  code: string;
  settings: unknown;
  seats: RoomSeat[];
  status: RoomRecord["status"];
  hostToken: string;
}): Promise<StoredRoom> {
  const code = input.code.toUpperCase();
  const room: StoredRoom = {
    code,
    settings: input.settings,
    seats: input.seats,
    status: input.status,
    game_id: null,
    created_at: new Date().toISOString(),
    host_token: input.hostToken,
  };
  if (hasDb) {
    try {
      await sql`
        insert into sp_rooms (code, settings, seats, status, host_token)
        values (${code}, ${JSON.stringify(input.settings)}::jsonb, ${JSON.stringify(input.seats)}::jsonb, ${input.status}, ${input.hostToken})
      `;
      return room;
    } catch (err) {
      console.warn("dbCreateRoom fallback to memory store:", err);
    }
  }
  mem().rooms.set(code, room);
  return room;
}

export async function dbGetRoom(code: string): Promise<StoredRoom | null> {
  const upper = code.toUpperCase();
  if (hasDb) {
    try {
      const rows = (await sql`
        select code, settings, seats, status, game_id, created_at, host_token
        from sp_rooms where code = ${upper} limit 1
      `) as StoredRoom[];
      if (rows[0]) return rows[0];
    } catch (err) {
      console.warn("dbGetRoom fallback to memory store:", err);
    }
  }
  return mem().rooms.get(upper) ?? null;
}

export async function dbUpdateRoom(
  code: string,
  patch: Partial<Pick<RoomRecord, "seats" | "status" | "game_id">>,
): Promise<void> {
  const upper = code.toUpperCase();
  let updatedDb = false;
  if (hasDb) {
    try {
      if (patch.seats !== undefined) {
        await sql`update sp_rooms set seats = ${JSON.stringify(patch.seats)}::jsonb, updated_at = now() where code = ${upper}`;
      }
      if (patch.status !== undefined && patch.game_id !== undefined) {
        await sql`update sp_rooms set status = ${patch.status}, game_id = ${patch.game_id}, updated_at = now() where code = ${upper}`;
      } else if (patch.status !== undefined) {
        await sql`update sp_rooms set status = ${patch.status}, updated_at = now() where code = ${upper}`;
      } else if (patch.game_id !== undefined) {
        await sql`update sp_rooms set game_id = ${patch.game_id}, updated_at = now() where code = ${upper}`;
      }
      updatedDb = true;
    } catch (err) {
      console.warn("dbUpdateRoom fallback to memory store:", err);
    }
  }
  const existing = mem().rooms.get(upper);
  if (existing || !updatedDb) {
    if (existing) {
      mem().rooms.set(upper, {
        ...existing,
        ...(patch.seats !== undefined ? { seats: patch.seats } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.game_id !== undefined ? { game_id: patch.game_id } : {}),
      });
    }
  }
}

export async function dbCreateGame(input: {
  id: string;
  code: string;
  state: GameState;
}): Promise<StoredGame> {
  const upper = input.code.toUpperCase();
  const game: StoredGame = {
    id: input.id,
    code: upper,
    state: input.state,
    version: 1,
  };
  if (hasDb) {
    try {
      await sql`
        insert into sp_games (id, code, state, version)
        values (${input.id}, ${upper}, ${JSON.stringify(input.state)}::jsonb, 1)
      `;
      return game;
    } catch (err) {
      console.warn("dbCreateGame fallback to memory store:", err);
    }
  }
  mem().games.set(upper, game);
  return game;
}

export async function dbGetGame(code: string): Promise<StoredGame | null> {
  const upper = code.toUpperCase();
  if (hasDb) {
    try {
      const rows = (await sql`
        select id, code, state, version from sp_games where code = ${upper} limit 1
      `) as StoredGame[];
      if (rows[0]) return rows[0];
    } catch (err) {
      console.warn("dbGetGame fallback to memory store:", err);
    }
  }
  return mem().games.get(upper) ?? null;
}

export async function dbUpdateGame(
  code: string,
  id: string,
  expectedVersion: number,
  state: GameState,
): Promise<number | null> {
  const upper = code.toUpperCase();
  if (hasDb) {
    try {
      const updated = (await sql`
        update sp_games
        set state = ${JSON.stringify(state)}::jsonb, version = version + 1, updated_at = now()
        where id = ${id} and version = ${expectedVersion}
        returning version
      `) as Array<{ version: number }>;
      if (updated.length > 0) return updated[0].version;
      const inMem = mem().games.get(upper);
      if (!inMem) return null;
    } catch (err) {
      console.warn("dbUpdateGame fallback to memory store:", err);
    }
  }
  const existing = mem().games.get(upper);
  if (!existing || existing.id !== id || existing.version !== expectedVersion) return null;
  const nextVersion = existing.version + 1;
  mem().games.set(upper, { ...existing, state, version: nextVersion });
  return nextVersion;
}

export async function dbResetGame(code: string, state: GameState): Promise<StoredGame> {
  const upper = code.toUpperCase();
  const existing = await dbGetGame(upper);
  if (!existing) {
    return dbCreateGame({ id: `g_${upper}_${Math.random().toString(36).slice(2, 10)}`, code: upper, state });
  }
  if (hasDb) {
    try {
      const rows = (await sql`
        update sp_games
        set state = ${JSON.stringify(state)}::jsonb, version = version + 1, updated_at = now()
        where id = ${existing.id}
        returning id, code, state, version
      `) as StoredGame[];
      if (rows[0]) {
        mem().games.set(upper, rows[0]);
        return rows[0];
      }
    } catch (err) {
      console.warn("dbResetGame fallback to memory store:", err);
    }
  }
  const next: StoredGame = { ...existing, state, version: existing.version + 1 };
  mem().games.set(upper, next);
  return next;
}
