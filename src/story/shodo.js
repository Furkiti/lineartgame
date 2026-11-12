// The writing desk at the workshop, seen from above: felt, a sheet of hanshi with a red
// guide grid, an inkstone, the brush, the order slip. You write a commission stroke by
// stroke over a faint template, in the right order. Your line and the template's are
// blended, so the result keeps your hand but always looks right; how close you stayed
// decides the teacher's red mark at the end.
import { f, pt } from "../lib/ink.js";
import { sfx, haptic, clamp01, lerp, easeOut, easeInOut, backOut, approach } from "./fx.js";
const NS = 'http://www.w3.org/2000/svg';
function mk(tag, a = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in a)
        n.setAttribute(k, String(a[k]));
    parent?.appendChild(n);
    return n;
}
/** 茶 — nine strokes in writing order, in a 100×100 box. sweep: the stroke thins to a point. */
export const CHA = [
    { pts: [[14, 24], [50, 23], [86, 24]] },
    { pts: [[34, 11], [36, 24], [38, 36]] },
    { pts: [[66, 11], [64, 24], [62, 36]] },
    { pts: [[50, 33], [38, 46], [14, 60]], sweep: true },
    { pts: [[50, 33], [64, 46], [88, 60]], sweep: true },
    { pts: [[27, 65], [50, 64], [73, 65]] },
    { pts: [[50, 53], [50, 74], [50, 92], [44, 87]] },
    { pts: [[37, 74], [32, 80], [25, 87]], sweep: true },
    { pts: [[63, 74], [68, 80], [75, 87]] },
];
function resample(p, n) {
    let len = 0;
    const seg = [];
    for (let i = 1; i < p.length; i++) {
        const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        seg.push(d);
        len += d;
    }
    if (len < 1e-6)
        return Array.from({ length: n }, () => [...p[0]]);
    const out = [];
    for (let k = 0; k < n; k++) {
        let d = (k / (n - 1)) * len, i = 0;
        while (i < seg.length - 1 && d > seg[i]) {
            d -= seg[i];
            i++;
        }
        const u = seg[i] ? Math.min(1, d / seg[i]) : 0;
        out.push([lerp(p[i][0], p[i + 1][0], u), lerp(p[i][1], p[i + 1][1], u)]);
    }
    return out;
}
const meanDist = (a, b) => a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length;
/** How close a hand-drawn line is to a template (in the template's units); and the blend of the two. */
export function compare(user, tmpl, keep = 0.35) {
    const N = 32;
    const u = resample(user, N), t = resample(tmpl, N);
    const fwd = meanDist(u, t), back = meanDist([...u].reverse(), t);
    const blend = t.map((p, i) => [lerp(p[0], u[i][0], keep), lerp(p[1], u[i][1], keep)]);
    return { err: fwd, reversed: back < fwd * 0.6, blend };
}
/** A brush stroke polygon: pressed at the start, a little belly, thin or blunt at the end. */
export function brush(points, width, sweep = false) {
    const p = resample(points, 28);
    const L = [], R = [];
    p.forEach((q, i) => {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const t = i / (p.length - 1);
        const w = width * (t < 0.12 ? 0.75 + t * 2.4 : sweep ? Math.pow(1 - t, 0.8) * 1.05 + 0.04 : 0.95 + Math.sin(t * Math.PI) * 0.12 - (t > 0.9 ? (t - 0.9) * 3 : 0));
        L.push([q[0] - (dy / l) * w / 2, q[1] + (dx / l) * w / 2]);
        R.push([q[0] + (dy / l) * w / 2, q[1] - (dx / l) * w / 2]);
    });
    const e = p[p.length - 1], s = p[0];
    return `M${pt(L[0])} L${L.map(pt).join(' L')} ${sweep ? `L${pt(e)}` : `Q${f(e[0] + (e[0] - p[p.length - 2][0]) * 0.8)} ${f(e[1] + (e[1] - p[p.length - 2][1]) * 0.8)} ${pt(R[R.length - 1])}`} L${R.reverse().map(pt).join(' L')} Q${f(s[0] - (p[1][0] - s[0]) * 1.2)} ${f(s[1] - (p[1][1] - s[1]) * 1.2)} ${pt(L[0])}Z`;
}
export function createShodo(card, { onDone, onExit }) {
    const svg = mk('svg', { class: 'shodo' });
    card.appendChild(svg);
    const ui = document.createElement('div');
    ui.className = 'shodo-ui';
    ui.innerHTML = `<button type="button" class="cu-back show">‹ Geri</button><div class="sh-title"><span></span><b></b></div><div class="sh-tip"></div>
    <div class="sh-order"><p class="from">Çay evi <b>うさぎ屋</b></p><p>“Tabelamızın yazısı soldu. Bize yeni bir <b class="kanji">茶</b> yazar mısın? Senin elinden olsun.”</p><button type="button">Fırçayı al</button></div>`;
    card.appendChild(ui);
    const back = ui.querySelector('.cu-back'), title = ui.querySelector('.sh-title'), tip = ui.querySelector('.sh-tip');
    const order = ui.querySelector('.sh-order');
    const world = mk('g', {}, svg);
    // felt mat, paper, guide grid, inkstone, brush, paperweight
    mk('rect', { x: -400, y: -400, width: 1000, height: 1000, fill: '#2f3a3f' }, world);
    const felt = [];
    for (let i = 0; i < 60; i++)
        felt.push(`M${f(-300 + Math.random() * 700)} ${f(-300 + Math.random() * 700)} l${f(Math.random() * 6)} ${f(Math.random() * 2)}`);
    mk('path', { d: felt.join(' '), stroke: '#46555c', 'stroke-width': 0.6, fill: 'none' }, world);
    mk('rect', { x: -8, y: -14, width: 116, height: 128, fill: '#f8f3e6', stroke: '#1c1c1c', 'stroke-width': 0.5 }, world);
    mk('path', { d: 'M50 0 L50 100 M0 50 L100 50 M0 0 L100 0 L100 100 L0 100Z', fill: 'none', stroke: '#c8423a', 'stroke-width': 0.35, 'stroke-dasharray': '1.6 1.6', opacity: 0.55 }, world);
    mk('rect', { x: -6, y: -22, width: 112, height: 9, rx: 1.5, fill: '#5b4632', stroke: '#1c1c1c', 'stroke-width': 0.5 }, world);
    // the inkstone, the brush and the order slip, off the paper
    const stone = mk('g', { transform: 'translate(122 18)' }, world);
    mk('path', { d: 'M-12 -16 L12 -16 Q16 -16 16 -12 L16 28 Q16 32 12 32 L-12 32 Q-16 32 -16 28 L-16 -12 Q-16 -16 -12 -16Z', fill: '#3a3a40', stroke: '#1c1c1c', 'stroke-width': 0.6 }, stone);
    mk('path', { d: 'M-10 -12 L10 -12 L10 2 Q0 6 -10 2Z', fill: '#111' }, stone);
    mk('path', { d: 'M-6 -8 q4 -2 8 0', fill: 'none', stroke: '#6d7a80', 'stroke-width': 0.6 }, stone);
    const brushG = mk('g', {}, world);
    mk('path', { d: 'M0 0 L-2.4 -46 L2.4 -46Z', fill: '#c79a64', stroke: '#1c1c1c', 'stroke-width': 0.5 }, brushG);
    mk('path', { d: 'M-2.4 -46 L2.4 -46 L2 -50 L-2 -50Z', fill: '#c8423a' }, brushG);
    mk('path', { d: 'M-2.6 0 Q-3.4 8 0 14 Q3.4 8 2.6 0Z', fill: '#1c1c1c' }, brushG);
    const done = mk('g', {}, world); // inked strokes
    const guide = mk('path', { fill: 'none', stroke: '#1c1c1c', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.1 }, world);
    const guideDash = mk('path', { fill: 'none', stroke: '#c8423a', 'stroke-width': 0.7, 'stroke-dasharray': '2 2', opacity: 0.7 }, world);
    const startDot = mk('circle', { r: 2.6, fill: '#c8423a', opacity: 0.8 }, world);
    const startNum = mk('text', { 'font-size': 4, 'font-weight': 700, fill: '#fbf3e6', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Georgia, serif' }, world);
    const wet = mk('path', { fill: '#1c1c1c', opacity: 0.9 }, world); // the stroke being drawn
    const ghostTrail = mk('path', { fill: 'none', stroke: '#1c1c1c', 'stroke-width': 1.2, 'stroke-dasharray': '0.1 3', 'stroke-linecap': 'round', opacity: 0 }, world);
    // the teacher's red marks
    const mark = mk('g', { opacity: 0 }, world);
    const hanamaru = mk('path', { fill: 'none', stroke: '#c8423a', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mark);
    const seal = mk('g', { opacity: 0 }, world);
    mk('rect', { x: -7, y: -7, width: 14, height: 14, rx: 1.6, fill: '#c8423a' }, seal);
    const sealT = mk('text', { 'font-size': 9, 'font-weight': 800, fill: '#fbf3e6', 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': '"Hiragino Mincho ProN","Yu Mincho",serif' }, seal);
    sealT.textContent = '旅';
    let open = false, op = 0, i = 0, user = [], down = false, scores = [], inked = [], finishT = -1, ghostT = -1, idle = 0, started = false;
    let scale = 1, ox = 0, oy = 0, now = 0, lastT = 0;
    const toPaper = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale]; };
    function showStroke() {
        const s = CHA[i];
        guide.setAttribute('d', 'M' + s.pts.map(pt).join('L'));
        guideDash.setAttribute('d', 'M' + s.pts.map(pt).join('L'));
        startDot.setAttribute('cx', f(s.pts[0][0]));
        startDot.setAttribute('cy', f(s.pts[0][1]));
        startNum.setAttribute('x', f(s.pts[0][0]));
        startNum.setAttribute('y', f(s.pts[0][1]));
        startNum.textContent = String(i + 1);
        title.querySelector('span').textContent = `${i + 1} / ${CHA.length}`;
        idle = 0;
    }
    svg.addEventListener('pointerdown', (e) => {
        if (!open || !started || finishT >= 0 || i >= CHA.length)
            return;
        e.preventDefault();
        svg.setPointerCapture(e.pointerId);
        down = true;
        user = [toPaper(e)];
        ghostT = -1;
        idle = 0;
        sfx.paper();
    });
    svg.addEventListener('pointermove', (e) => {
        if (!down)
            return;
        const p = toPaper(e), l = user[user.length - 1];
        if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.8)
            user.push(p);
        wet.setAttribute('d', user.length > 1 ? brush(user, 6.4, CHA[i].sweep) : '');
    });
    const up = () => {
        if (!down)
            return;
        down = false;
        wet.setAttribute('d', '');
        if (user.length < 3)
            return;
        const s = CHA[i];
        const r = compare(user, s.pts, 0.35);
        if (r.err < 10 && !r.reversed) {
            // accepted: the blended line is inked onto the paper
            const d = brush(r.blend, 7, s.sweep);
            const n = mk('path', { d, fill: '#1c1c1c', opacity: 0 }, done);
            n.style.transition = 'opacity .35s';
            requestAnimationFrame(() => n.setAttribute('opacity', '0.93'));
            inked.push(d);
            scores.push(clamp01(1 - r.err / 13));
            sfx.press();
            haptic(8);
            i++;
            if (i < CHA.length)
                showStroke();
            else {
                guide.setAttribute('d', '');
                guideDash.setAttribute('d', '');
                startDot.setAttribute('opacity', '0');
                startNum.textContent = '';
                finishT = 0;
            }
        }
        else {
            sfx.nope();
            haptic(12);
            tip.textContent = r.reversed ? 'Fırçayı kırmızı noktadan başlat.' : 'Soluk çizginin üstünden geç, acele etme.';
            tip.classList.add('show');
            setTimeout(() => tip.classList.remove('show'), 2600);
            ghostT = 0;
        }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    back.addEventListener('click', () => api.close());
    order.querySelector('button').addEventListener('click', () => { order.classList.remove('show'); started = true; showStroke(); tip.textContent = 'Kırmızı noktadan başla, soluk çizginin üstünden geç.'; tip.classList.add('show'); setTimeout(() => tip.classList.remove('show'), 3200); sfx.tap(); });
    const api = {
        get isOpen() { return open; },
        open() {
            open = true;
            op = 0;
            i = 0;
            scores = [];
            inked = [];
            finishT = -1;
            started = false;
            done.innerHTML = '';
            mark.setAttribute('opacity', '0');
            seal.setAttribute('opacity', '0');
            startDot.setAttribute('opacity', '0.8');
            guide.setAttribute('d', '');
            guideDash.setAttribute('d', '');
            startNum.textContent = '';
            title.querySelector('b').textContent = 'Sipariş · çay evinin tabelası';
            title.querySelector('span').textContent = '';
            svg.classList.add('show');
            ui.classList.add('show');
            setTimeout(() => order.classList.add('show'), 500);
        },
        close() { open = false; svg.classList.remove('show'); ui.classList.remove('show'); order.classList.remove('show'); onExit(); },
        /** for headless checks */
        _client(p) { const r = svg.getBoundingClientRect(); return [r.left + ox + p[0] * scale, r.top + oy + p[1] * scale]; },
        _start() { order.querySelector('button').dispatchEvent(new MouseEvent('click')); },
        get _i() { return i; },
        draw(t, dt) {
            now = t;
            void lastT;
            op = approach(op, open ? 1 : 0, 6, dt);
            if (!open && op < 0.01)
                return;
            svg.style.opacity = f(easeOut(op));
            // fit the paper (and a little desk) to the card
            const r = svg.getBoundingClientRect();
            const box = { x0: -14, y0: -30, x1: 142, y1: 122 };
            scale = Math.min((r.width - 28) / (box.x1 - box.x0), (r.height - 190) / (box.y1 - box.y0));
            ox = (r.width - (box.x1 - box.x0) * scale) / 2 - box.x0 * scale;
            oy = 92 + (r.height - 190 - (box.y1 - box.y0) * scale) / 2 - box.y0 * scale;
            const push = 1 + (1 - easeOut(op)) * 0.06;
            world.setAttribute('transform', `translate(${f(r.width / 2)} ${f(r.height / 2)}) scale(${f(push)}) translate(${f(-r.width / 2)} ${f(-r.height / 2)}) translate(${f(ox)} ${f(oy)}) scale(${f(scale)})`);
            // the brush sits on the stone, or follows your stroke
            const tipAt = down && user.length ? user[user.length - 1] : [122, 8];
            brushG.setAttribute('transform', `translate(${f(tipAt[0])} ${f(tipAt[1] - (down ? 0 : 6))}) rotate(${down ? 18 : 30})`);
            // breathing guide
            guide.setAttribute('opacity', f(0.08 + 0.05 * Math.sin(t * 3)));
            guideDash.setAttribute('stroke-dashoffset', f(-t * 6));
            startDot.setAttribute('r', f(2.6 + Math.sin(t * 5) * 0.4));
            // a ghost line runs along the template if you seem unsure
            idle += dt;
            if (started && !down && finishT < 0 && idle > 6 && ghostT < 0) {
                ghostT = 0;
                idle = 0;
            }
            if (ghostT >= 0 && i < CHA.length) {
                ghostT += dt;
                const u = easeInOut(clamp01(ghostT / 1.4));
                const pts = resample(CHA[i].pts, 20).slice(0, Math.max(2, Math.round(u * 20)));
                ghostTrail.setAttribute('d', 'M' + pts.map(pt).join('L'));
                ghostTrail.setAttribute('opacity', f(0.7 * (1 - clamp01((ghostT - 1.6) / 0.4))));
                if (ghostT > 2) {
                    ghostT = -1;
                    ghostTrail.setAttribute('opacity', '0');
                }
            }
            // finished: a hanamaru (or a plain circle) drawn in red, the seal pressed
            if (finishT >= 0) {
                finishT += dt;
                const score = scores.reduce((a, b) => a + b, 0) / scores.length;
                const great = score > 0.62;
                const u = easeInOut(clamp01((finishT - 0.4) / 1.2));
                const spiral = [];
                const turns = great ? 2.2 : 1, R = 52;
                for (let k = 0; k <= 80 * u; k++) {
                    const a = -2.2 + (k / 80) * turns * Math.PI * 2, rr = R * (great ? lerp(0.55, 1, k / 80) : 1);
                    spiral.push([50 + Math.cos(a) * rr + (great ? Math.cos(a * 5) * 3 : 0), 50 + Math.sin(a) * rr * 0.92 + (great ? Math.sin(a * 5) * 3 : 0)]);
                }
                mark.setAttribute('opacity', spiral.length > 1 ? '0.85' : '0');
                hanamaru.setAttribute('d', spiral.length > 1 ? 'M' + spiral.map(pt).join('L') : '');
                if (finishT > 0.4 && finishT - dt <= 0.4)
                    sfx.paper();
                const st = clamp01((finishT - 1.9) / 0.3);
                seal.setAttribute('opacity', f(st > 0 ? 1 : 0));
                seal.setAttribute('transform', `translate(90 106) rotate(${f(-6 + (1 - st) * 10)}) scale(${f(lerp(2, 1, backOut(st)))})`);
                if (finishT > 2.0 && finishT - dt <= 2.0) {
                    sfx.stamp();
                    haptic(20);
                }
                if (finishT > 2.2 && finishT - dt <= 2.2) {
                    tip.textContent = great ? 'Hanamaru! Çay evi buna bayılacak.' : 'Güzel olmuş. Elinin izi belli.';
                    tip.classList.add('show');
                }
                if (finishT > 4.2) {
                    finishT = -1;
                    tip.classList.remove('show');
                    onDone(inked, score);
                    api.close();
                }
            }
        },
    };
    return api;
}
