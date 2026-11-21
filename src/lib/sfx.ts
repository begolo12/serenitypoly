export type BgmMood = "santai" | "semangat";

let ctx: AudioContext | null = null;
let muted = false;
let sfxVolume = 0.75;
let bgmVolume = 0.45;
let bgmMood: BgmMood = "santai";
let bgmTimer: number | null = null;
let bgmStep = 0;

// Slendro/pelog-inspired warm pentatonic frequencies (C4, E4, G4, A4, C5, A4, G4, D4)
const SANTAI_NOTES = [261.63, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 293.66];
// Upbeat party progression (C4, E4, G4, A4, C5, D5, E5, G4)
const PARTY_NOTES = [261.63, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 392.0];

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

export function getAudioSettings() {
  return { muted, sfxVolume, bgmVolume, bgmMood, bgmPlaying: bgmTimer !== null };
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("sp-muted", value ? "1" : "0");
  if (value) stopBgm();
}

export function setSfxVolume(vol: number) {
  sfxVolume = Math.max(0, Math.min(1, vol));
  if (typeof window !== "undefined") localStorage.setItem("sp-sfx-vol", String(sfxVolume));
}

export function setBgmVolume(vol: number) {
  bgmVolume = Math.max(0, Math.min(1, vol));
  if (typeof window !== "undefined") localStorage.setItem("sp-bgm-vol", String(bgmVolume));
  if (bgmVolume <= 0) stopBgm();
}

export function setBgmMood(mood: BgmMood) {
  bgmMood = mood;
  if (typeof window !== "undefined") localStorage.setItem("sp-bgm-mood", mood);
  if (bgmTimer !== null) {
    stopBgm();
    startBgm();
  }
}

export function isMuted() {
  return muted;
}

export function initMute() {
  if (typeof window === "undefined") return;
  muted = localStorage.getItem("sp-muted") === "1";
  const sv = Number(localStorage.getItem("sp-sfx-vol"));
  if (Number.isFinite(sv) && localStorage.getItem("sp-sfx-vol") !== null) {
    sfxVolume = Math.max(0, Math.min(1, sv));
  }
  const bv = Number(localStorage.getItem("sp-bgm-vol"));
  if (Number.isFinite(bv) && localStorage.getItem("sp-bgm-vol") !== null) {
    bgmVolume = Math.max(0, Math.min(1, bv));
  }
  const mood = localStorage.getItem("sp-bgm-mood");
  if (mood === "santai" || mood === "semangat") bgmMood = mood;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "triangle",
  gain = 0.045,
  endFreq?: number,
  channel: "sfx" | "bgm" = "sfx",
) {
  const a = ac();
  const vol = channel === "bgm" ? bgmVolume : sfxVolume;
  if (!a || muted || vol <= 0.005) return;
  const effectiveGain = Math.max(0.0005, gain * vol * 1.35);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  const t0 = a.currentTime + start;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(effectiveGain, t0 + Math.min(0.014, dur * 0.35));
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
  if (typeof window === "undefined" || bgmTimer !== null || muted || bgmVolume <= 0.005) return;
  const isParty = bgmMood === "semangat";
  const notes = isParty ? PARTY_NOTES : SANTAI_NOTES;
  const intervalMs = isParty ? 310 : 520;
  const tick = () => {
    if (muted || bgmVolume <= 0.005) return;
    const freq = notes[bgmStep % notes.length];
    tone(freq, 0, isParty ? 0.2 : 0.36, isParty ? "triangle" : "sine", isParty ? 0.016 : 0.015, undefined, "bgm");
    if (bgmStep % (isParty ? 2 : 4) === 0) {
      tone(freq * 0.5, 0, isParty ? 0.25 : 0.5, "triangle", isParty ? 0.015 : 0.012, undefined, "bgm");
    }
    if (isParty && bgmStep % 4 === 2) {
      tone(freq * 1.25, 0.06, 0.14, "sine", 0.01, undefined, "bgm");
    }
    bgmStep += 1;
  };
  tick();
  bgmTimer = window.setInterval(tick, intervalMs);
}

export function toggleBgm(): boolean {
  if (isBgmPlaying()) {
    stopBgm();
    return false;
  }
  if (muted) setMuted(false);
  if (bgmVolume <= 0.005) setBgmVolume(0.45);
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
  monopoly() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.18, "triangle", 0.055));
  },
  jackpot() {
    [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, i) => tone(f, i * 0.065, 0.22, "sine", 0.06));
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
  counterOffer() {
    tone(440, 0, 0.06, "triangle", 0.045);
    tone(587.33, 0.06, 0.1, "triangle", 0.05);
  },
  reaction() {
    tone(740, 0, 0.04, "sine", 0.035, 980);
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
