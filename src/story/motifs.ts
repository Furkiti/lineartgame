// Every drawing that ends up in the world starts from a reference: a faint outline on the paper
// that you go over stroke by stroke. Your hand stays in the line (the result is a blend of your
// stroke and the outline), but it always reads as what it is meant to be.
// Coordinates are the drawing paper's: 240 × 260, drawable from 10 to 230 / 250.
import type { Vec } from '../lib/ink.ts';

const rad = (d: number) => d * Math.PI / 180;
/** points along an ellipse arc, from a0 to a1 degrees (0° is +x, 90° is down) */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 18): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => { const a = rad(a0 + (a1 - a0) * i / n); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Vec; });
}
const loop = (cx: number, cy: number, rx: number, ry = rx, start = -90, n = 22) => arc(cx, cy, rx, ry, start, start + 360, n);

export type Motif = { name: string; strokes: Vec[][] };

export const MOTIFS = {
  /** the door lantern: a crescent moon over two blades of grass */
  lantern: { name: 'Hilal ve otlar', strokes: [
    arc(128, 92, 52, 56, -90, -270),
    arc(150, 92, 38, 46, -112, -248),
    [[86, 238], [92, 206], [84, 178]],
    [[112, 238], [118, 204], [134, 184]],
  ] },
  /** the shelter cloth for tea in the rain: three seigaiha waves */
  waves: { name: 'Seigaiha dalgaları', strokes: [
    arc(120, 196, 88, 82, 180, 360),
    arc(120, 196, 60, 56, 180, 360),
    arc(120, 196, 32, 30, 180, 360),
  ] },
  /** the shelter cloth for the paws: a paw print */
  paw: { name: 'Pati izi', strokes: [
    loop(120, 172, 40, 32),
    loop(72, 110, 15, 18),
    loop(120, 88, 15, 18),
    loop(168, 110, 15, 18),
  ] },
  /** the paper tongue of the wind chime: a goldfish, as on every fūrin */
  goldfish: { name: 'Japon balığı', strokes: [
    loop(104, 128, 54, 34, 0),
    [[156, 128], [204, 92], [190, 128], [204, 166], [156, 128]],
  ] },
  /** the meeting flag, tea: a cup and its steam */
  teacup: { name: 'Çay fincanı', strokes: [
    [[62, 136], [76, 206], [164, 206], [178, 136]],
    [[56, 136], [184, 136]],
    [[100, 116], [90, 90], [104, 60]],
    [[140, 116], [130, 90], [144, 60]],
  ] },
  /** the meeting flag, drawing: an ensō, the circle left a little open */
  enso: { name: 'Ensō', strokes: [arc(120, 132, 82, 82, 115, 115 + 335, 26)] },
  /** Rei's postcard from the Willow Market: a willow by the water */
  willow: { name: 'Söğüt', strokes: [
    [[70, 236], [78, 160], [104, 70]],
    [[104, 72], [146, 80], [168, 140], [166, 206]],
    [[98, 90], [124, 118], [128, 190]],
    [[108, 68], [182, 76], [206, 150]],
    [[30, 238], [210, 238]],
  ] },
} satisfies Record<string, Motif>;

// ------------------------------------------------------------------ matching a hand stroke to its outline
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function resample(p: Vec[], n: number): Vec[] {
  let len = 0; const seg: number[] = [];
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); seg.push(d); len += d; }
  if (len < 1e-6) return Array.from({ length: n }, () => [...p[0]] as Vec);
  const out: Vec[] = [];
  for (let k = 0; k < n; k++) {
    let d = (k / (n - 1)) * len, i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const u = seg[i] ? Math.min(1, d / seg[i]) : 0;
    out.push([lerp(p[i][0], p[i + 1][0], u), lerp(p[i][1], p[i + 1][1], u)]);
  }
  return out;
}
const pathLen = (p: Vec[]) => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);
const closed = (p: Vec[]) => p.length > 2 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 4;

/**
 * How far a hand stroke is from an outline stroke, in paper units, whichever end you started from
 * (and, for a closed outline, wherever you started on it). `blend` keeps `keep` of your hand.
 */
export function matchStroke(user: Vec[], tmpl: Vec[], keep = 0.4) {
  const N = 40;
  let t = resample(tmpl, N);
  if (closed(tmpl)) {
    // start the loop where the hand started
    const ring = t.slice(0, -1);
    let k = 0, best = Infinity;
    ring.forEach((p, i) => { const d = Math.hypot(p[0] - user[0][0], p[1] - user[0][1]); if (d < best) { best = d; k = i; } });
    const rot = [...ring.slice(k), ...ring.slice(0, k)];
    t = resample([...rot, rot[0]], N);
  }
  const u = resample(user, N);
  const dist = (a: Vec[], b: Vec[]) => a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length;
  const fwd = dist(u, t), rev = dist([...u].reverse(), t);
  const hand = rev < fwd ? [...u].reverse() : u;
  const err = Math.min(fwd, rev);
  // a stroke much shorter than the outline is a start, not the line
  const short = pathLen(user) < pathLen(tmpl) * 0.45;
  const blend = t.map((p, i) => [lerp(p[0], hand[i][0], keep), lerp(p[1], hand[i][1], keep)] as Vec);
  return { err, short, blend };
}

/** generous on purpose: the outline is a help, not an exam */
export const TOLERANCE = 20;
