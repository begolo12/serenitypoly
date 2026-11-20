"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PLAYER_COLORS, TOKENS } from "@/engine/data";
import { Button, Chip } from "@/components/ui/kit";
import { QrCode } from "@/components/game/QrCode";
import { cn } from "@/lib/format";
import type { PublicRoom } from "@/lib/online";
import { initMute, sfx } from "@/lib/sfx";

type Identity = { playerId: string; token: string };

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code ?? "").toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [lanIp, setLanIp] = useState<string | null>(null);
  const [useLan, setUseLan] = useState(true);
  const prevSeats = useRef<number | null>(null);

  useEffect(() => {
    initMute();
    setOrigin(window.location.origin);
    if (!code) return;
    const raw = localStorage.getItem(`sp-seat-${code}`);
    if (raw) {
      try {
        setIdentity(JSON.parse(raw) as Identity);
      } catch {
        /* ignore */
      }
    }
  }, [code]);

  const refresh = useCallback(async () => {
    if (!code) return;
    const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Room tidak ditemukan");
      return;
    }
    setErr("");
    const nextRoom = data.room as PublicRoom;
    if (prevSeats.current !== null && nextRoom.seats.length > prevSeats.current) {
      sfx.join();
    }
    prevSeats.current = nextRoom.seats.length;
    setRoom(nextRoom);
    if (data.lanIp) setLanIp(data.lanIp as string);
    if (nextRoom.status === "playing") {
      router.replace(`/g/${code}`);
    }
  }, [code, router]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 1500);
    return () => window.clearInterval(id);
  }, [refresh]);

  const join = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Pemain" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal gabung");
      const idn: Identity = { playerId: data.playerId, token: data.token };
      localStorage.setItem(`sp-seat-${code}`, JSON.stringify(idn));
      setIdentity(idn);
      setRoom(data.room);
      sfx.join();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal gabung");
    } finally {
      setBusy(false);
    }
  };

  const botAction = async (payload: { addBot?: boolean; removeBot?: boolean }) => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengubah bot");
      setRoom(data.room);
      sfx.click();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengubah bot");
    } finally {
      setBusy(false);
    }
  };

  const toggleReady = async () => {
    if (!identity) return;
    setBusy(true);
    try {
      const me = room?.seats.find((s) => s.id === identity.playerId);
      await fetch(`/api/rooms/${code}/ready`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identity, ready: !me?.ready }),
      });
      sfx.click();
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const start = async (forceReady = false) => {
    if (!identity) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identity, forceReady }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mulai");
      sfx.turn();
      router.replace(`/g/${code}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mulai");
    } finally {
      setBusy(false);
    }
  };

  const me = room?.seats.find((s) => s.id === identity?.playerId);
  const isHost = Boolean(me?.isHost);
  const allReady = Boolean(room?.seats.length && room.seats.every((s) => s.ready));
  const hasBot = Boolean(room?.seats.some((s) => s.isBot));

  const isLocalhost = useMemo(() => {
    if (!origin) return false;
    try {
      const u = new URL(origin);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }, [origin]);

  const joinUrl = useMemo(() => {
    if (!origin) return "";
    if (isLocalhost && lanIp && useLan) {
      try {
        const u = new URL(origin);
        const port = u.port ? `:${u.port}` : "";
        return `${u.protocol}//${lanIp}${port}/room/${code}`;
      } catch {
        /* fallback */
      }
    }
    return `${origin}/room/${code}`;
  }, [origin, isLocalhost, lanIp, useLan, code]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Lobi Kontroler · Room</div>
          <h1 className="font-display text-4xl uppercase leading-none tracking-wider">
            {code.slice(0, 3)}
            <span className="bg-yellow px-1.5">{code.slice(3)}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="text-xs"
            onClick={async () => {
              await navigator.clipboard?.writeText(joinUrl);
              setCopied(true);
              sfx.click();
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "✓ Tersalin" : "Salin Link"}
          </Button>
          <Button variant="ghost" className="text-xs" onClick={() => router.push(`/watch/${code}`)}>
            📺 Papan TV
          </Button>
          <Button variant="ghost" className="text-xs" onClick={() => router.push("/")}>
            ← Menu
          </Button>
        </div>
      </div>

      {err ? (
        <div className="mt-3 border-[3px] border-ink bg-red/20 p-2 text-xs font-bold uppercase">{err}</div>
      ) : null}

      <section className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg uppercase">Pemain ({room?.seats.length ?? 0}/4)</h2>
            {isHost ? (
              <div className="flex gap-1">
                <Button
                  className="min-h-0 px-2 py-1 text-[10px]"
                  disabled={busy || (room?.seats.length ?? 0) >= 4}
                  onClick={() => botAction({ addBot: true })}
                >
                  + Bot
                </Button>
                {hasBot ? (
                  <Button
                    className="min-h-0 px-2 py-1 text-[10px]"
                    disabled={busy}
                    onClick={() => botAction({ removeBot: true })}
                  >
                    − Bot
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {[0, 1, 2, 3].map((i) => {
              const seat = room?.seats[i];
              const isMe = seat?.id === identity?.playerId;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 border-[3px] border-ink p-2",
                    seat ? "bg-surface" : "border-dashed bg-muted/50",
                    isMe && "bg-yellow/25",
                  )}
                  style={seat ? { borderLeft: `8px solid ${PLAYER_COLORS[i]}` } : undefined}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-sm" style={{ background: seat ? PLAYER_COLORS[i] : "#EFE9DA" }}>
                    {seat ? TOKENS[i] : i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold">
                    {seat ? seat.name : "Menunggu pemain…"}
                    {isMe ? " (Kamu)" : ""}
                  </span>
                  {seat?.isHost ? <Chip color="#FFD43B">HOST</Chip> : null}
                  {seat?.isBot ? <Chip color="#9B7BFF">BOT</Chip> : null}
                  {seat ? (
                    <Chip color={seat.ready ? "#3DDC97" : "#EFE9DA"}>{seat.ready ? "SIAP ✓" : "BELUM"}</Chip>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!identity ? (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input
                  className="field flex-1 text-sm"
                  placeholder="Nama kamu di game"
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !busy && (room?.seats.length ?? 0) < 4) void join();
                  }}
                />
                <Button variant="primary" onClick={join} disabled={busy || (room?.seats.length ?? 0) >= 4}>
                  Gabung
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button variant={me?.ready ? "default" : "primary"} onClick={toggleReady} disabled={busy}>
                  {me?.ready ? "Batalkan Siap" : "✓ Saya Siap!"}
                </Button>
                {isHost ? (
                  <Button
                    variant="mint"
                    onClick={() => start(!allReady)}
                    disabled={busy || (room?.seats.length ?? 0) < 2}
                  >
                    {allReady ? "▶ Mulai Game" : "▶ Paksa Mulai"}
                  </Button>
                ) : (
                  <div className="flex items-center justify-center border-[3px] border-dashed border-ink/40 px-2 text-center text-[10px] font-bold uppercase opacity-60">
                    Menunggu host / TV memulai
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="mt-3 text-[10px] font-bold uppercase opacity-60">
            Minimal 2 pemain (atau 1 pemain + Bot), maksimal 4 pemain.
          </p>
        </div>

        <div className="panel flex flex-col items-center gap-2 p-3">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Scan QR untuk Gabung</div>
          {joinUrl ? <QrCode value={joinUrl} size={196} /> : null}
          <div className="border-[2px] border-ink bg-yellow px-3 py-1 font-mono text-lg font-bold tracking-[0.2em]">
            {code}
          </div>
          {isLocalhost && lanIp ? (
            <button
              type="button"
              onClick={() => setUseLan((v) => !v)}
              className="border-2 border-ink bg-muted px-2 py-1 text-[10px] font-bold uppercase"
            >
              {useLan ? `Wi-Fi LAN: ${lanIp}` : "Mode Localhost"} (Ganti)
            </button>
          ) : null}
          <p className="max-w-[216px] break-all text-center text-[10px] font-bold opacity-60">{joinUrl}</p>
        </div>
      </section>
    </main>
  );
}
