export function nextRandom(state: { rng: number }): number {
  let x = (state.rng + 0x6d2b79f5) | 0;
  state.rng = x >>> 0;
  let t = Math.imul(x ^ (x >>> 15), 1 | x);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: { rng: number }, min: number, max: number): number {
  return min + Math.floor(nextRandom(state) * (max - min + 1));
}

export function pick<T>(state: { rng: number }, arr: readonly T[]): T {
  return arr[Math.floor(nextRandom(state) * arr.length)];
}

export function shuffle<T>(state: { rng: number }, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
