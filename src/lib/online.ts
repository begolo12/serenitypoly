import os from "node:os";
import { randomBytes, randomInt } from "node:crypto";
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
  reconnectKey: string;
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

export type PublicSeat = Omit<RoomSeat, "token" | "reconnectKey">;

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
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export function makeToken(): string {
  return randomBytes(24).toString("base64url");
}

export function publicRoom(room: RoomRecord): PublicRoom {
  return {
    code: room.code,
    seats: room.seats.map(({ token: _token, reconnectKey: _key, ...rest }) => rest),
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

export function hostAuth(
  room: RoomRecord & { host_token?: string | null },
  hostToken?: string,
  playerId?: string,
  token?: string,
): boolean {
  if (hostToken && room.host_token && hostToken === room.host_token) return true;
  return Boolean(seatAuth(room, playerId ?? "", token ?? "")?.isHost);
}

/**
 * Menyembunyikan informasi privat dari state yang dikirim ke klien:
 * misi & kartu tangan pemain lain, serta state RNG (yang membuat dadu bisa diprediksi).
 */
export function redactState(state: GameState, viewerId: string | null): GameState {
  return {
    ...state,
    seed: 0,
    rng: 0,
    players: state.players.map((p) =>
      p.id === viewerId ? p : { ...p, mission: "", hand: p.hand.map(() => "?") },
    ),
  };
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
    await sql`
      insert into sp_rooms (code, settings, seats, status, host_token)
      values (${code}, ${JSON.stringify(input.settings)}::jsonb, ${JSON.stringify(input.seats)}::jsonb, ${input.status}, ${input.hostToken})
    `;
    return room;
  }
  mem().rooms.set(code, room);
  return room;
}

export async function dbGetRoom(code: string): Promise<StoredRoom | null> {
  const upper = code.toUpperCase();
  if (hasDb) {
    const rows = (await sql`
      select code, settings, seats, status, game_id, created_at, host_token
      from sp_rooms where code = ${upper} limit 1
    `) as StoredRoom[];
    return rows[0] ?? null;
  }
  return mem().rooms.get(upper) ?? null;
}

export async function dbUpdateRoom(
  code: string,
  patch: Partial<Pick<RoomRecord, "seats" | "status" | "game_id">>,
): Promise<void> {
  const upper = code.toUpperCase();
  if (hasDb) {
    if (patch.game_id === null) {
      await sql`
        update sp_rooms set
          seats = coalesce(${patch.seats !== undefined ? JSON.stringify(patch.seats) : null}::jsonb, seats),
          status = coalesce(${patch.status ?? null}, status),
          game_id = null,
          updated_at = now()
        where code = ${upper}
      `;
      return;
    }
    await sql`
      update sp_rooms set
        seats = coalesce(${patch.seats !== undefined ? JSON.stringify(patch.seats) : null}::jsonb, seats),
        status = coalesce(${patch.status ?? null}, status),
        game_id = coalesce(${patch.game_id ?? null}, game_id),
        updated_at = now()
      where code = ${upper}
    `;
    return;
  }
  const existing = mem().rooms.get(upper);
  if (existing) {
    mem().rooms.set(upper, {
      ...existing,
      ...(patch.seats !== undefined ? { seats: patch.seats } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.game_id !== undefined ? { game_id: patch.game_id } : {}),
    });
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
    await sql`
      insert into sp_games (id, code, state, version)
      values (${input.id}, ${upper}, ${JSON.stringify(input.state)}::jsonb, 1)
    `;
    return game;
  }
  mem().games.set(upper, game);
  return game;
}

export async function dbGetGame(code: string): Promise<StoredGame | null> {
  const upper = code.toUpperCase();
  if (hasDb) {
    const rows = (await sql`
      select id, code, state, version from sp_games where code = ${upper} limit 1
    `) as StoredGame[];
    return rows[0] ?? null;
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
    const updated = (await sql`
      update sp_games
      set state = ${JSON.stringify(state)}::jsonb, version = version + 1, updated_at = now()
      where id = ${id} and version = ${expectedVersion}
      returning version
    `) as Array<{ version: number }>;
    return updated[0]?.version ?? null;
  }
  const existing = mem().games.get(upper);
  if (!existing || existing.id !== id || existing.version !== expectedVersion) return null;
  const nextVersion = existing.version + 1;
  mem().games.set(upper, { ...existing, state, version: nextVersion });
  return nextVersion;
}

export async function dbResetGame(code: string, state: GameState): Promise<StoredGame> {
  const upper = code.toUpperCase();
  if (hasDb) {
    const rows = (await sql`
      update sp_games
      set state = ${JSON.stringify(state)}::jsonb, version = version + 1, updated_at = now()
      where code = ${upper}
      returning id, code, state, version
    `) as StoredGame[];
    if (rows[0]) return rows[0];
    return dbCreateGame({ id: `g_${upper}_${makeToken().slice(0, 10)}`, code: upper, state });
  }
  const existing = mem().games.get(upper);
  if (!existing) {
    return dbCreateGame({ id: `g_${upper}_${makeToken().slice(0, 10)}`, code: upper, state });
  }
  const next: StoredGame = { ...existing, state, version: existing.version + 1 };
  mem().games.set(upper, next);
  return next;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

/** Rate limit sederhana yang tetap berlaku lintas instance serverless (disimpan di DB). */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!hasDb) return true;
  const rows = (await sql`
    insert into sp_rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case
        when sp_rate_limits.window_start < now() - (${windowMs}::int * interval '1 millisecond') then 1
        else sp_rate_limits.count + 1
      end,
      window_start = case
        when sp_rate_limits.window_start < now() - (${windowMs}::int * interval '1 millisecond') then now()
        else sp_rate_limits.window_start
      end
    returning count
  `) as Array<{ count: number }>;
  return (rows[0]?.count ?? 1) <= limit;
}
