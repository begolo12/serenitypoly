let ctx: AudioContext | null = null;
let muted = false;
let bgmTimer: number | null = null;
let bgmStep = 0;

// Slendro/pelog-inspired warm pentatonic frequencies (C4, D4, E4, G4, A4, C5, D5, E5)
const BGM_NOTES = [261.63, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 293.66];

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("sp-muted", value ? "1" : "0");
  if (value) stopBgm();
}

export function isMuted() {
  return muted;
}

export function initMute() {
  if (typeof window === "undefined") return;
  muted = localStorage.getItem("sp-muted") === "1";
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "triangle",
  gain = 0.045,
  endFreq?: number,
) {
  const a = ac();
  if (!a || muted) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  const t0 = a.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.014, dur * 0.35));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.025);
}

export function isBgmPlaying(): boolean {
  return bgmTimer !== null;
}

export function stopBgm() {
  if (typeof window !== "undefined" && bgmTimer !== null) {
    window.clearInterval(bgmTimer);
  }
  bgmTimer = null;
}

export function startBgm() {
  if (typeof window === "undefined" || bgmTimer !== null || muted) return;
  const tick = () => {
    if (muted) return;
    const freq = BGM_NOTES[bgmStep % BGM_NOTES.length];
    tone(freq, 0, 0.36, "sine", 0.015);
    if (bgmStep % 4 === 0) {
      tone(freq * 0.5, 0, 0.5, "triangle", 0.012);
    }
    bgmStep += 1;
  };
  tick();
  bgmTimer = window.setInterval(tick, 520);
}

export function toggleBgm(): boolean {
  if (isBgmPlaying()) {
    stopBgm();
    return false;
  }
  if (muted) setMuted(false);
  startBgm();
  return isBgmPlaying();
}

export const sfx = {
  click() {
    tone(540, 0, 0.045, "triangle", 0.028, 620);
  },
  step() {
    tone(380, 0, 0.038, "triangle", 0.03, 520);
  },
  dice() {
    tone(190, 0, 0.055, "triangle", 0.06, 130);
    tone(250, 0.065, 0.055, "triangle", 0.055, 175);
    tone(330, 0.13, 0.055, "triangle", 0.05, 420);
    tone(520, 0.19, 0.07, "sine", 0.045, 640);
  },
  coin() {
    tone(987.77, 0, 0.06, "triangle", 0.045);
    tone(1318.51, 0.055, 0.12, "sine", 0.05);
  },
  buy() {
    tone(523.25, 0, 0.07, "triangle", 0.05);
    tone(659.25, 0.065, 0.08, "triangle", 0.05);
    tone(1046.5, 0.13, 0.14, "sine", 0.045);
  },
  build() {
    tone(440, 0, 0.07, "triangle", 0.045);
    tone(554.37, 0.07, 0.07, "triangle", 0.045);
    tone(659.25, 0.14, 0.13, "triangle", 0.05);
  },
  auction() {
    tone(260, 0, 0.06, "triangle", 0.055, 150);
    tone(780, 0.06, 0.1, "sine", 0.04);
  },
  card() {
    tone(587.33, 0, 0.06, "sine", 0.04, 880);
    tone(880, 0.07, 0.09, "triangle", 0.035);
  },
  event() {
    tone(440, 0, 0.11, "sawtooth", 0.032, 415);
    tone(622.25, 0.12, 0.18, "triangle", 0.045);
  },
  join() {
    tone(587.33, 0, 0.08, "sine", 0.04);
    tone(880, 0.08, 0.12, "sine", 0.045);
  },
  rent() {
    tone(320, 0, 0.12, "sawtooth", 0.035, 240);
    tone(220, 0.1, 0.16, "triangle", 0.04, 170);
  },
  jail() {
    tone(175, 0, 0.16, "sawtooth", 0.055, 120);
    tone(110, 0.14, 0.24, "sawtooth", 0.05, 85);
  },
  turn() {
    tone(440, 0, 0.055, "sine", 0.04);
    tone(659.25, 0.065, 0.09, "sine", 0.045);
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) =>
      tone(f, i * 0.11, 0.24, "triangle", 0.055),
    );
  },
  bad() {
    tone(240, 0, 0.15, "sawtooth", 0.04, 180);
    tone(170, 0.12, 0.22, "triangle", 0.045, 130);
  },
};
