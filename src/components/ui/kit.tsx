"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";

type Variant = "primary" | "sun" | "default" | "ghost" | "danger" | "mint" | "sky" | "blue";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  sun: "btn-sun",
  default: "",
  ghost: "btn-ghost",
  danger: "bg-tomato text-white hover:brightness-105",
  mint: "btn-mint",
  sky: "btn-blue",
  blue: "btn-blue",
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
  const darkBg = color === "#2F5BFF" || color === "#FF5A3C" || color === "#7C4DFF" || color === "#16142B";
  return (
    <span
      className={cn("chip", darkBg && "text-white", className)}
      style={color ? { background: color } : undefined}
      title={title}
    >
      {children}
    </span>
  );
}

export function Tooltip({
  tip,
  position = "top",
  children,
  className,
}: {
  tip?: string | null;
  position?: "top" | "bottom";
  children: ReactNode;
  className?: string;
}) {
  if (!tip) return <>{children}</>;
  const posCls =
    position === "bottom"
      ? "top-full left-1/2 mt-1.5 -translate-x-1/2"
      : "bottom-full left-1/2 mb-1.5 -translate-x-1/2";
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[80] hidden w-max max-w-[230px] rounded-xl border-2 border-ink bg-ink px-2.5 py-1.5 text-center text-[11px] font-semibold leading-snug text-white opacity-0 scale-95 transition-all duration-150 ease-out sm:block group-hover/tip:opacity-100 group-hover/tip:scale-100 group-focus-within/tip:opacity-100 group-focus-within/tip:scale-100",
          posCls,
        )}
      >
        {tip}
      </span>
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        className={cn(
          "panel max-h-[92dvh] w-full overflow-hidden rounded-b-none animate-[pop_0.22s_var(--ease-out-soft)] sm:rounded-[28px]",
          width,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between gap-3 border-b-[2.5px] border-ink bg-sun px-4 py-3 sm:px-5 sm:py-3.5">
          <h2 className="font-display text-base font-extrabold tracking-tight sm:text-lg">{title}</h2>
          {dismissable ? (
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] border-ink bg-white text-sm font-bold transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9 sm:text-base"
            >
              ✕
            </button>
          ) : null}
        </header>
        <div className="scroll-thin max-h-[72dvh] overflow-y-auto px-4 py-3.5 sm:max-h-[70dvh] sm:px-5 sm:py-4">{children}</div>
        {footer ? (
          <footer className="border-t-[2.5px] border-ink bg-tint px-4 py-2.5 sm:px-5 sm:py-3">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div
      className="rounded-2xl border-[2.5px] border-ink bg-tint px-3 py-2"
      style={accent ? { background: accent } : undefined}
    >
      <div className="text-[11px] font-semibold text-ink-soft">{label}</div>
      <div className="money text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
