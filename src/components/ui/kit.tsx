"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/format";

const INK_LUMINANCE = 0.0085;

function readableText(hex?: string): string | undefined {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const channel = (start: number) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (INK_LUMINANCE + 0.05);
  return onInk >= onWhite ? "#16142B" : "#FFFFFF";
}

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
  const foreground = readableText(color);
  return (
    <span
      className={cn("chip", className)}
      style={color ? { background: color, color: foreground } : undefined}
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const modalStack: HTMLElement[] = [];
let bodyLocks = 0;
let bodyOverflow = "";

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
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissableRef = useRef(dismissable);
  dismissableRef.current = dismissable;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (panel) modalStack.push(panel);
    if (bodyLocks === 0) {
      bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    bodyLocks += 1;

    const focusables = () => {
      if (!panel) return [];
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
      );
    };

    const focusTimer = window.setTimeout(() => {
      const first = focusables()[0] ?? panel;
      first?.focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== panel) return;
      if (e.key === "Escape") {
        if (dismissableRef.current) {
          e.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = focusables();
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey, true);
      const index = panel ? modalStack.indexOf(panel) : -1;
      if (index >= 0) modalStack.splice(index, 1);
      bodyLocks = Math.max(0, bodyLocks - 1);
      if (bodyLocks === 0) document.body.style.overflow = bodyOverflow;
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "panel max-h-[92dvh] w-full overflow-hidden rounded-b-none animate-[pop_0.22s_var(--ease-out-soft)] outline-none sm:rounded-[28px]",
          width,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center justify-between gap-3 border-b-[2.5px] border-ink bg-sun px-4 py-3 sm:px-5 sm:py-3.5">
          <h2 id={titleId} className="font-display text-base font-extrabold tracking-tight sm:text-lg">
            {title}
          </h2>
          {dismissable ? (
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-ink bg-white text-sm font-bold transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9 sm:text-base"
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
