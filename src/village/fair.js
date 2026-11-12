// The summer fair at the west end of the street: a lane of yatai stalls under zig-zag
// strings of paper lanterns, a drum tower in the middle, a crowd in yukata, and
// fireworks once the sky darkens. Drawn in the street's own pen and coordinates
// (0…960 wide, feet on the same lanes), shown instead of the street when you go there.
import { el, pen, shape, f, pt, PAPER } from "../lib/ink.js";
import { W, H, BASE, SP, LANE, rnd, lerp, clamp, smooth, oval, rgb, hex, mix } from "./kit.js";
import { createKimono, createKid } from "./people.js";
const JP = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Songti SC",serif';
const P_ = (g, d, w = SP) => { const n = pen(g, w); n.setAttribute('d', d); return n; };
const S_ = (g, d, w = SP) => { const n = shape(g, w); n.setAttribute('d', d); return n; };
const C_ = (g, d, fill, w = SP) => el('path', { d, fill, stroke: 'currentColor', 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
const rect = (x0, y0, x1, y1) => `M${x0} ${y0} L${x1} ${y0} L${x1} ${y1} L${x0} ${y1}Z`;
function text(g, x, y, s, size, fill = 'currentColor', vertical = false) {
    const n = el('text', { x, y, 'font-size': size, 'font-family': JP, 'font-weight': 800, fill, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
    if (vertical)
        n.setAttribute('writing-mode', 'vertical-rl');
    n.textContent = s;
    return n;
}
const RED = '#c8423a', WARM = hex('#ffcf7e');
export function buildFair(svg, glowDefs) {
    const root = el('g', { style: 'display:none' }, svg);
    const back = el('g', {}, root);
    // sky (the same gradient as the street's), a few stars
    el('rect', { x: -40, y: -40, width: W + 80, height: 560, fill: 'url(#v-sky)' }, back);
    const stars = el('g', { opacity: 0 }, back);
    for (let i = 0; i < 40; i++)
        el('circle', { cx: f(rnd(0, W)), cy: f(rnd(8, 120)), r: f(rnd(0.4, 1)), fill: '#f5efda' }, stars);
    // far roofs in diluted ink
    const far = el('g', { opacity: 0.4 }, back);
    P_(far, 'M0 236 L60 214 L140 214 L200 236 M180 230 L250 206 L340 206 L400 230 M560 232 L640 208 L720 208 L780 232 M760 236 L830 212 L900 212 L960 236', SP * 0.8);
    P_(far, 'M440 240 L480 150 L520 240 M462 196 L498 196 M452 218 L508 218', SP * 0.8); // a pagoda between the stalls
    const fireL = el('g', {}, root);
    const ground = el('g', {}, root);
    const stallsL = el('g', {}, root);
    const ropes = el('g', {}, root);
    const actors = el('g', {}, root);
    const frontL = el('g', {}, root);
    const glowL = el('g', { style: 'pointer-events:none' }, root);
    // ground: the lane, paving, and the earth below
    const groundFill = el('rect', { x: -40, y: BASE, width: W + 80, height: H + 200 - BASE, fill: PAPER }, ground);
    P_(ground, `M-40 ${BASE} L${W + 40} ${BASE} M-40 ${BASE + 4} L${W + 40} ${BASE + 4} M-40 392 L${W + 40} 392`, SP);
    const pav = [];
    for (let i = 0; i < 70; i++) {
        const x = rnd(0, W), y = rnd(350, 388);
        pav.push(`M${f(x)} ${f(y)} l${f(rnd(6, 14))} ${f(rnd(-0.4, 0.4))}`);
    }
    for (let x = 0; x < W; x += rnd(16, 26))
        pav.push(`M${f(x)} 392 l${f(rnd(-4, 4))} 14`);
    P_(ground, pav.join(' '), SP * 0.45);
    const STALLS = [
        { x0: 18, x1: 148, sign: 'たこ焼', awning: RED, noren: '#34507a' },
        { x0: 164, x1: 294, sign: '金魚すくい', awning: '#34507a', noren: RED },
        { x0: 310, x1: 420, sign: '綿あめ', awning: '#d77a9a', noren: '#34507a' },
        { x0: 540, x1: 650, sign: 'お面', awning: RED, noren: '#2f3d2f' },
        { x0: 666, x1: 796, sign: 'りんご飴', awning: '#34507a', noren: RED },
        { x0: 812, x1: 942, sign: 'ヨーヨー', awning: RED, noren: '#34507a' },
    ];
    const awnings = [];
    const vendors = [];
    STALLS.forEach((s, i) => {
        const g = el('g', {}, stallsL);
        const cx = (s.x0 + s.x1) / 2;
        // posts and back cloth
        S_(g, rect(s.x0 + 4, 262, s.x1 - 4, BASE), SP * 0.7);
        P_(g, `M${s.x0 + 4} 262 L${s.x0 + 4} ${BASE} M${s.x1 - 4} 262 L${s.x1 - 4} ${BASE}`, SP * 1.4);
        // the vendor behind the counter, a hachimaki round the head
        const head = el('ellipse', { cx, cy: 292, rx: 5.2, ry: 6, fill: PAPER, stroke: 'currentColor', 'stroke-width': SP }, g);
        C_(g, `M${cx - 11} 312 Q${cx - 10} 300 ${cx} 299 Q${cx + 10} 300 ${cx + 11} 312Z`, i % 2 ? '#34507a' : '#7a4766', SP * 0.8);
        vendors.push({ head, x: cx, ph: rnd(0, 6) });
        // striped awning with a scalloped edge
        const n = Math.round((s.x1 - s.x0) / 12), sw = (s.x1 - s.x0) / n;
        let edge = '';
        for (let k = n - 1; k >= 0; k--) {
            const a = s.x0 + k * sw;
            edge += ` Q${f(a + sw / 2)} 280 ${f(a)} 272`;
        }
        const aw = C_(g, `M${s.x0 - 4} 252 L${s.x1 + 4} 252 L${s.x1} 272${edge}Z`, s.awning, SP * 0.8);
        awnings.push({ n: aw, c: s.awning });
        const stripes = [];
        for (let x = s.x0 + 8; x < s.x1; x += 16)
            stripes.push(`M${x} 252 L${x - 1} 272 L${x + 7} 272 L${x + 8} 252Z`);
        el('path', { d: stripes.join(' '), fill: '#fbf3e6', opacity: 0.85 }, g);
        // sign board on top
        C_(g, rect(cx - 30, 234, cx + 30, 250), '#fbf3e6', SP * 0.8);
        text(g, cx, 242.4, s.sign, s.sign.length > 4 ? 8.6 : 10);
        // counter
        C_(g, rect(s.x0, 318, s.x1, BASE), '#c79a64', SP * 0.9);
        P_(g, `M${s.x0} 324 L${s.x1} 324`, SP * 0.5);
        C_(g, rect(cx - 16, 328, cx + 16, 340), PAPER, SP * 0.6);
        text(g, cx, 334, s.sign.slice(0, 2), 7.4, s.noren);
    });
    // what each stall sells
    const items = el('g', {}, stallsL);
    // takoyaki: a pan of round dumplings that turn
    const tako = STALLS[0];
    C_(items, rect(tako.x0 + 18, 308, tako.x1 - 18, 318), '#3a3a40', SP * 0.6);
    const takoBalls = Array.from({ length: 10 }, (_, k) => C_(items, oval(tako.x0 + 26 + (k % 5) * 18, 309 - (k < 5 ? 0 : 3), 4, 3), '#c98b4a', SP * 0.6));
    const takoSteam = P_(items, '', SP * 0.4);
    // goldfish: a long shallow tub with fish swimming
    const kin = STALLS[1];
    C_(items, `M${kin.x0 + 10} 310 Q${(kin.x0 + kin.x1) / 2} 304 ${kin.x1 - 10} 310 L${kin.x1 - 14} 318 L${kin.x0 + 14} 318Z`, '#a9cfe0', SP * 0.7);
    const fish = Array.from({ length: 7 }, (_, k) => ({ n: el('path', { fill: k % 3 ? '#e8743a' : '#fbf3e6', stroke: 'currentColor', 'stroke-width': 0.5 }, items), ph: rnd(0, 6), sp: rnd(0.4, 0.9), y: 311 + (k % 3) * 2, r: rnd(18, 46) }));
    // cotton candy: puffy clouds on sticks and bags
    const wata = STALLS[2];
    const clouds = [];
    [[wata.x0 + 24, 296, '#f2b8c6'], [wata.x0 + 46, 290, '#bcd6ef'], [wata.x1 - 46, 292, '#f2b8c6'], [wata.x1 - 24, 297, '#fbf3e6']].forEach(([x, y, c]) => {
        P_(items, `M${x} ${y + 8} L${x} 318`, SP * 0.6);
        clouds.push(C_(items, `M${x - 8} ${y} q-2 -7 5 -8 q3 -6 9 -1 q7 -1 5 7 q4 5 -3 8 q-5 4 -10 0 q-7 1 -6 -6Z`, c, SP * 0.6));
    });
    // masks: a row of faces on the back cloth
    const men = STALLS[3];
    for (let k = 0; k < 4; k++) {
        const x = men.x0 + 20 + k * 24, y = 288;
        C_(items, oval(x, y, 8, 9.6), k === 1 ? '#f0c040' : '#fbf3e6', SP * 0.7);
        if (k === 0 || k === 3) {
            P_(items, `M${x - 6} ${y - 9} L${x - 3} ${y - 3} M${x + 6} ${y - 9} L${x + 3} ${y - 3}`, SP * 0.7);
            el('path', { d: `M${x - 5} ${y - 1} q2 -2 4 0 M${x + 1} ${y - 1} q2 -2 4 0 M${x - 2} ${y + 4} l2 1.6 l2 -1.6`, fill: 'none', stroke: RED, 'stroke-width': 0.9, 'stroke-linecap': 'round' }, items);
        }
        else
            P_(items, `M${x - 4} ${y - 2} l2 0 M${x + 2} ${y - 2} l2 0 M${x - 2} ${y + 4} q2 2 4 0`, SP * 0.8);
    }
    // candy apples: glossy red on sticks in a rack
    const ringo = STALLS[4];
    C_(items, rect(ringo.x0 + 16, 312, ringo.x1 - 16, 318), '#8f6a43', SP * 0.6);
    for (let k = 0; k < 7; k++) {
        const x = ringo.x0 + 24 + k * 14, y = 300 - (k % 2) * 4;
        P_(items, `M${x} ${y + 4} L${x} 313`, SP * 0.6);
        C_(items, oval(x, y, 5, 5), RED, SP * 0.6);
        el('path', { d: `M${x - 2.6} ${y - 2} q1.4 -1.6 3 -1.4`, fill: 'none', stroke: '#fff', 'stroke-width': 0.8, 'stroke-linecap': 'round' }, items);
    }
    // water balloons bobbing in a tub
    const yoyo = STALLS[5];
    C_(items, `M${yoyo.x0 + 12} 310 L${yoyo.x1 - 12} 310 L${yoyo.x1 - 16} 318 L${yoyo.x0 + 16} 318Z`, '#a9cfe0', SP * 0.7);
    const balloons = ['#e8743a', '#5b8fd0', '#f0c040', '#d77a9a', '#6bab6b', '#c8423a', '#9a7ad0'].map((c, k) => ({ n: C_(items, '', c, SP * 0.6), x: yoyo.x0 + 26 + k * 13, ph: rnd(0, 6) }));
    // ------------------------------------------------------------------ the drum tower
    const yg = el('g', {}, stallsL);
    P_(yg, 'M446 344 L452 282 M514 344 L508 282 M460 344 L462 300 M500 344 L498 300', SP * 1.3);
    C_(yg, rect(442, 276, 518, 284), '#c79a64', SP * 0.9);
    const kohaku = [];
    for (let x = 444; x < 516; x += 8)
        kohaku.push(`M${x} 284 L${x + 4} 284 L${x + 4} 304 Q${x + 2} 306 ${x} 304Z`);
    el('path', { d: rect(444, 284, 516, 305), fill: '#fbf3e6', stroke: 'currentColor', 'stroke-width': SP * 0.6 }, yg);
    el('path', { d: kohaku.join(' '), fill: RED }, yg);
    // the drum and the drummer
    C_(yg, `M466 260 Q480 254 494 260 L494 274 Q480 280 466 274Z`, '#8f6a43', SP * 0.8);
    C_(yg, oval(480, 260, 14, 4), '#efe2c4', SP * 0.7);
    const drummer = el('g', {}, yg);
    el('ellipse', { cx: 480, cy: 232, rx: 5.2, ry: 6, fill: PAPER, stroke: 'currentColor', 'stroke-width': SP }, drummer);
    el('path', { d: 'M474.6 229 L485.4 229 L485.4 231 L474.6 231Z', fill: RED }, drummer);
    C_(drummer, 'M469 256 Q469 242 480 240 Q491 242 491 256Z', '#fbf3e6', SP * 0.8);
    const sticks = P_(drummer, '', SP * 1.1);
    const donRings = P_(yg, '', SP * 0.5);
    // banners at the corners
    [436, 524].forEach((x) => { P_(yg, `M${x} 344 L${x} 196`, SP * 1.1); C_(yg, `M${x - (x < 480 ? 0 : 12)} 200 L${x + (x < 480 ? 12 : 0)} 200 L${x + (x < 480 ? 12 : 0)} 252 L${x - (x < 480 ? 0 : 12)} 252Z`, '#fbf3e6', SP * 0.6); text(yg, x + (x < 480 ? 6 : -6), 226, '夏祭', 8.4, RED, true); });
    const lanterns = [];
    const poles = [0, 160, 320, 480, 640, 800, 960];
    const rows = [{ y: 150, sag: 26, step: 30 }, { y: 200, sag: 18, step: 34 }];
    rows.forEach((row, ri) => {
        const d = [];
        for (let i = 0; i < poles.length - 1; i++) {
            const a = poles[i], b = poles[i + 1];
            const yA = row.y + (i % 2 ? 10 : 0), yB = row.y + ((i + 1) % 2 ? 10 : 0);
            const at = (u) => [lerp(a, b, u), lerp(yA, yB, u) + row.sag * 4 * u * (1 - u)];
            const pts = [];
            for (let k = 0; k <= 16; k++)
                pts.push(at(k / 16));
            d.push('M' + pts.map(pt).join('L'));
            const n = Math.floor((b - a) / row.step);
            for (let k = 1; k < n; k++) {
                const [x, y] = at(k / n);
                const red = (k + i + ri) % 2 === 0;
                const r = 4.2, h = 10;
                const lg = el('g', { transform: `translate(${f(x)} ${f(y)})` }, ropes);
                P_(lg, 'M0 0 L0 3', SP * 0.4);
                const body = el('path', { d: `M${-r * 0.75} 3 Q${-r * 1.18} ${3 + h / 2} ${-r * 0.75} ${3 + h} L${r * 0.75} ${3 + h} Q${r * 1.18} ${3 + h / 2} ${r * 0.75} 3Z`, fill: red ? RED : PAPER, stroke: 'currentColor', 'stroke-width': SP * 0.6 }, lg);
                el('path', { d: `M${-r * 0.5} 2.2 L${r * 0.5} 2.2 L${r * 0.5} 3.4 L${-r * 0.5} 3.4Z M${-r * 0.5} ${2.6 + h} L${r * 0.5} ${2.6 + h} L${r * 0.5} ${3.8 + h} L${-r * 0.5} ${3.8 + h}Z`, fill: 'currentColor' }, lg);
                if (!red && k % 3 === 0)
                    text(lg, 0, 3 + h / 2, '祭', 4.6, RED);
                const glow = el('circle', { cx: f(x), cy: f(y + 8), r: 24, fill: glowDefs.glow, opacity: 0 }, glowL);
                lanterns.push({ x, y, glow, body, red, ph: rnd(0, 6) });
            }
        }
        P_(ropes, d.join(' '), SP * 0.5);
    });
    poles.forEach((x) => { P_(ropes, `M${x} ${BASE + 2} L${x} 136`, SP * 1.1); });
    // the canal runs on below the fair: paper lanterns float on it (tōrō nagashi)
    const water = el('path', { d: `M-40 424 L${W + 40} 424 L${W + 40} 640 L-40 640Z`, fill: '#d6dde0' }, frontL);
    P_(frontL, `M-40 424 L${W + 40} 424`, SP);
    const ripples = P_(frontL, '', SP * 0.45);
    const floats = Array.from({ length: 14 }, (_, k) => {
        const g = el('g', {}, frontL);
        const refl = el('path', { fill: 'none', stroke: '#ffcf7e', 'stroke-width': 1.4, 'stroke-linecap': 'round', opacity: 0 }, g);
        C_(g, 'M-6 4 L6 4 L5 6.6 L-5 6.6Z', '#8f6a43', SP * 0.5);
        const box = C_(g, 'M-4 4 L-4 -4 L4 -4 L4 4Z', PAPER, SP * 0.55);
        P_(g, 'M-4 -4 L0 -7 L4 -4', SP * 0.5);
        const glow = el('circle', { r: 18, fill: glowDefs.glow, opacity: 0 }, glowL);
        return { g, box, refl, glow, x: rnd(0, W), y: 440 + (k % 5) * 16 + rnd(-3, 3), v: rnd(3, 7), ph: rnd(0, 6) };
    });
    // a low front fence with a lantern on every other post
    const fence = [`M-20 404 L${W + 20} 404 M-20 410 L${W + 20} 410`];
    for (let x = 0; x <= W; x += 40)
        fence.push(`M${x} 398 L${x} 420`);
    P_(frontL, fence.join(' '), SP * 0.9);
    for (let x = 20; x <= W; x += 80) {
        const lg = el('g', { transform: `translate(${x} 384)` }, frontL);
        const body = el('path', { d: 'M-4 3 Q-6.6 8 -4 13 L4 13 Q6.6 8 4 3Z', fill: PAPER, stroke: 'currentColor', 'stroke-width': SP * 0.6 }, lg);
        el('path', { d: 'M0 3 L0 14', fill: 'none', stroke: 'currentColor', 'stroke-width': SP * 0.5 }, lg);
        lanterns.push({ x, y: 384, glow: el('circle', { cx: x, cy: 392, r: 20, fill: glowDefs.glow, opacity: 0 }, glowL), body, red: false, ph: rnd(0, 6) });
    }
    const bursts = [];
    let nextBurst = 1.5;
    function burst() {
        const x = rnd(80, W - 80), y = rnd(80, 165), c = ['#ffcf7e', '#f2b8c6', '#a9cfe0', '#ffe9a8', '#e8743a'][Math.floor(rnd(0, 5))];
        const g = el('g', {}, fireL);
        const rays = el('path', { fill: 'none', stroke: c, 'stroke-width': 1.1, 'stroke-linecap': 'round' }, g);
        const dots = el('path', { fill: 'none', stroke: c, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
        bursts.push({ g, rays, dots, x, y, t: 0, n: Math.round(rnd(14, 22)), r: rnd(22, 40), c });
    }
    // ------------------------------------------------------------------ the crowd
    const crowd = [];
    let spawnT = 0;
    function addWalker(night, x) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const sx = x ?? (dir > 0 ? -60 : W + 60);
        const lane = [LANE.back, LANE.mid, LANE.front][Math.floor(rnd(0, 3))] + rnd(-2, 2);
        const p = (Math.random() < 0.7 ? createKimono(actors, glowL, { dir, x: sx, y: lane, lantern: night && Math.random() < 0.5 }) : createKid(actors, glowL, { dir, x: sx, y: lane }));
        crowd.push(p);
    }
    let filled = false;
    return {
        root, actors,
        bounds: { x0: 14, x1: W - 14 },
        view: { x0: 0, x1: W },
        spawn: { x: 60, y: 362 },
        exitX: 40,
        draw(t, dt, P, wind, player) {
            const dark = smooth(0.05, 0.4, P.lamp), glowK = 0.32 + 0.68 * dark; // a fair is lit even before dusk
            const lit = 0.55 + 0.45 * dark;
            stars.setAttribute('opacity', f(P.night));
            groundFill.setAttribute('fill', rgb(P.paper));
            awnings.forEach((a) => a.n.setAttribute('fill', rgb(mix(hex(a.c), mix(hex(a.c), [12, 16, 30], 0.6), P.inkT * 0.45))));
            // lanterns: lit all day at a fair, brighter as it gets dark, each flickering on its own
            lanterns.forEach((l) => {
                const fl = 0.9 + 0.1 * Math.sin(t * 5 + l.ph) * Math.sin(t * 2.3 + l.ph * 2);
                l.glow.setAttribute('opacity', f(glowK * 0.85 * fl));
                if (!l.red)
                    l.body.setAttribute('fill', rgb(mix(P.paper, WARM, lit * 0.9)));
                else
                    l.body.setAttribute('fill', rgb(mix(hex(RED), hex('#ff8a4a'), smooth(0.05, 0.4, P.lamp) * 0.8)));
            });
            // the floating lanterns drift downstream, bobbing, their light in the water
            water.setAttribute('fill', rgb(mix(hex('#d6dde0'), hex('#1c2540'), P.inkT)));
            ripples.setAttribute('d', Array.from({ length: 18 }, (_, k) => { const x = ((k * 61 + t * 6) % (W + 80)) - 40, y = 432 + (k % 6) * 13; return `M${f(x)} ${y} l${10 + (k % 4) * 5} 0`; }).join(' '));
            floats.forEach((fl) => {
                fl.x += fl.v * dt;
                if (fl.x > W + 30)
                    fl.x = -30;
                const y = fl.y + Math.sin(t * 1.3 + fl.ph) * 0.8;
                fl.g.setAttribute('transform', `translate(${f(fl.x)} ${f(y)}) rotate(${f(Math.sin(t + fl.ph) * 3)})`);
                fl.box.setAttribute('fill', rgb(mix(P.paper, WARM, lit * 0.95)));
                fl.refl.setAttribute('d', `M0 9 l0 ${f(6 + dark * 10)} M-2.6 11 l0 ${f(3 + dark * 6)} M2.6 11 l0 ${f(3 + dark * 6)}`);
                fl.refl.setAttribute('stroke-dasharray', '1.6 2.2');
                fl.refl.setAttribute('opacity', f(glowK * 0.8));
                fl.glow.setAttribute('cx', f(fl.x));
                fl.glow.setAttribute('cy', f(y));
                fl.glow.setAttribute('opacity', f(glowK * 0.8));
            });
            // stalls come alive
            takoBalls.forEach((b, k) => b.setAttribute('transform', `rotate(${f(Math.sin(t * 2 + k) * 25)} ${tako.x0 + 26 + (k % 5) * 18} 309)`));
            takoSteam.setAttribute('d', [0, 1, 2].map((k) => { const x = tako.x0 + 40 + k * 22, s = Math.sin(t * 1.4 + k); return `M${x} 302 q${f(4 + s * 2)} -6 0 -12 q${f(-4 - s * 2)} -6 0 -12`; }).join(' '));
            takoSteam.setAttribute('opacity', '0.4');
            const kcx = (kin.x0 + kin.x1) / 2;
            fish.forEach((fi) => {
                const a = t * fi.sp + fi.ph, x = kcx + Math.cos(a) * fi.r * 0.9, y = fi.y + Math.sin(a * 1.7) * 1.2, d = -Math.sin(a) >= 0 ? 1 : -1;
                fi.n.setAttribute('d', `M${f(x - 3 * d)} ${f(y)} q${f(3 * d)} -2 ${f(6 * d)} 0 q${f(-3 * d)} 2 ${f(-6 * d)} 0 l${f(-2.4 * d)} -1.6 l0 3.2Z`);
            });
            clouds.forEach((c, k) => c.setAttribute('transform', `translate(0 ${f(Math.sin(t * 1.2 + k) * 0.8)})`));
            balloons.forEach((b) => { const y = 309 + Math.sin(t * 1.6 + b.ph) * 1.2; b.n.setAttribute('d', `${oval(b.x, y, 5, 4.2)} M${b.x} ${f(y - 4)} l0 -3`); });
            vendors.forEach((v) => { v.head.setAttribute('cy', f(292 + Math.sin(t * 1.3 + v.ph) * 0.6)); v.head.setAttribute('cx', f(v.x + Math.sin(t * 0.7 + v.ph) * 1.2)); });
            // the drum: don… don-don
            const beat = (t * 1.6) % 2, hit = beat < 0.12 || (beat > 0.5 && beat < 0.62) ? 1 : 0;
            const arm = hit ? 4 : -6 + Math.sin(t * 9) * 2;
            sticks.setAttribute('d', `M471 246 L${468 - arm * 0.4} ${f(250 + arm)} M489 246 L${492 + arm * 0.4} ${f(250 + arm)}`);
            const ring = (beat % 0.5) / 0.5;
            donRings.setAttribute('d', `M${f(480 - 18 - ring * 18)} ${f(258 - ring * 6)} q${f(-4 - ring * 4)} ${f(6)} 0 ${f(12)} M${f(480 + 18 + ring * 18)} ${f(258 - ring * 6)} q${f(4 + ring * 4)} ${f(6)} 0 ${f(12)}`);
            donRings.setAttribute('opacity', f((1 - ring) * 0.7));
            // fireworks once the sky darkens
            nextBurst -= dt;
            if (nextBurst < 0) {
                nextBurst = rnd(1.2, 3.2);
                if (P.night > 0.12)
                    burst();
            }
            for (let i = bursts.length - 1; i >= 0; i--) {
                const b = bursts[i];
                b.t += dt;
                const u = clamp(b.t / 1.4, 0, 1), e = 1 - Math.pow(1 - u, 3);
                const rays = [], dots = [];
                for (let k = 0; k < b.n; k++) {
                    const a = (k / b.n) * Math.PI * 2, r0 = b.r * e * 0.55, r1 = b.r * e;
                    const sag = u * u * 8;
                    rays.push(`M${f(b.x + Math.cos(a) * r0)} ${f(b.y + Math.sin(a) * r0 + sag * 0.5)} L${f(b.x + Math.cos(a) * r1)} ${f(b.y + Math.sin(a) * r1 + sag)}`);
                    dots.push(`M${f(b.x + Math.cos(a) * r1 * 1.08)} ${f(b.y + Math.sin(a) * r1 * 1.08 + sag)} l0.01 0`);
                }
                b.rays.setAttribute('d', rays.join(' '));
                b.dots.setAttribute('d', dots.join(' '));
                b.g.setAttribute('opacity', f((1 - smooth(0.5, 1, u)) * P.night));
                if (b.t > 1.5) {
                    b.g.remove();
                    bursts.splice(i, 1);
                }
            }
            // the crowd keeps coming
            if (!filled) {
                filled = true;
                for (let k = 0; k < 9; k++)
                    addWalker(P.night > 0.4, rnd(40, W - 40));
            }
            spawnT -= dt;
            if (spawnT < 0) {
                spawnT = rnd(1.2, 2.6);
                if (crowd.length < 14)
                    addWalker(P.night > 0.4);
            }
            for (let i = crowd.length - 1; i >= 0; i--) {
                const p = crowd[i];
                p.draw(t, dt, P, wind);
                if (p.done) {
                    p.remove();
                    crowd.splice(i, 1);
                }
            }
            // depth: nearer the fence, drawn in front
            const all = [...crowd.map((c) => ({ g: c.g, y: c.y })), { g: player.g, y: player.y }];
            all.sort((a, b) => a.y - b.y);
            let prev = null;
            for (const p of all) {
                if (p.g.parentNode !== actors || p.g.previousElementSibling !== prev)
                    actors.insertBefore(p.g, prev ? prev.nextSibling : actors.firstChild);
                prev = p.g;
            }
        },
    };
}
