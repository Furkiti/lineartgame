import { type Vec } from '../lib/ink.ts';
import { sfx, wakeAudio } from './fx.ts';

export const linePath = (points: Vec[], close = false) => points.length ? 'M' + points.map(p => p.map(v => v.toFixed(2)).join(' ')).join('L') + (close ? 'Z' : '') : '';
export function fitLine(points: Vec[], x: number, y: number, size: number): Vec[] {
  if (!points.length) return [];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = size / Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return points.map(p => [x + (p[0] - cx) * scale, y + (p[1] - cy) * scale]);
}

/** A quiet, screen-space sheet. It never competes with the village for contrast. */
export function createPaper(card: HTMLElement) {
  const root = document.createElement('section'); root.className = 'drawing-paper';
  root.setAttribute('aria-label', 'Çizim kâğıdı');
  root.innerHTML = `<div class="paper-heading"><span class="paper-kicker"></span><h1></h1><p aria-live="polite"></p></div>
    <svg viewBox="0 0 240 260" class="paper-canvas" role="img" aria-label="Parmağınla çiz"><defs><pattern id="paper-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".4" fill="#d9cdb7"/></pattern></defs><rect x="3" y="3" width="234" height="254" rx="3" fill="#fffdf7" stroke="#c9baa0"/><rect x="8" y="8" width="224" height="244" fill="url(#paper-dots)"/><path class="paper-example"/><g class="paper-preview"></g><path class="paper-ink"/></svg>
    <div class="paper-actions"><button type="button" data-action="redo">Yeniden çiz</button><button type="button" data-action="help">Birlikte çizelim</button><button type="button" data-action="done">Oldu böyle</button></div>`;
  card.appendChild(root);
  const canvas = root.querySelector('svg')!, ink = root.querySelector('.paper-ink')!, example = root.querySelector('.paper-example')!;
  const title = root.querySelector('h1')!, tip = root.querySelector('p')!, kicker = root.querySelector('.paper-kicker')!;
  const done = root.querySelector('[data-action="done"]') as HTMLButtonElement;
  let lines: Vec[][] = [], pointer: number | null = null, sample: Vec[] = [], callback: ((lines: Vec[][]) => void) | null = null;
  const render = () => { ink.setAttribute('d', lines.map(l => linePath(l)).join(' ')); done.disabled = !lines.some(l => l.length > 2); };
  function release() { pointer = null; lines = lines.filter(l => l.length > 1); render(); }
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
  root.querySelector('[data-action="redo"]')!.addEventListener('click', () => { lines = []; render(); });
  root.querySelector('[data-action="help"]')!.addEventListener('click', () => { lines = [sample.map(p => [...p] as Vec)]; example.setAttribute('opacity', '0'); render(); sfx.press(); });
  done.addEventListener('click', () => { if (done.disabled || !callback) return; const cb = callback; callback = null; root.classList.remove('show'); sfx.press(); cb(lines.map(l => l.map(p => [...p] as Vec))); });
  return {
    get isOpen() { return root.classList.contains('show'); },
    open(options: { title: string; tip: string; kicker?: string; example: Vec[]; preview?: string; guide?: boolean; done?: string; then: (lines: Vec[][]) => void }) {
      lines = []; pointer = null; sample = options.example; callback = options.then;
      title.textContent = options.title; tip.textContent = options.tip; kicker.textContent = options.kicker ?? 'Mürekkep Sokağı';
      example.setAttribute('d', linePath(sample)); example.setAttribute('opacity', options.guide === false ? '0' : '.35');
      root.querySelector('.paper-preview')!.innerHTML = options.preview ?? '';
      done.textContent = options.done ?? 'Oldu böyle'; root.classList.add('show'); render();
    },
    hint(text: string) { tip.textContent = text; example.setAttribute('opacity', '.35'); },
  };
}
