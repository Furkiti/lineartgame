// The notebook: the day's page. Three small sketches — still dashed until you have done the
// thing, then drawn in ink (the stroke animates in) with a red seal. Opens from the HUD at
// any time, and by itself when you go to sleep.
import { sfx } from './fx.ts';

export type Entry = { id: string; title: string; hint: string; sketch: string; done: boolean; fresh?: boolean };

export function createNotebook(card: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.className = 'defter';
  wrap.innerHTML = `<div class="page"><div class="head"><span class="day"></span><span class="sub"></span></div><div class="cells"></div><p class="line"></p><button type="button" class="close"></button></div>`;
  card.appendChild(wrap);
  const day = wrap.querySelector('.day') as HTMLElement, sub = wrap.querySelector('.sub') as HTMLElement;
  const cells = wrap.querySelector('.cells') as HTMLElement, line = wrap.querySelector('.line') as HTMLElement, close = wrap.querySelector('.close') as HTMLButtonElement;
  let onClose: (() => void) | null = null;
  close.addEventListener('click', () => { api.hide(); onClose?.(); onClose = null; });
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { api.hide(); onClose?.(); onClose = null; } });

  const api = {
    get isOpen() { return wrap.classList.contains('show'); },
    show({ dayN, subtitle, entries, sentence, button, then }: { dayN: number; subtitle: string; entries: Entry[]; sentence: string; button: string; then?: () => void }) {
      day.textContent = `${dayN}. gün`; sub.textContent = subtitle;
      cells.innerHTML = entries.map((e, i) => `
        <div class="cell ${e.done ? 'done' : 'todo'} ${e.fresh ? 'fresh' : ''}" style="--i:${i}">
          <svg viewBox="0 0 60 60"><path pathLength="1" d="${e.sketch}"/></svg>
          ${e.done ? '<i class="seal">済</i>' : ''}
          <b>${e.title}</b><small>${e.done ? '' : e.hint}</small>
        </div>`).join('');
      line.textContent = sentence;
      close.textContent = button;
      onClose = then ?? null;
      wrap.classList.add('show');
      sfx.paper();
    },
    hide() { wrap.classList.remove('show'); },
  };
  return api;
}

// little sketches, in a 60×60 box
export const SKETCH = {
  kite: 'M30 6 L44 22 L30 40 L16 22Z M30 6 L30 40 M16 22 L44 22 M30 40 Q26 46 31 50 Q36 54 30 58 M12 54 Q20 50 24 54',
  sushi: 'M8 40 L52 40 L52 44 L8 44Z M12 44 L12 50 M48 44 L48 50 M12 40 Q12 31 20 31 Q28 31 28 40 M32 40 Q32 31 40 31 Q48 31 48 40 M11 34 Q20 26 29 33 M31 34 Q40 26 49 33',
  fox: 'M22 50 Q18 36 24 28 L22 16 L28 24 L34 24 L38 16 L38 28 Q44 36 40 50Z M26 32 l2 0 M34 32 l2 0 M29 38 Q31 40 33 38 M40 50 Q54 50 52 38 Q50 44 42 44',
  lantern: 'M24 8 L36 8 M30 4 L30 8 M22 12 L38 12 Q46 30 38 48 L22 48 Q14 30 22 12Z M22 52 L38 52',
  cat: 'M14 48 Q12 34 22 30 Q30 28 36 32 L40 22 L44 30 Q50 32 48 40 Q46 48 36 48Z M40 36 l1 0 M14 48 Q4 46 8 38',
  fair: 'M4 14 Q30 26 56 14 M12 18 l0 4 M22 21 l0 4 M32 22 l0 4 M42 20 l0 4 M50 17 l0 4 M8 50 L8 34 L24 30 L24 50 M30 50 L30 30 L52 34 L52 50 M14 38 l4 0 M38 38 l8 0',
  moon: 'M38 10 Q22 14 22 30 Q22 46 38 50 Q18 54 12 36 Q8 14 38 10Z M44 20 l2 0 M48 30 l2 0',
};
