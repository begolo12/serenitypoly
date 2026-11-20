export function rp(value: number): string {
  const rounded = Math.round(value);
  return `Rp ${rounded.toLocaleString("id-ID")}`;
}

export function rpShort(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `${value}`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
