// Roji: the stepping stones (tobi-ishi) up the little alley to your gate.
//
// The first time you come home they are only blue pencil. A ring of ink closes on the next stone
// with every beat (a quiet geta-tock marks it); touch when it settles and the stone is pressed in
// ink under your step, with one note of a five-note scale. On the beat it lands straight and moss
// sprouts at its edge; a little off, it lands crooked — still yours, still a path. Nothing fails.
// The alley keeps what you did: the stones stay as you pressed them, and every time you walk home
// over them they play your five notes back.
import { el, f } from '../lib/ink.ts';
import { sfx, haptic, easeOut, clamp01, lerp, backOut } from './fx.ts';

export type Stone = { q: number; tilt: number; gap: number };
/** x, y, rx, ry — from the street up to the gate, smaller as they go */
export const STONES: [number, number, number, number][] = [
  [457, 357, 8.2, 2.8], [455.8, 347.5, 7, 2.4], [458, 339, 5.9, 2.05], [456.4, 331.5, 4.9, 1.75], [457.4, 324.5, 4.1, 1.45],
];
export const BEAT = 1.05;
export const GRADE = { great: 0.11, good: 0.24 };
/** how a touch lands, given how far (seconds) it was from the ring settling */
export function grade(err: number, side: number): Stone {
  const e = Math.abs(err);
  if (e < GRADE.great) return { q: 1, tilt: 0, gap: 0 };
  if (e < GRADE.good) return { q: 0.72, tilt: side * 7, gap: 0 };
  return { q: 0.42, tilt: side * 15, gap: 0 };
}
/** old saves had the stones already: lay them straight */
export const normalizeStones = (s: unknown): Stone[] => Array.isArray(s) ? s.slice(0, STONES.length).map((x: any) => ({ q: clamp01(Number(x?.q) || 0.42), tilt: Math.max(-20, Math.min(20, Number(x?.tilt) || 0)), gap: Math.max(0, Math.min(3, Number(x?.gap) || BEAT)) })) : [];

const STONE_FILL = '#d8ccb6', PENCIL = '#7c9cc6', RED = '#b94c3e', MOSS = '#7d9a5a';

export function createAlley(layer: Element) {
  const root = el('g', { 'data-alley': '' }, layer);
  const sketch = el('g', { 'data-alley-sketch': '' }, root);
  const inked = el('g', { 'data-alley-stones': '' }, root);
  // the gate at the end: two lattice panels that slide apart as you reach them
  const gateG = el('g', { 'data-gate': '' }, root);
  const gateLight = el('rect', { x: 449.4, y: 289.4, width: 15.2, height: 16.4, fill: '#f6d58f', opacity: 0 }, gateG);
  const gateClip = el('clipPath', { id: 'alley-gate-clip' }, gateG);
  el('rect', { x: 449.3, y: 289.2, width: 15.4, height: 16.8 }, gateClip);
  const gatePanels = [449.4, 457].map(x0 => {
    const pg = el('g', {}, el('g', { 'clip-path': 'url(#alley-gate-clip)' }, gateG));
    const lat = [`M${x0} 289.4h7.6v16.4h-7.6Z`]; for (let x = x0 + 1.9; x < x0 + 7.5; x += 1.9) lat.push(`M${f(x)} 291V305.6`);
    el('path', { d: `M${x0} 289.4h7.6v16.4h-7.6Z`, fill: '#ece5d3' }, pg);
    el('path', { d: lat.join(' ') + ` M${x0} 291h7.6`, fill: 'none', stroke: 'currentColor', 'stroke-width': .3 }, pg);
    return pg;
  });
  let gateOpen = 0, gatePrev = 0, gateCd = 0, gateEdge: 'shut' | 'open' | 'mid' = 'shut';
  const fx = el('g', { 'pointer-events': 'none' }, root);
  const ring = el('ellipse', { fill: 'none', stroke: RED, 'stroke-width': .7, opacity: 0 }, fx);
  const ring2 = el('ellipse', { fill: 'none', stroke: RED, 'stroke-width': .35, 'stroke-dasharray': '1 1.4', opacity: 0 }, fx);
  const blooms: { n: SVGEllipseElement; t: number; i: number; big: number }[] = [];
  const words: { n: SVGTextElement; t: number; y: number }[] = [];

  let stones: Stone[] = [];
  let playing = false, t0 = 0, now = 0, lastBeat = -1, lastTap = -1, finishT = -1, replayT = -1, replayAt = 0, replayI = 0;
  const sketched = STONES.map(([x, y, rx, ry]) => {
    const g = el('g', {}, sketch);
    // two loose pencil passes, never quite closing
    el('path', { d: `M${f(x - rx)} ${f(y + .3)}a${f(rx)} ${f(ry)} 0 1 1 ${f(rx * 1.94)} ${f(-ry * .5)}`, fill: 'none', stroke: PENCIL, 'stroke-width': .38, 'stroke-linecap': 'round', opacity: .75 }, g);
    el('path', { d: `M${f(x + rx * .9)} ${f(y - .2)}a${f(rx * 1.02)} ${f(ry * 1.08)} 0 1 1 ${f(-rx * 1.85)} ${f(ry * .3)}`, fill: 'none', stroke: PENCIL, 'stroke-width': .3, 'stroke-dasharray': '1.6 .9', opacity: .6 }, g);
    return g;
  });

  function drawStone(i: number, s: Stone, fresh = false) {
    const [x, y, rx, ry] = STONES[i];
    const g = el('g', { 'data-stone': i, 'data-q': f(s.q), transform: `rotate(${f(s.tilt)} ${f(x)} ${f(y)})` }, inked);
    const ink = s.q >= 1 ? 1 : s.q > .6 ? .85 : .7;
    // the stone, its shadow side, a speck of texture
    el('ellipse', { cx: f(x), cy: f(y), rx: f(rx), ry: f(ry), fill: STONE_FILL, stroke: 'currentColor', 'stroke-width': f(.5 + s.q * .25), 'stroke-opacity': f(ink) }, g);
    el('path', { d: `M${f(x - rx * .7)} ${f(y + ry * .45)}Q${f(x)} ${f(y + ry * 1.05)} ${f(x + rx * .72)} ${f(y + ry * .42)}`, fill: 'none', stroke: 'currentColor', 'stroke-width': .3, opacity: f(ink * .6) }, g);
    el('path', { d: `M${f(x - rx * .25)} ${f(y - ry * .2)}l${f(rx * .12)} 0M${f(x + rx * .3)} ${f(y + ry * .1)}l${f(rx * .08)} 0`, stroke: 'currentColor', 'stroke-width': .3, opacity: f(ink * .5) }, g);
    if (s.q >= 1) {
      // on the beat: moss at its edge
      const m = el('g', { 'data-moss': '' }, g);
      for (let k = 0; k < 3; k++) el('path', { d: `M${f(x + rx * (.55 + k * .14))} ${f(y + ry * .2)}q${f(.4 + k * .2)} ${f(-1.2 - k * .3)} ${f(.9)} ${f(-1.8 - k * .4)}`, fill: 'none', stroke: MOSS, 'stroke-width': .45, 'stroke-linecap': 'round' }, m);
      el('circle', { cx: f(x - rx * .8), cy: f(y + ry * .1), r: .45, fill: MOSS }, m);
    }
    if (fresh) { g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center'; g.animate([{ transform: `rotate(${s.tilt}deg) scale(1.35)`, opacity: .2 }, { transform: `rotate(${s.tilt}deg) scale(1)`, opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.6,.4,1)' }); }
  }
  function bloom(i: number, big: number) {
    const [x, y, rx, ry] = STONES[i];
    const n = el('ellipse', { cx: f(x), cy: f(y), rx: f(rx), ry: f(ry), fill: 'currentColor', 'fill-opacity': .18, stroke: 'currentColor', 'stroke-width': .5, opacity: 0 }, fx);
    blooms.push({ n, t: 0, i, big });
  }
  function word(i: number, text: string) {
    const [x, y] = STONES[i];
    const n = el('text', { x: f(x + 13), y: f(y - 4), 'font-size': 4.2, 'font-style': 'italic', 'font-family': 'Georgia,serif', fill: 'currentColor', opacity: 0 }, fx);
    n.textContent = text; words.push({ n, t: 0, y: y - 4 });
  }
  function render() {
    inked.replaceChildren();
    stones.forEach((s, i) => drawStone(i, s));
    sketched.forEach((g, i) => g.setAttribute('opacity', i < stones.length ? '0' : '1'));
  }

  const finishing = () => finishT >= 0 && finishT < 3.4;
  const phase = () => (((now - t0) / BEAT) % 1 + 1) % 1;
  const api = {
    get stones() { return stones; },
    set stones(s: Stone[]) { stones = s; render(); },
    get built() { return stones.length >= STONES.length; },
    get playing() { return playing; },
    get done() { return finishT > 3.2; },
    /** how far the ring is from settling (0 = settled), for headless checks */
    get phase() { return phase(); },
    /** where to stand: on the last stone you pressed */
    get standY(): number | null { return playing || finishing() ? stones.length ? Math.max(333, STONES[stones.length - 1][1]) : 362 : null; },
    show(on: boolean) { root.style.display = on ? '' : 'none'; },
    /** coming out, the gate is still open behind you */
    openGate() { gateOpen = gatePrev = 1; gateEdge = 'open'; },
    /** the gate answers your walk: it slides open as you come close, and shuts behind you */
    gate(y: number, dt: number, lamp: number) {
      const want = api.built ? clamp01((341 - y) / 8) : 0;
      gateOpen += (want - gateOpen) * Math.min(1, dt * 6);
      const dv = dt > 0 ? (gateOpen - gatePrev) / dt : 0; gatePrev = gateOpen; gateCd -= dt;
      if (Math.abs(dv) > .3 && gateCd <= 0) { sfx.slide(Math.min(.7, Math.abs(dv) / 5)); gateCd = .08; }
      if (gateOpen > .92 && gateEdge !== 'open') { if (gateEdge === 'mid') { sfx.knock(); haptic(8); } gateEdge = 'open'; }
      else if (gateOpen < .05 && gateEdge !== 'shut') { if (gateEdge === 'mid') sfx.knock(); gateEdge = 'shut'; }
      else if (gateOpen > .1 && gateOpen < .85) gateEdge = 'mid';
      gatePanels.forEach((pg, i) => pg.setAttribute('transform', `translate(${f((i ? 1 : -1) * gateOpen * 7.4)} 0)`));
      gateLight.setAttribute('opacity', f(gateOpen * (.45 + lamp * .5)));
    },
    start(t: number) { stones = []; render(); playing = true; t0 = t; now = t; lastBeat = 0; lastTap = -1; finishT = -1; replayT = -1; },
    /** a touch: the next stone is pressed, straight or crooked depending on the beat */
    tap(t: number) {
      if (!playing) return null;
      now = t;
      // the ring settles once a beat after the last stone: early touches are negative, late ones positive
      const e = now - t0;
      if (e < .15) return null; // a double touch, not a step
      const err = e - Math.max(1, Math.round(e / BEAT)) * BEAT;
      const i = stones.length;
      const s = grade(err, err < 0 ? -1 : 1);
      s.gap = lastTap < 0 ? BEAT : Math.min(3, now - lastTap); lastTap = now;
      stones.push(s); drawStone(i, s, true); sketched[i].setAttribute('opacity', '0');
      sfx.stone(i, .6 + s.q * .4); haptic(s.q >= 1 ? 16 : 9);
      bloom(i, s.q >= 1 ? 2.6 : 1.7);
      word(i, s.q >= 1 ? 'tam!' : s.q > .6 ? 'güzel' : 'yamuk ama senin');
      // the next ring starts its beat now, so you are never rushed
      t0 = now; lastBeat = 0;
      if (stones.length >= STONES.length) { playing = false; finishT = 0; }
      return s;
    },
    /** walking home later: each stone plays its note as you step on it */
    stepOn(y: number, prevY: number) {
      if (!api.built || playing || finishing()) return;
      STONES.forEach(([, sy], i) => {
        if ((prevY - sy) * (y - sy) <= 0 && prevY !== y) { sfx.stone(i, .35 + stones[i].q * .25); bloom(i, 1.4); }
      });
    },
    update(t: number, dt: number) {
      now = t;
      // the ring closes on the next stone, and a tock marks the moment it settles
      if (playing) {
        const i = stones.length, [x, y, rx, ry] = STONES[i], p = phase();
        const k = 1 + (1 - easeOut(p)) * 2.4;
        ring.setAttribute('cx', f(x)); ring.setAttribute('cy', f(y));
        ring.setAttribute('rx', f(rx * k)); ring.setAttribute('ry', f(ry * k));
        ring.setAttribute('opacity', f(.25 + .65 * p));
        ring2.setAttribute('cx', f(x)); ring2.setAttribute('cy', f(y)); ring2.setAttribute('rx', f(rx * 1.05)); ring2.setAttribute('ry', f(ry * 1.05)); ring2.setAttribute('opacity', '.8');
        sketched[i].setAttribute('opacity', f(.75 + .25 * Math.sin(p * Math.PI)));
        const beat = Math.floor((now - t0) / BEAT);
        if (beat !== lastBeat) { lastBeat = beat; sfx.tick(true); }
      } else { ring.setAttribute('opacity', '0'); ring2.setAttribute('opacity', '0'); }
      // finished: the path plays your five notes back, as you pressed them
      if (finishing()) {
        finishT += dt;
        if (finishT > .7 && replayT < 0) { replayT = 0; replayI = 0; replayAt = 0; }
        if (replayT >= 0 && replayI < stones.length) {
          replayT += dt;
          if (replayT >= replayAt) { sfx.stone(replayI, .8); bloom(replayI, 1.8); replayI++; replayAt += Math.max(.32, Math.min(.7, (stones[replayI]?.gap ?? BEAT) * .5)); }
        }
      }
      for (let k = blooms.length - 1; k >= 0; k--) {
        const b = blooms[k]; b.t += dt;
        const u = clamp01(b.t / .9), [, , rx, ry] = STONES[b.i];
        b.n.setAttribute('rx', f(rx * lerp(1, b.big, easeOut(u)))); b.n.setAttribute('ry', f(ry * lerp(1, b.big, easeOut(u))));
        b.n.setAttribute('opacity', f((1 - u) * .8));
        if (u >= 1) { b.n.remove(); blooms.splice(k, 1); }
      }
      for (let k = words.length - 1; k >= 0; k--) {
        const w = words[k]; w.t += dt;
        const u = clamp01(w.t / 1.5);
        w.n.setAttribute('opacity', f(u < .15 ? backOut(u / .15) : 1 - clamp01((u - .6) / .4)));
        w.n.setAttribute('y', f(w.y - u * 5));
        if (u >= 1) { w.n.remove(); words.splice(k, 1); }
      }
    },
  };
  render();
  return api;
}
export type Alley = ReturnType<typeof createAlley>;
