"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "primary" | "default" | "ghost" | "danger" | "mint" | "sky";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  default: "",
  ghost: "btn-ghost",
  danger: "bg-red text-white",
  mint: "bg-mint",
  sky: "bg-sky",
};

export function Button({
  variant = "default",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={cn("btn", variantClass[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Chip({
  children,
  color,
  className,
  title,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("chip", className)}
      style={color ? { background: color } : undefined}
      title={title}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
  dismissable = true,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  dismissable?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-6">
      <div
        className={cn(
          "panel max-h-[92dvh] w-full overflow-hidden animate-[slide-up_0.24s_ease-out] sm:rounded-none",
          width,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink bg-yellow px-4 py-3">
          <h2 className="font-display text-base uppercase tracking-tight">{title}</h2>
          {dismissable ? (
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-9 w-9 items-center justify-center border-[3px] border-ink bg-surface text-lg font-bold shadow-[2px_2px_0_#0A0A0A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              ✕
            </button>
          ) : null}
        </header>
        <div className="scroll-thin max-h-[70dvh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <footer className="border-t-[3px] border-ink bg-muted px-4 py-3">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="border-[3px] border-ink bg-surface px-2 py-1.5" style={accent ? { background: accent } : undefined}>
      <div className="text-[9px] font-bold uppercase tracking-[0.08em] opacity-70">{label}</div>
      <div className="money text-sm font-bold">{value}</div>
    </div>
  );
}
