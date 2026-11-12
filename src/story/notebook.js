// The notebook: the day's page. Three small sketches — still dashed until you have done the
// thing, then drawn in ink (the stroke animates in) with a red seal. Opens from the HUD at
// any time, and by itself when you go to sleep.
import { sfx } from "./fx.js";
export function createNotebook(card) {
    const wrap = document.createElement('div');
    wrap.className = 'defter';
    wrap.innerHTML = `<div class="page"><div class="head"><span class="day"></span><span class="sub"></span></div><div class="cells"></div><p class="line"></p><button type="button" class="close"></button></div>`;
    card.appendChild(wrap);
    const day = wrap.querySelector('.day'), sub = wrap.querySelector('.sub');
    const cells = wrap.querySelector('.cells'), line = wrap.querySelector('.line'), close = wrap.querySelector('.close');
    let onClose = null;
    close.addEventListener('click', () => { api.hide(); onClose?.(); onClose = null; });
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) {
        api.hide();
        onClose?.();
        onClose = null;
    } });
    const api = {
        get isOpen() { return wrap.classList.contains('show'); },
        show({ dayN, subtitle, entries, sentence, button, then }) {
            day.textContent = `${dayN}. gün`;
            sub.textContent = subtitle;
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
    moon: 'M38 10 Q22 14 22 30 Q22 46 38 50 Q18 54 12 36 Q8 14 38 10Z M44 20 l2 0 M48 30 l2 0',
};
