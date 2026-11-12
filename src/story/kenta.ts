// Kenta, the boy under the cherry tree, and his kite: the one stuck in the branches
// (drawn in dashes — the sign for "you could draw here") and the one you draw him.
// Also the brush: your finger leaves an ink stroke in the scene, and a few simple shapes
// are recognised (a kite is any closed shape with three or four corners).
import { el, pen, limb, blot, f, pt, PEN, PAPER, type Vec } from '../lib/ink.ts';
import { gait } from '../lib/gait.ts';
import { FS, rgb, hex, mix } from '../village/kit.ts';
import { clamp01, lerp, easeOut, easeInOut, backOut, approach } from './fx.ts';

const RAD = Math.PI / 180;
const tint = (c: string, P: { inkT: number }, k = 0.55) => rgb(mix(hex(c), mix(hex(c), [12, 16, 30], 0.6), P.inkT * k));
const place = (g: Element, X: number, Y: number, dir: number, s = FS) => g.setAttribute('transform', `translate(${f(X)} ${f(Y)}) scale(${f(dir * s)} ${f(s)}) translate(-40 -120)`);

// ------------------------------------------------------------------ Kenta
export function createKenta(parent: Element, x: number, y: number) {
  const g = el('g', {}, parent);
  const farArm = limb(g, 3);
  const legs = [0, 1].map(() => ({ L: limb(g, 3.6), S: blot(g) }));
  const shorts = el('path', { fill: '#33465e', stroke: 'currentColor', 'stroke-width': PEN }, g);
  const shirt = el('path', { fill: 'url(#v-stripes)', stroke: 'currentColor', 'stroke-width': PEN }, g);
  const head = el('ellipse', { rx: 6.4, ry: 6.9, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, g);
  const hair = blot(g);
  const hat = el('path', { fill: '#e6cf8e', stroke: 'currentColor', 'stroke-width': PEN * 0.8 }, g);
  const band = el('path', { fill: '#b3412d' }, g);
  const eye = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 0.7, 'stroke-linecap': 'round' }, g);
  const arm = limb(g, 3);
  const walk = gait({ kind: 'walk', thigh: 13, shin: 13, stride: 12, lift: 3.4, period: 0.62, ankleY: 118.4, toe: 3 });

  let phase = 0, go = 0, hopT = -1, look = 0, sad = 0, raise = 0, tx = x, ty = y, wave = 0, tNow = 0;
  const self = {
    g, x, y, dir: -1 as number, speed: 26,
    /** 0…1 targets the body eases toward */
    want: { look: 0, sad: 0, raise: 0, wave: 0 },
    hand: [x, y - 30] as Vec,
    head: [x, y - 40] as Vec,
    walkTo(nx: number, ny = self.y) { tx = nx; ty = ny; },
    get walking() { return Math.abs(tx - self.x) > 1.5 || Math.abs(ty - self.y) > 1; },
    hop() { if (hopT < 0) hopT = 0; },
    draw(t: number, dt: number, P: { inkT: number }) {
      tNow = t;
      // walk toward the target
      const dx = tx - self.x, dy = ty - self.y, d = Math.hypot(dx, dy);
      const moving = d > 1.5;
      go = approach(go, moving ? 1 : 0, moving ? 8 : 6, dt);
      if (moving) {
        const sp = Math.min(self.speed, d * 3);
        self.x += (dx / d) * sp * dt; self.y += (dy / d) * sp * dt * 0.7;
        if (Math.abs(dx) > 2) self.dir = dx > 0 ? 1 : -1;
      }
      phase += (dt / walk.period) * go;
      look = approach(look, self.want.look, 4, dt); sad = approach(sad, self.want.sad, 3, dt);
      raise = approach(raise, self.want.raise, 6, dt); wave = approach(wave, self.want.wave, 5, dt);
      let hop = 0;
      if (hopT >= 0) { hopT += dt; hop = Math.sin(Math.PI * clamp01(hopT / 0.5)) * 14; if (hopT > 0.5) hopT = -1; }
      place(g, self.x, self.y - hop * FS, self.dir);

      const pose = walk.pose(phase, go);
      const breathe = Math.sin(t * 2.2) * 0.4 * (1 - go);
      const hip: Vec = [40, pose.hip[1] + 1.6 * sad + breathe * 0.3];
      pose.feet.forEach((fo, i) => {
        const a = hop > 1 ? [fo.ankle[0] - 1 + i * 2, fo.ankle[1] - 4] as Vec : fo.ankle;
        legs[i].L.draw([hip, fo.knee, a], [0.2, 0.4]);
        legs[i].S.setAttribute('d', `M${f(a[0] - 2)} ${f(a[1])} L${f(a[0] + 4)} ${f(a[1])} Q${f(a[0] + 5)} ${f(a[1] + 2)} ${f(a[0] + 3)} ${f(a[1] + 2)} L${f(a[0] - 2)} ${f(a[1] + 2)}Z`);
      });
      g.appendChild(legs[pose.front].L.g); g.insertBefore(legs[pose.front].L.g, shorts);
      // shoulders slump when sad, chest opens when looking up
      const sh: Vec = [43 + go * 2 - sad * 1.4 - look * 1.2, 74 + sad * 2 + breathe];
      shorts.setAttribute('d', `M34.6 ${f(hip[1] - 4)} L46 ${f(hip[1] - 4)} L47 ${f(hip[1] + 4)} L41 ${f(hip[1] + 4.6)} L40 ${f(hip[1] + 1)} L37.6 ${f(hip[1] + 4.6)} L33.8 ${f(hip[1] + 3.6)}Z`);
      shirt.setAttribute('d', `M35 ${f(hip[1] - 3.6)} Q34.2 ${f(sh[1] + 6)} ${f(sh[0] - 6)} ${f(sh[1])} Q${f(sh[0])} ${f(sh[1] - 2.6)} ${f(sh[0] + 3)} ${f(sh[1] + 1)} Q47.4 ${f(sh[1] + 10)} 46.4 ${f(hip[1] - 3.6)}Z`);
      // head: down when sad, back when looking up
      const tilt = -look * 24 + sad * 14;
      const hc: Vec = [sh[0] + 2.4 + sad * 1.6 - look * 1.4, sh[1] - 11 + sad * 1.4];
      head.setAttribute('cx', f(hc[0])); head.setAttribute('cy', f(hc[1]));
      const R = (dx: number, dy: number): string => { const a = tilt * RAD, c = Math.cos(a), s = Math.sin(a); return `${f(hc[0] + dx * c - dy * s)} ${f(hc[1] + dx * s + dy * c)}`; };
      hair.setAttribute('d', `M${R(-6.2, 1)} Q${R(-6.6, -6)} ${R(0, -6.6)} Q${R(-3, -2)} ${R(-6.2, 1)}Z`);
      hat.setAttribute('d', `M${R(-12, -4)} Q${R(0, -8)} ${R(12, -4)} Q${R(0, -1)} ${R(-12, -4)}Z M${R(-5.6, -5.4)} Q${R(-5, -12)} ${R(0, -12)} Q${R(5, -12)} ${R(5.6, -5.6)}Z`);
      band.setAttribute('d', `M${R(-5.5, -7.6)} L${R(5.5, -7.6)} L${R(5.6, -5.8)} L${R(-5.6, -5.8)}Z`);
      // one eye: a soft dash, a little arc when happy (looking up or raising the kite)
      const happy = Math.max(raise, wave);
      eye.setAttribute('d', happy > 0.5 ? `M${R(2.6, -0.6)} Q${R(3.6, -1.8)} ${R(4.6, -0.6)}` : `M${R(3, -0.4)} L${R(4.4, sad > 0.5 ? 0.4 : -0.4)}`);
      // arms: far one swings, near one holds the string up or waves
      const swing = Math.sin(2 * Math.PI * phase) * 40 * go;
      const fsh: Vec = [sh[0] - 2.5, sh[1] + 1.5];
      const fe: Vec = [fsh[0] + Math.sin(swing * RAD) * 8, fsh[1] + Math.cos(swing * RAD) * 8];
      farArm.draw([fsh, fe, [fe[0] + Math.sin((swing - 30) * RAD) * 8, fe[1] + Math.cos((swing - 30) * RAD) * 8]], [0.2, 0.4]);
      const nsh: Vec = [sh[0], sh[1] + 1.5];
      const up = Math.max(raise, wave);
      const aa = lerp(-swing - sad * 10, 150 + Math.sin(t * 9) * 18 * wave, up) * RAD;
      const ne: Vec = [nsh[0] + Math.sin(aa) * 8, nsh[1] + Math.cos(aa) * 8];
      const hn: Vec = [ne[0] + Math.sin(aa - 0.3 * (1 - up)) * 8, ne[1] + Math.cos(aa - 0.3 * (1 - up)) * 8];
      arm.draw([nsh, ne, hn], [0.2, 0.4]);
      self.hand = [self.x + self.dir * FS * (hn[0] - 40), self.y - hop * FS + FS * (hn[1] - 120)];
      self.head = [self.x + self.dir * FS * (hc[0] - 40), self.y - hop * FS + FS * (hc[1] - 120)];
      shorts.setAttribute('fill', tint('#33465e', P)); hat.setAttribute('fill', tint('#e6cf8e', P));
      void tNow;
    },
  };
  return self;
}
export type Kenta = ReturnType<typeof createKenta>;

// ------------------------------------------------------------------ kites
const KITE: Vec[] = [[0, -13], [9, -2], [0, 13], [-9, -2]]; // a diamond, nose up

export function createStuckKite(parent: Element, at: Vec) {
  const g = el('g', {}, parent);
  const body = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-dasharray': '2.6 1.8', 'stroke-linejoin': 'round' }, g);
  const tail = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.8, 'stroke-dasharray': '1.8 1.5' }, g);
  let op = 1, gone = false, fall = 0;
  return {
    g, at,
    remove() { gone = true; },
    draw(t: number, dt: number, wind: number) {
      if (gone) { op = approach(op, 0, 3, dt); fall += dt * 30; }
      g.setAttribute('opacity', f(op));
      const sw = Math.sin(t * 1.3) * 4 + wind * 3;
      g.setAttribute('transform', `translate(${f(at[0])} ${f(at[1] + fall)}) rotate(${f(24 + sw)}) scale(0.95)`);
      body.setAttribute('d', 'M' + KITE.map(pt).join('L') + 'Z M0 -13 L0 13 M-9 -2 L9 -2');
      const tl: Vec[] = []; for (let i = 0; i <= 10; i++) tl.push([Math.sin(t * 2 + i * 0.7) * 3 * (i / 10), 13 + i * 3.2]);
      tail.setAttribute('d', 'M' + tl.map(pt).join('L'));
    },
  };
}

/** The kite you drew: appears out of the stroke, then flies on a string from Kenta's hand. */
export function createKite(parent: Element) {
  const g = el('g', { opacity: 0 }, parent);
  const string = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.45 }, parent);
  parent.insertBefore(string, g);
  const tail = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, g);
  const bows = [0, 1, 2].map(() => el('path', { fill: '#e3b33d', stroke: 'currentColor', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }, g));
  const body = el('path', { d: 'M' + KITE.map(pt).join('L') + 'Z', fill: '#c8423a', stroke: 'currentColor', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, g);
  const spars = el('path', { d: 'M0 -13 L0 13 M-9 -2 L9 -2', fill: 'none', stroke: 'currentColor', 'stroke-width': 0.6 }, g);
  const mark = el('path', { d: 'M-3.4 -2 Q0 -6.4 3.4 -2 Q0 2.4 -3.4 -2Z', fill: '#f3ead8', stroke: 'currentColor', 'stroke-width': 0.4 }, g);
  const len = 4 * Math.hypot(9, 11);
  body.setAttribute('stroke-dasharray', f(len)); spars.setAttribute('stroke-dasharray', '60');
  let born = -1, from: Vec = [0, 0], pos: Vec = [0, 0], vel: Vec = [0, 0], tail0: Vec[] = [];
  const self = {
    flying: false,
    /** start drawing the kite where the stroke was */
    birth(at: Vec) { born = 0; from = at; pos = [...at] as Vec; vel = [0, 0]; self.flying = false; },
    get age() { return born; },
    draw(t: number, dt: number, wind: number, hand: Vec | null) {
      if (born < 0) { g.setAttribute('opacity', '0'); string.setAttribute('d', ''); return; }
      born += dt;
      // 0–0.7 s: ink draws the outline, colour soaks in. then it lifts into the wind
      const drawT = clamp01(born / 0.7), fillT = clamp01((born - 0.45) / 0.4);
      g.setAttribute('opacity', '1');
      body.setAttribute('stroke-dashoffset', f(len * (1 - easeInOut(drawT))));
      spars.setAttribute('stroke-dashoffset', f(60 * (1 - easeInOut(clamp01((born - 0.3) / 0.5)))));
      body.setAttribute('fill-opacity', f(fillT)); mark.setAttribute('opacity', f(fillT));
      const lift = clamp01((born - 1.0) / 1.6);
      self.flying = lift > 0.6;
      let want: Vec = from;
      if (hand && lift > 0) {
        const sway: Vec = [Math.sin(t * 0.7) * 10 + Math.sin(t * 1.9) * 3 + wind * 6, Math.sin(t * 1.1) * 6];
        const sky: Vec = [hand[0] - 26 + sway[0], hand[1] - 92 + sway[1]];
        want = [lerp(from[0], sky[0], easeInOut(lift)), lerp(from[1], sky[1], easeInOut(lift))];
      }
      for (const i of [0, 1]) { vel[i] += ((want[i] - pos[i]) * 9 - vel[i] * 4) * dt; pos[i] += vel[i] * dt; }
      const s = lerp(0.9, 0.8, lift) * backOut(clamp01(born / 0.5));
      const rot = Math.sin(t * 1.7) * 8 + vel[0] * 0.25 + wind * 4;
      g.setAttribute('transform', `translate(${f(pos[0])} ${f(pos[1])}) rotate(${f(rot)}) scale(${f(s)})`);
      // a tail that trails the motion
      const tl: Vec[] = [[0, 13]];
      for (let i = 1; i <= 12; i++) {
        const prev = tail0[i] ?? [0, 13 + i * 3];
        const target: Vec = [Math.sin(t * 3 - i * 0.6) * (1 + i * 0.4) - vel[0] * 0.02 * i, 13 + i * 3];
        tl.push([lerp(prev[0], target[0], 0.25), lerp(prev[1], target[1], 0.25)]);
      }
      tail0 = tl;
      tail.setAttribute('d', 'M' + tl.map(pt).join('L'));
      bows.forEach((b, i) => { const p = tl[3 + i * 3]; b.setAttribute('d', `M${f(p[0])} ${f(p[1])} l-2.4 -1.4 l0 2.8Z M${f(p[0])} ${f(p[1])} l2.4 -1.4 l0 2.8Z`); });
      // the string: from the hand to the kite's cross, sagging with slack
      if (hand && lift > 0.05) {
        const k: Vec = [pos[0], pos[1] - 2];
        const mid: Vec = [(hand[0] + k[0]) / 2 + 6, (hand[1] + k[1]) / 2 + 10 * (1 - lift * 0.6)];
        string.setAttribute('d', `M${pt(hand)} Q${pt(mid)} ${pt(k)}`);
        string.setAttribute('opacity', f(clamp01(lift * 3)));
      } else string.setAttribute('d', '');
    },
  };
  return self;
}

// ------------------------------------------------------------------ the brush
/** An ink stroke that swells and thins with speed, like a brush. */
export function createStroke(parent: Element) {
  const n = el('path', { fill: 'currentColor', stroke: 'none' }, parent);
  const dry = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': 0.35, opacity: 0.5 }, parent);
  let pts: { p: Vec; w: number }[] = [];
  let fade = -1;
  const build = () => {
    if (pts.length < 2) { n.setAttribute('d', pts.length ? `M${f(pts[0].p[0] - 1)} ${f(pts[0].p[1])} a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0` : ''); dry.setAttribute('d', ''); return; }
    const L: Vec[] = [], R: Vec[] = [];
    pts.forEach((q, i) => {
      const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p;
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const taper = Math.min(1, i / 3, (pts.length - 1 - i) / 4 + 0.35);
      const w = q.w * taper;
      L.push([q.p[0] - (dy / l) * w, q.p[1] + (dx / l) * w]); R.push([q.p[0] + (dy / l) * w, q.p[1] - (dx / l) * w]);
    });
    n.setAttribute('d', 'M' + L.map(pt).join('L') + 'L' + R.reverse().map(pt).join('L') + 'Z');
    // a few dry bristle lines along the edge
    dry.setAttribute('d', 'M' + pts.map((q, i) => pt([q.p[0] + Math.sin(i * 1.7) * q.w * 0.9, q.p[1] + Math.cos(i * 1.3) * q.w * 0.9])).join('L'));
  };
  return {
    get points() { return pts.map((q) => q.p); },
    clear() { pts = []; fade = -1; n.setAttribute('opacity', '1'); dry.setAttribute('opacity', '0.5'); build(); },
    add(p: Vec, speed: number) {
      const last = pts[pts.length - 1];
      if (last && Math.hypot(p[0] - last.p[0], p[1] - last.p[1]) < 0.9) return;
      const w = lerp(1.7, 0.75, clamp01(speed / 220));
      pts.push({ p, w: last ? lerp(last.w, w, 0.35) : w });
      build();
    },
    /** fade the ink away (a wrong shape, or after it became something) */
    vanish() { fade = 0; },
    draw(dt: number) {
      if (fade < 0) return;
      fade += dt;
      const o = 1 - easeOut(fade / 0.6);
      n.setAttribute('opacity', f(o)); dry.setAttribute('opacity', f(o * 0.5));
      if (fade > 0.6) { pts = []; build(); fade = -1; n.setAttribute('opacity', '1'); }
    },
  };
}

/** What did the finger draw? Lenient on purpose: this is for children and thumbs. */
export function recognise(points: Vec[]): { kind: 'kite' | 'ball' | 'stick' | 'scribble' | 'tiny'; center: Vec; size: number; corners: number } {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const size = Math.max(x1 - x0, y1 - y0), center: Vec = [(x0 + x1) / 2, (y0 + y1) / 2];
  if (points.length < 4 || size < 9) return { kind: 'tiny', center, size, corners: 0 };
  let len = 0; for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const gap = Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]);
  const closed = gap < Math.max(8, size * 0.42);
  const straight = Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) / len;
  if (!closed && straight > 0.85) return { kind: 'stick', center, size, corners: 0 };
  if (!closed) return { kind: 'scribble', center, size, corners: 0 };
  // resample the loop evenly and look for sharp turns
  const loop = [...points, points[0]];
  const N = 40, step = (len + gap) / N, res: Vec[] = [loop[0]];
  let acc = 0;
  for (let i = 1; i < loop.length && res.length < N; i++) {
    let a = loop[i - 1]; const b = loop[i];
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (acc + d >= step && res.length < N) {
      const u = (step - acc) / d;
      const q: Vec = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      res.push(q); a = q; d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc = 0;
    }
    acc += d;
  }
  const M = res.length, W = 3;
  const turn = res.map((_, i) => {
    const a = res[(i - W + M) % M], b = res[i], c = res[(i + W) % M];
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  // a corner turns much harder than the rest of the outline (a circle turns evenly everywhere)
  const median = [...turn].sort((a, b) => a - b)[M >> 1];
  const thr = Math.max(1.0, median * 2.2);
  let corners = 0;
  const peaks: number[] = [];
  for (let i = 0; i < M; i++) {
    const v = turn[i];
    if (v < thr) continue;
    let isMax = true;
    for (let j = 1; j <= 3; j++) { if (turn[(i + j) % M] > v || turn[(i - j + M) % M] >= v) { isMax = false; break; } }
    if (isMax && !peaks.some((p) => Math.min(Math.abs(p - i), M - Math.abs(p - i)) < 4)) { peaks.push(i); corners++; }
  }
  if (corners >= 3 && corners <= 5) return { kind: 'kite', center, size, corners };
  if (corners <= 1) return { kind: 'ball', center, size, corners };
  return { kind: corners === 2 ? 'kite' : 'scribble', center, size, corners };
}
