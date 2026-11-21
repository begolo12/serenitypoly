import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL wajib diisi");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  await sql`
    create table if not exists sp_rooms (
      code text primary key,
      settings jsonb not null,
      seats jsonb not null default '[]'::jsonb,
      status text not null default 'lobby',
      game_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists sp_games (
      id text primary key,
      code text not null unique,
      state jsonb not null,
      version integer not null default 1,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists sp_games_code_idx on sp_games (code)`;
  await sql`create index if not exists sp_rooms_updated_idx on sp_rooms (updated_at)`;
  await sql`alter table sp_rooms add column if not exists host_token text`;
  await sql`
    create table if not exists sp_chats (
      id text primary key,
      code text not null,
      player_id text not null,
      name text not null,
      text text not null,
      at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists sp_chats_code_idx on sp_chats (code, at)`;
  await sql`
    create table if not exists sp_rate_limits (
      key text primary key,
      window_start timestamptz not null default now(),
      count integer not null default 0
    )
  `;
  await sql`create index if not exists sp_rate_limits_window_idx on sp_rate_limits (window_start)`;
  console.log("skema siap");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
