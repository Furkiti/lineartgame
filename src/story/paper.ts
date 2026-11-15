import { type Vec } from '../lib/ink.ts';
import { sfx, wakeAudio } from './fx.ts';
import { DRAFT_KEY } from './save.ts';

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
    <svg viewBox="0 0 240 260" class="paper-canvas" role="img" aria-label="Parmağınla çiz"><defs><pattern id="paper-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".4" fill="#d9cdb7"/></pattern></defs><rect x="3" y="3" width="234" height="254" rx="3" fill="#fffdf7" stroke="#c9baa0"/><rect x="8" y="8" width="224" height="244" fill="url(#paper-dots)"/><path class="paper-example"/><g class="paper-preview"></g><path class="paper-ink"/></svg>
    <div class="paper-actions"><button type="button" data-action="leave">Sonra çizerim</button><button type="button" data-action="redo">Yeniden çiz</button><button type="button" data-action="help">Birlikte çizelim</button><button type="button" data-action="done">Oldu böyle</button></div>`;
  card.appendChild(root);
  const canvas = root.querySelector('svg')!, ink = root.querySelector('.paper-ink')!, example = root.querySelector('.paper-example')!;
  const title = root.querySelector('h1')!, tip = root.querySelector('p')!, kicker = root.querySelector('.paper-kicker')!;
  const done = root.querySelector('[data-action="done"]') as HTMLButtonElement;
  let lines: Vec[][] = [], pointer: number | null = null, sample: Vec[] = [], callback: ((lines: Vec[][]) => void) | null = null;
  const render = () => { ink.setAttribute('d', lines.map(l => linePath(l)).join(' ')); done.disabled = !lines.some(l => l.length > 2); };
  function saveDraft() {
    if (!root.classList.contains('show')) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: title.textContent, lines })); } catch {}
  }
  function release() { pointer = null; lines = lines.filter(l => l.length > 1); render(); saveDraft(); }
  addEventListener('pagehide', saveDraft);
  canvas.addEventListener('pointerdown', e => {
    if (pointer !== null) return;
    e.preventDefault(); wakeAudio(); pointer = e.pointerId; canvas.setPointerCapture(pointer); lines.push([]); add(e); sfx.paper();
  });
  function add(e: PointerEvent) {
    const p = canvas.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const v = p.matrixTransform(canvas.getScreenCTM()!.inverse());
    const x = Math.max(10, Math.min(230, v.x)), y = Math.max(10, Math.min(250, v.y));
    const line = lines[lines.length - 1], last = line?.[line.length - 1];
    if (line && (!last || Math.hypot(last[0] - x, last[1] - y) > .8)) line.push([x, y]);
    render();
  }
  canvas.addEventListener('pointermove', e => { if (pointer === e.pointerId) add(e); });
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  root.querySelector('[data-action="leave"]')!.addEventListener('click', () => { saveDraft(); root.classList.remove('show'); callback = null; pointer = null; onExit?.(); });
  root.querySelector('[data-action="redo"]')!.addEventListener('click', () => { lines = []; render(); saveDraft(); });
  root.querySelector('[data-action="help"]')!.addEventListener('click', () => { lines = [sample.map(p => [...p] as Vec)]; example.setAttribute('opacity', '0'); render(); saveDraft(); sfx.press(); });
  done.addEventListener('click', () => { if (done.disabled || !callback) return; const cb = callback; callback = null; root.classList.remove('show'); try { localStorage.removeItem(DRAFT_KEY); } catch {} sfx.press(); cb(lines.map(l => l.map(p => [...p] as Vec))); });
  return {
    get isOpen() { return root.classList.contains('show'); },
    open(options: { title: string; tip: string; kicker?: string; example: Vec[]; preview?: string; guide?: boolean; done?: string; then: (lines: Vec[][]) => void }) {
      lines = []; pointer = null; sample = options.example; callback = options.then;
      title.textContent = options.title;
      try { const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); if (draft?.title === options.title && Array.isArray(draft.lines) && draft.lines.flat().length < 20000 && draft.lines.every(l => Array.isArray(l) && l.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) lines = draft.lines; } catch {}
      tip.textContent = options.tip; kicker.textContent = options.kicker ?? 'Mürekkep Sokağı';
      example.setAttribute('d', linePath(sample)); example.setAttribute('opacity', options.guide === false ? '0' : '.35');
      root.querySelector('.paper-preview')!.innerHTML = options.preview ?? '';
      done.textContent = options.done ?? 'Oldu böyle'; root.classList.add('show'); render();
    },
    hint(text: string) { tip.textContent = text; example.setAttribute('opacity', '.35'); },
  };
}
