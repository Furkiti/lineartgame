// Small feedback: a soft synthesized sound, a tick of haptics, an ink ring where you touched,
// and the easing curves the story animations share. Nothing here loads files.

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeInOut = (t: number) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t: number) => Math.pow(clamp01(t), 3);
/** Overshoots a little and settles — for things that pop into place. */
export const backOut = (t: number, s = 1.70158) => { t = clamp01(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
/** Springy settle, for hearts and stamps. */
export const elasticOut = (t: number) => { t = clamp01(t); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Exponential approach that is frame-rate independent. */
export const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ------------------------------------------------------------------ sound
let ctx: AudioContext | null = null, master: GainNode | null = null, muted = false;
try { muted = localStorage.getItem('ink-mute') === '1'; } catch {}
function audio() {
  if (ctx) return ctx;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
  return ctx;
}
/** Audio may only start after a touch: call this from the first pointerdown. */
export function wakeAudio() { const a = audio(); if (a && a.state === 'suspended') a.resume(); }
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('ink-mute', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : 0.5; }
export const isMuted = () => muted;

function tone(freq: number, { at = 0, dur = 0.6, gain = 0.15, type = 'sine' as OscillatorType, attack = 0.005 } = {}) {
  const a = audio(); if (!a || !master || muted) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise({ at = 0, dur = 0.12, gain = 0.12, freq = 2400, q = 0.8 } = {}) {
  const a = audio(); if (!a || !master || muted) return;
  const t0 = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
}
// pentatonic, so anything played together sounds kind
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
export const sfx = {
  /** a wooden tock: touching things */
  tap() { tone(660, { dur: 0.09, gain: 0.08, type: 'triangle' }); noise({ dur: 0.03, gain: 0.04, freq: 3000 }); },
  /** a glass wind-chime: something good happened */
  chime() { const f0 = PENTA[(Math.random() * 4) | 0] * 2; [1, 2.76, 5.4].forEach((k, i) => tone(f0 * k, { dur: 1.6 - i * 0.4, gain: 0.05 / (i + 1) })); },
  /** three rising notes: done */
  success() { [0, 2, 4, 7].forEach((n, i) => tone(PENTA[n % PENTA.length] * (n > 6 ? 2 : 1), { at: i * 0.09, dur: 0.9, gain: 0.07 })); },
  /** paper unfolding / brush */
  paper() { noise({ dur: 0.18, gain: 0.05, freq: 1800, q: 0.5 }); },
  /** a knife through fish */
  slice() { noise({ dur: 0.16, gain: 0.09, freq: 4200, q: 1.4 }); tone(1800, { dur: 0.05, gain: 0.02 }); },
  /** soft press */
  press() { tone(220, { dur: 0.12, gain: 0.06, type: 'triangle' }); },
  /** a little pop for hearts */
  pop() { tone(880, { dur: 0.12, gain: 0.06 }); tone(1320, { at: 0.05, dur: 0.18, gain: 0.04 }); },
  /** a shy no */
  nope() { tone(330, { dur: 0.15, gain: 0.05, type: 'triangle' }); tone(262, { at: 0.1, dur: 0.22, gain: 0.05, type: 'triangle' }); },
  /** rice stirring: a soft swish whose pitch follows speed */
  stir(speed: number) { noise({ dur: 0.08, gain: 0.025 + Math.min(0.04, speed * 0.004), freq: 900 + speed * 60, q: 0.6 }); },
  /** a hanko stamp */
  stamp() { tone(110, { dur: 0.2, gain: 0.12, type: 'sine' }); noise({ dur: 0.06, gain: 0.08, freq: 800 }); },
};
export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// ------------------------------------------------------------------ ink ring where you touch
export function inkRing(host: HTMLElement, clientX: number, clientY: number, big = false) {
  const r = host.getBoundingClientRect();
  const n = document.createElement('div');
  n.className = 'inkring' + (big ? ' big' : '');
  n.style.left = `${clientX - r.left}px`; n.style.top = `${clientY - r.top}px`;
  host.appendChild(n);
  setTimeout(() => n.remove(), 700);
}
