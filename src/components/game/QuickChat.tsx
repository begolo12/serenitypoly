"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/engine/types";
import { CHAT_COOLDOWN_MS, QUICK_CHATS, type ChatMessage } from "@/lib/chat";
import { Button, Chip, Modal } from "@/components/ui/kit";
import { cn } from "@/lib/format";
import { sfx } from "@/lib/sfx";

const TOAST_MS = 6000;

type Props = {
  code: string;
  state: GameState;
  identity: { playerId: string; token: string } | null;
  enabled: boolean;
  tv: boolean;
};

function colorOf(state: GameState, playerId: string): string {
  return state.players.find((p) => p.id === playerId)?.color ?? "#FFD23F";
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function QuickChat({ code, state, identity, enabled, tv }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [coolUntil, setCoolUntil] = useState(0);
  const [, setTick] = useState(0);

  const openRef = useRef(false);
  openRef.current = open;
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const timersRef = useRef<Map<string, number>>(new Map());
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const pushToast = useCallback((message: ChatMessage) => {
    setToasts((prev) => [...prev.filter((m) => m.id !== message.id), message].slice(-3));
    const existing = timersRef.current.get(message.id);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((m) => m.id !== message.id));
      timersRef.current.delete(message.id);
    }, TOAST_MS);
    timersRef.current.set(message.id, timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = 0;

    const schedule = () => {
      if (alive) timer = window.setTimeout(load, 4000);
    };

    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) {
        schedule();
        return;
      }
      try {
        const res = await fetch(`/api/chats/${code}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { messages?: ChatMessage[] };
          const list = Array.isArray(data.messages) ? data.messages : [];
          if (!alive) return;
          setMessages(list);
          const fresh = list.filter((m) => !seenRef.current.has(m.id));
          list.forEach((m) => seenRef.current.add(m.id));
          if (!firstLoadRef.current && fresh.length > 0) {
            fresh.slice(-3).forEach(pushToast);
            if (!openRef.current) setUnread((n) => n + fresh.length);
            if (fresh.some((m) => m.playerId !== identityRef.current?.playerId)) sfx.reaction();
          }
          firstLoadRef.current = false;
        }
      } catch {
        /* diamkan, coba lagi di putaran berikutnya */
      }
      schedule();
    };

    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [code, pushToast]);

  useEffect(() => {
    if (coolUntil <= Date.now()) return;
    const timer = window.setInterval(() => setTick((v) => v + 1), 500);
    return () => window.clearInterval(timer);
  }, [coolUntil]);

  const cooling = coolUntil > Date.now();
  const canSend = Boolean(identity) && enabled && !cooling;

  const openPanel = () => {
    setOpen(true);
    setUnread(0);
  };

  const send = async (text: string) => {
    if (!identity || !canSend) return;
    setError("");
    setCoolUntil(Date.now() + CHAT_COOLDOWN_MS);
    sfx.click();
    try {
      const res = await fetch(`/api/chats/${code}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identity, text }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: ChatMessage; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim pesan");
        setCoolUntil(0);
        return;
      }
      if (data.message) {
        const message = data.message;
        seenRef.current.add(message.id);
        setMessages((prev) => [...prev.filter((m) => m.id !== message.id), message].slice(-50));
      }
    } catch {
      setError("Koneksi bermasalah");
      setCoolUntil(0);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        className="relative min-h-0 px-2.5 py-1.5 text-xs"
        onClick={openPanel}
        aria-label={unread > 0 ? `Quick chat, ${unread} pesan baru` : "Buka quick chat"}
      >
        💬
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-ink bg-tomato px-1 text-[9px] font-extrabold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-3 left-3 z-[55] flex w-[min(320px,calc(100vw-1.5rem))] flex-col gap-2"
      >
        {toasts.map((message) => (
          <div
            key={message.id}
            className="panel animate-[pop_0.2s_var(--ease-out-soft)] px-3 py-2"
            style={{ borderColor: "#16142B" }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-ink"
                style={{ background: colorOf(state, message.playerId) }}
              />
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.5px] text-ink-soft">
                {message.name}
              </span>
            </div>
            <div className="mt-0.5 text-xs font-bold leading-snug">{message.text}</div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={tv ? `Quick Chat · TV · ${code}` : `Quick Chat · ${code}`}
        width="max-w-md"
      >
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-ink/40 bg-tint px-3 py-4 text-center text-xs font-semibold text-ink-soft">
              Belum ada pesan. Mulai dengan salah satu frasa di bawah.
            </p>
          ) : (
            <div className="scroll-thin max-h-[38dvh] space-y-2 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div key={message.id} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-ink"
                    style={{ background: colorOf(state, message.playerId) }}
                  />
                  <div className="min-w-0 flex-1 rounded-2xl border-2 border-ink bg-white px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.5px] text-ink-soft">
                        {message.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-semibold text-ink-soft">
                        {clock(message.at)}
                      </span>
                    </div>
                    <div className="text-xs font-bold leading-snug">{message.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {identity ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-ink-soft">
                  Pilih frasa
                </span>
                {cooling ? (
                  <Chip color="#FFE4DD">Tunggu {Math.ceil((coolUntil - Date.now()) / 1000)}s</Chip>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_CHATS.map((text) => (
                  <button
                    key={text}
                    type="button"
                    disabled={!canSend}
                    onClick={() => void send(text)}
                    className={cn(
                      "rounded-2xl border-[2.5px] border-ink px-2.5 py-2 text-left text-xs font-bold transition-colors",
                      canSend ? "bg-white hover:bg-sun-pale active:scale-[0.98]" : "cursor-not-allowed bg-tint opacity-55",
                    )}
                  >
                    {text}
                  </button>
                ))}
              </div>
              {!enabled ? (
                <p className="text-[11px] font-semibold text-ink-soft">
                  Chat aktif saat permainan berjalan.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-[11px] font-semibold text-ink-soft">
              Mode papan TV hanya menampilkan pesan. Pemain mengirim dari HP masing-masing.
            </p>
          )}

          {error ? (
            <div className="rounded-2xl border-2 border-ink bg-tomato-pale px-3 py-1.5 text-[11px] font-bold">
              ⚠️ {error}
            </div>
          ) : null}

          <p className="text-center text-[10px] font-semibold text-ink-soft">
            Quick chat saja — tanpa chat bebas, demi kenyamanan semua pemain.
          </p>
        </div>
      </Modal>
    </>
  );
}
