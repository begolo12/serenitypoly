let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("sp-muted", value ? "1" : "0");
}

export function isMuted() {
  return muted;
}

export function initMute() {
  if (typeof window === "undefined") return;
  muted = localStorage.getItem("sp-muted") === "1";
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "square", gain = 0.05) {
  const a = ac();
  if (!a || muted) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0.0001, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.02);
}

export const sfx = {
  click() {
    tone(520, 0, 0.04, "square", 0.02);
  },
  dice() {
    tone(180, 0, 0.05, "triangle", 0.06);
    tone(140, 0.07, 0.05, "triangle", 0.05);
    tone(320, 0.16, 0.06, "square", 0.04);
  },
  coin() {
    tone(880, 0, 0.06, "square", 0.04);
    tone(1180, 0.06, 0.08, "square", 0.035);
  },
  buy() {
    tone(660, 0, 0.07, "square", 0.05);
    tone(990, 0.08, 0.1, "square", 0.04);
  },
  rent() {
    tone(300, 0, 0.12, "sawtooth", 0.035);
    tone(220, 0.1, 0.14, "sawtooth", 0.03);
  },
  jail() {
    tone(140, 0, 0.16, "sawtooth", 0.06);
    tone(90, 0.14, 0.22, "sawtooth", 0.05);
  },
  turn() {
    tone(440, 0, 0.06, "square", 0.04);
    tone(660, 0.07, 0.08, "square", 0.04);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.22, "square", 0.05));
  },
  bad() {
    tone(220, 0, 0.18, "square", 0.05);
    tone(160, 0.14, 0.24, "square", 0.045);
  },
};
