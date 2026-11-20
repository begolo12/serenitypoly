"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Chip } from "@/components/ui/kit";
import { QrCode } from "@/components/game/QrCode";
import { cn } from "@/lib/format";
import type { PublicRoom } from "@/lib/online";

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

  useEffect(() => {
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
    setRoom(data.room);
    if (data.room.status === "playing") router.replace(`/g/${code}`);
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal gabung");
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
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!identity) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/rooms/${code}/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(identity),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mulai");
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
  const joinUrl = `${origin}/room/${code}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Room online</div>
          <h1 className="font-display text-3xl uppercase leading-none">
            {code.slice(0, 3)}
            <span className="bg-yellow px-1">{code.slice(3)}</span>
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            className="text-xs"
            onClick={async () => {
              await navigator.clipboard?.writeText(joinUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Tersalin" : "Salin link"}
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
        <div className="panel p-3">
          <h2 className="font-display text-lg uppercase">Pemain</h2>
          <div className="mt-2 space-y-2">
            {[0, 1, 2, 3].map((i) => {
              const seat = room?.seats[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 border-[3px] border-ink p-2",
                    seat ? "bg-surface" : "border-dashed bg-muted/50",
                  )}
                >
                  <span className="w-5 font-display text-sm">{i + 1}</span>
                  <span className="flex-1 truncate text-sm font-bold">
                    {seat ? seat.name : "Menunggu pemain…"}
                  </span>
                  {seat?.isHost ? <Chip color="#FFD43B">HOST</Chip> : null}
                  {seat ? (
                    <Chip color={seat.ready ? "#3DDC97" : "#EFE9DA"}>{seat.ready ? "SIAP" : "BELUM"}</Chip>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!identity ? (
            <div className="mt-3 flex gap-2">
              <input
                className="field flex-1 text-sm"
                placeholder="Nama kamu"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Button variant="primary" onClick={join} disabled={busy || (room?.seats.length ?? 0) >= 4}>
                Gabung
              </Button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={me?.ready ? "default" : "primary"} onClick={toggleReady} disabled={busy}>
                {me?.ready ? "Batalkan Siap" : "Siap"}
              </Button>
              {isHost ? (
                <Button variant="mint" onClick={start} disabled={busy || !allReady || (room?.seats.length ?? 0) < 2}>
                  Mulai Game
                </Button>
              ) : (
                <div className="flex items-center justify-center border-[3px] border-dashed border-ink/40 text-[10px] font-bold uppercase opacity-60">
                  Menunggu host
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-[10px] font-bold uppercase opacity-60">
            Minimal 2 pemain, maksimal 4. Semua harus menekan Siap.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2">
          {joinUrl ? <QrCode value={joinUrl} size={200} /> : null}
          <p className="max-w-[220px] break-all text-center text-[10px] font-bold uppercase opacity-60">{joinUrl}</p>
        </div>
      </section>
    </main>
  );
}
