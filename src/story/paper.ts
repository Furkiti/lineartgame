import { type Vec } from '../lib/ink.ts';
import { sfx, wakeAudio, haptic } from './fx.ts';
import { DRAFT_KEY } from './save.ts';
import { matchStroke, resample, TOLERANCE } from './motifs.ts';

export const linePath = (points: Vec[], close = false) => points.length ? 'M' + points.map(p => p.map(v => v.toFixed(2)).join(' ')).join('L') + (close ? 'Z' : '') : '';
export function fitLine(points: Vec[], x: number, y: number, size: number): Vec[] {
  if (!points.length) return [];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = size / Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return points.map(p => [x + (p[0] - cx) * scale, y + (p[1] - cy) * scale]);
}

/** Fit a whole drawing together, preserving the spacing between separate strokes. */
export function fitDrawing(lines: Vec[][], x: number, y: number, size: number): Vec[][] {
  const all = lines.flat(); if (!all.length) return [];
  const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = size / Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return lines.map(line => line.map(p => [x + (p[0] - cx) * scale, y + (p[1] - cy) * scale] as Vec));
}

/** A quiet, screen-space sheet. It never competes with the village for contrast. */
export function createPaper(card: HTMLElement, onExit?: () => void) {
  const root = document.createElement('section'); root.className = 'drawing-paper';
  root.setAttribute('aria-label', 'Çizim kâğıdı');
  root.innerHTML = `<div class="paper-heading"><span class="paper-kicker"></span><h1></h1><p aria-live="polite"></p></div>
    <svg viewBox="0 0 240 260" class="paper-canvas" role="img" aria-label="Parmağınla çiz"><defs><pattern id="paper-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".4" fill="#d9cdb7"/></pattern></defs><rect x="3" y="3" width="234" height="254" rx="3" fill="#fffdf7" stroke="#c9baa0"/><rect x="8" y="8" width="224" height="244" fill="url(#paper-dots)"/><path class="paper-example"/><g class="paper-trace"><path class="trace-all"/><path class="trace-now"/><path class="trace-dash"/><path class="trace-ghost"/><circle class="trace-start" r="7"/><text class="trace-num" text-anchor="middle" dominant-baseline="central"></text></g><g class="paper-preview"></g><path class="paper-ink"/><path class="paper-bloom"/></svg>
    <div class="paper-actions"><button type="button" data-action="leave">Sonra çizerim</button><button type="button" data-action="redo">Yeniden çiz</button><button type="button" data-action="help">Birlikte çizelim</button><button type="button" data-action="done">Oldu böyle</button></div>`;
  card.appendChild(root);
  const canvas = root.querySelector('svg')!, ink = root.querySelector('.paper-ink')!, example = root.querySelector('.paper-example')!;
  const title = root.querySelector('h1')!, tip = root.querySelector('p')!, kicker = root.querySelector('.paper-kicker')!;
  const done = root.querySelector('[data-action="done"]') as HTMLButtonElement;
  let lines: Vec[][] = [], pointer: number | null = null, sample: Vec[] = [], callback: ((lines: Vec[][]) => void) | null = null;
  // tracing: an outline, stroke by stroke. Each accepted stroke is your line pulled onto the outline.
  let trace: Vec[][] | null = null, ti = 0, misses = 0, wet: Vec[] = [], defaultTip = '';
  const traceG = root.querySelector('.paper-trace') as SVGGElement;
  const tAll = traceG.querySelector('.trace-all')!, tNow = traceG.querySelector('.trace-now')!, tDash = traceG.querySelector('.trace-dash')!, tGhost = traceG.querySelector('.trace-ghost')!;
  const tStart = traceG.querySelector('.trace-start')!, tNum = traceG.querySelector('.trace-num')!, bloom = root.querySelector('.paper-bloom')!;
  const tracing = () => !!trace;
  const render = () => {
    ink.setAttribute('d', [...lines, ...(wet.length > 1 ? [wet] : [])].map(l => linePath(l)).join(' '));
    done.disabled = trace ? ti < trace.length : !lines.some(l => l.length > 2);
  };
  function renderTrace() {
    traceG.style.display = trace ? '' : 'none';
    if (!trace) return;
    tAll.setAttribute('d', trace.slice(ti).map(l => linePath(l)).join(' '));
    const cur = trace[ti];
    tNow.setAttribute('d', cur ? linePath(cur) : ''); tDash.setAttribute('d', cur ? linePath(cur) : '');
    tStart.setAttribute('opacity', cur ? '1' : '0'); tNum.textContent = cur ? String(ti + 1) : '';
    if (cur) { tStart.setAttribute('cx', cur[0][0].toFixed(1)); tStart.setAttribute('cy', cur[0][1].toFixed(1)); tNum.setAttribute('x', cur[0][0].toFixed(1)); tNum.setAttribute('y', cur[0][1].toFixed(1)); }
  }
  // a dot of ink runs along the outline when you seem unsure
  let ghostRaf = 0;
  function ghost() {
    cancelAnimationFrame(ghostRaf);
    const cur = trace?.[ti]; if (!cur) return;
    const pts = resample(cur, 30), t0 = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - t0) / 1300), n = Math.max(2, Math.round(u * 30));
      tGhost.setAttribute('d', linePath(pts.slice(0, n))); tGhost.setAttribute('opacity', String(u < 1 ? .8 : 0));
      if (u < 1) ghostRaf = requestAnimationFrame(tick); else setTimeout(() => tGhost.setAttribute('opacity', '0'), 300);
    };
    ghostRaf = requestAnimationFrame(tick);
  }
  let tipTimer = 0;
  function say(text: string, ms = 2400) { tip.textContent = text; clearTimeout(tipTimer); tipTimer = window.setTimeout(() => { tip.textContent = trace && ti >= trace.length ? 'Oldu! Çizgin hazır.' : defaultTip; }, ms); }
  function accept(blend: Vec[]) {
    lines.push(blend); ti++; misses = 0; saveDraft();
    // the ink soaks in: a soft bloom along the line
    bloom.setAttribute('d', linePath(blend)); bloom.classList.remove('soak'); void (bloom as SVGElement).getBoundingClientRect(); bloom.classList.add('soak');
    sfx.press(); haptic(8);
    if (trace && ti >= trace.length) { say('Oldu! Çizgin hazır.', 99999); sfx.chime(); haptic(16); }
    else say(['Güzel.', 'Tam üstünden.', 'Elinin izi kaldı.'][ti % 3], 1400);
  }
  function judge() {
    const cur = trace?.[ti]; const hand = wet; wet = [];
    if (!cur || hand.length < 3) { render(); return; }
    const r = matchStroke(hand, cur);
    if (!r.short && r.err < TOLERANCE) accept(r.blend);
    else if (misses >= 1 && r.err < TOLERANCE * 2.2) accept(matchStroke(hand, cur, 0.15).blend); // close enough the second time: the outline helps more
    else { misses++; sfx.nope(); haptic(12); say(r.short ? 'Çizginin sonuna kadar git.' : 'Kırmızı noktadan başla, soluk çizginin üstünden geç.'); ghost(); }
    if (misses >= 3) { accept(matchStroke(cur, cur, 0).blend); }
    renderTrace(); render();
  }
  function saveDraft() {
    if (!root.classList.contains('show')) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: title.textContent, lines })); } catch {}
  }
  function release() { pointer = null; if (tracing()) { judge(); return; } lines = lines.filter(l => l.length > 1); render(); saveDraft(); }
  addEventListener('pagehide', saveDraft);
  canvas.addEventListener('pointerdown', e => {
    if (pointer !== null) return;
    e.preventDefault(); wakeAudio(); pointer = e.pointerId; canvas.setPointerCapture(pointer); if (tracing()) { wet = []; cancelAnimationFrame(ghostRaf); tGhost.setAttribute('opacity', '0'); if (ti >= trace!.length) { pointer = null; return; } } else lines.push([]); add(e); sfx.paper();
  });
  function add(e: PointerEvent) {
    const p = canvas.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const v = p.matrixTransform(canvas.getScreenCTM()!.inverse());
    const x = Math.max(10, Math.min(230, v.x)), y = Math.max(10, Math.min(250, v.y));
    const line = tracing() ? wet : lines[lines.length - 1], last = line?.[line.length - 1];
    if (line && (!last || Math.hypot(last[0] - x, last[1] - y) > .8)) line.push([x, y]);
    render();
  }
  canvas.addEventListener('pointermove', e => { if (pointer === e.pointerId) add(e); });
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  root.querySelector('[data-action="leave"]')!.addEventListener('click', () => { saveDraft(); root.classList.remove('show'); callback = null; pointer = null; onExit?.(); });
  root.querySelector('[data-action="redo"]')!.addEventListener('click', () => { lines = []; wet = []; ti = 0; misses = 0; renderTrace(); render(); saveDraft(); });
  root.querySelector('[data-action="help"]')!.addEventListener('click', () => { if (tracing()) { ghost(); return; } lines = [sample.map(p => [...p] as Vec)]; example.setAttribute('opacity', '0'); render(); saveDraft(); sfx.press(); });
  // a finger lifting off the button finishes too: right after a long stroke some browsers swallow the click
  const finish = () => { if (done.disabled || !callback) return; const cb = callback; callback = null; root.classList.remove('show'); try { localStorage.removeItem(DRAFT_KEY); } catch {} sfx.press(); cb(lines.map(l => l.map(p => [...p] as Vec))); };
  done.addEventListener('click', finish); done.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') finish(); });
  return {
    get isOpen() { return root.classList.contains('show'); },
    open(options: { title: string; tip: string; kicker?: string; example?: Vec[]; trace?: Vec[][]; preview?: string; guide?: boolean; done?: string; then: (lines: Vec[][]) => void }) {
      lines = []; wet = []; pointer = null; sample = options.example ?? options.trace?.[0] ?? []; callback = options.then;
      trace = options.trace?.length ? options.trace : null; ti = 0; misses = 0; defaultTip = options.tip;
      root.classList.toggle('tracing', !!trace);
      (root.querySelector('[data-action="help"]') as HTMLButtonElement).textContent = trace ? 'Göster' : 'Birlikte çizelim';
      title.textContent = options.title;
      try { const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); if (draft?.title === options.title && Array.isArray(draft.lines) && draft.lines.flat().length < 20000 && draft.lines.every(l => Array.isArray(l) && l.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) && (!trace || draft.lines.length <= trace.length)) { lines = draft.lines; if (trace) ti = lines.length; } } catch {}
      tip.textContent = options.tip; kicker.textContent = options.kicker ?? 'Mürekkep Sokağı';
      example.setAttribute('d', trace ? '' : linePath(sample)); example.setAttribute('opacity', options.guide === false || trace ? '0' : '.35');
      renderTrace(); bloom.setAttribute('d', '');
      root.querySelector('.paper-preview')!.innerHTML = options.preview ?? '';
      done.textContent = options.done ?? 'Oldu böyle'; root.classList.add('show'); render();
    },
    hint(text: string) { tip.textContent = text; example.setAttribute('opacity', '.35'); },
    /** for headless checks: the outline still to trace, in paper units */
    get _trace() { return trace ? trace.slice(ti) : null; },
  };
}
