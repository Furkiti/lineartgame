// Inside the bath house at the end of the street: a small home, drawn as a cut-away
// in the same pen as the village — genkan, a tatami room, a kitchen — where the
// traveller makes nigiri at the counter, carries them to the low table and eats.
//
// The interior lives in the same <svg> as the street, far to the right of it (x ≥ IX),
// so it shares the camera, the ink colour and the paper colour of the hour.
import { el, pen, shape, blot, f, pt, PAPER } from "../lib/ink.js";
import { W, BASE, SP, lerp, clamp, smooth, ease, easeOut, oval, rgb, hex, mix } from "./kit.js";
export const IX = 1300; // where the interior starts in scene x
export const IW = 380; // its width
const FLOOR_FRONT = 398; // the near edge of the floor
const JP = '"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP","Songti SC",serif';
const COL = {
    wood: hex('#c79a64'), woodDark: hex('#8f6a43'), tatami: hex('#e4d9a0'), heri: hex('#4d5a3a'),
    red: hex('#b3412d'), indigo: hex('#34507a'), salmon: hex('#ec8c5f'), tuna: hex('#c8423a'),
    rice: hex('#fbf8ee'), warm: hex('#ffcf7e'), copper: hex('#b8733f'), night: [12, 16, 30],
};
const tint = (c, P, k = 0.55) => rgb(mix(c, mix(c, COL.night, 0.6), P.inkT * k));
const P_ = (g, d, w = SP) => { const n = pen(g, w); n.setAttribute('d', d); return n; };
const S_ = (g, d, w = SP) => { const n = shape(g, w); n.setAttribute('d', d); return n; };
const B_ = (g, d) => { const n = blot(g); n.setAttribute('d', d); return n; };
const C_ = (g, d, fill, w = SP) => el('path', { d, fill, stroke: 'currentColor', 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
const rect = (x0, y0, x1, y1) => `M${x0} ${y0} L${x1} ${y0} L${x1} ${y1} L${x0} ${y1}Z`;
function text(g, x, y, s, size, { vertical = false, weight = 700, fill = 'currentColor' } = {}) {
    const n = el('text', { x, y, 'font-size': size, 'font-family': JP, 'font-weight': weight, fill, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
    if (vertical) {
        n.setAttribute('writing-mode', 'vertical-rl');
        n.setAttribute('glyph-orientation-vertical', '0');
    }
    n.textContent = s;
    return n;
}
// where things are, in interior x (add IX for scene x)
const SPOT = {
    door: 40, // genkan door: come in / go out
    table: 186, // the chabudai
    cook: 262, // stand here to work at the cutting board
    futon: 116, // the bedding, laid out at night
};
const DISH_HOME = [280.5, 315]; // the cutting board's top, middle of the three pieces
const TABLE_TOP = [186, 335.4];
const SLOT_X = [-7.5, 0, 7.5];
const TUB = [42.5, -6]; // rice tub, relative to the dish
const PILE = [14, -0.4]; // where cut slices land
const BLOCK = { x1: 307, y0: 309, y1: 315, w0: 9.2, cut: 2.2 };
export function buildHome(svg) {
    const root = el('g', { style: 'display:none' }, svg);
    const inner = (parent = root) => el('g', { transform: `translate(${IX} 0)` }, parent);
    // ------------------------------------------------------------------ sky and ground around the house
    el('rect', { x: W + 20, y: -40, width: IX - W + IW + 1000, height: 560, fill: 'url(#v-sky)' }, root);
    const house = inner();
    // ground outside the walls
    const grd = el('rect', { x: -400, y: 416, width: IW + 800, height: 80, fill: PAPER }, house);
    P_(house, `M-400 416 L${IW + 400} 416`, SP);
    const tufts = [];
    for (let x = -380; x < IW + 400; x += 23 + ((x * 7) % 11)) {
        if (x > -6 && x < IW + 6)
            continue;
        tufts.push(`M${x} 416 q1 -4 3 -5 M${x + 2} 416 q0 -3 -2 -5 M${x + 4} 416 q1 -3 3 -3`);
    }
    P_(house, tufts.join(' '), SP * 0.5);
    const dots = [];
    for (let i = 0; i < 80; i++) {
        const x = -390 + ((i * 97.3) % (IW + 780)), y = 424 + ((i * 37.1) % 50);
        dots.push(`M${f(x)} ${f(y)} l1.4 0`);
    }
    P_(house, dots.join(' '), SP * 0.45);
    // ------------------------------------------------------------------ the cut-away shell
    // roof: tiles outside, rafters inside, a gable we see in section
    const ridge = [190, 128], eL = [-18, 242], eR = [IW + 18, 242];
    S_(house, `M${pt(eL)} L${pt(ridge)} L${pt(eR)} L${IW + 12} 250 L${ridge[0]} ${ridge[1] + 12} L-12 250Z`, SP);
    const tiles = [];
    for (let k = 1; k < 24; k++) {
        const u = k / 24;
        [[eL, -1], [eR, 1]].forEach(([e, s]) => {
            const x = lerp(e[0], ridge[0], u), y = lerp(e[1], ridge[1], u);
            tiles.push(`M${f(x)} ${f(y)} l${f(-s * 2.2)} ${f(-4.6)}`);
        });
    }
    P_(house, tiles.join(' '), SP * 0.5);
    [eL, eR].forEach((e) => S_(house, oval(e[0], e[1] + 1, 2.4, 2.4), SP * 0.6));
    // attic under the roof: rafters, purlins in section, a king post and the big curved beam
    const attic = `M-12 250 L${ridge[0]} ${ridge[1] + 12} L${IW + 12} 250Z`;
    el('path', { d: attic, fill: PAPER, stroke: 'none' }, house);
    P_(house, `M-4 248 L${ridge[0]} ${ridge[1] + 16} L${IW + 4} 248`, SP * 0.6);
    for (let k = 1; k < 6; k++) {
        const u = k / 6;
        [[-4, 248], [IW + 4, 248]].forEach(([x0, y0]) => {
            const x = lerp(x0, ridge[0], u), y = lerp(y0, ridge[1] + 16, u);
            S_(house, rect(+f(x - 2.6), +f(y), +f(x + 2.6), +f(y + 5)), SP * 0.6);
        });
    }
    S_(house, rect(186, 150, 194, 236), SP * 0.8);
    P_(house, 'M190 220 L120 196 M190 220 L260 196 M188 160 L190 158', SP * 0.8);
    S_(house, rect(184, 142, 196, 150), SP * 0.7);
    // hari: the smoke-dark curved log beam
    C_(house, `M-6 236 Q${IW / 2} 224 ${IW + 6} 236 L${IW + 6} 247 Q${IW / 2} 236 -6 247Z`, rgb(COL.woodDark), SP);
    P_(house, `M20 238 Q${IW / 2} 228 ${IW - 20} 238 M60 243 Q${IW / 2} 234.5 ${IW - 60} 243`, SP * 0.4);
    // back wall: plaster above, boards below
    S_(house, rect(0, 246, IW, BASE), SP * 0.9);
    const wain = [`M0 316 L${IW} 316`];
    for (let x = 4; x < IW; x += 5)
        wain.push(`M${x} 316 L${x} ${BASE}`);
    P_(house, wain.join(' '), SP * 0.4);
    // posts
    [[0, 8], [78, 84], [236, 242], [IW - 8, IW]].forEach(([a, b]) => {
        C_(house, rect(a, 244, b, BASE), rgb(COL.wood), SP * 0.8);
        P_(house, `M${a + 2} 252 q1 30 0 60 M${b - 2} 268 q-1 26 0 50`, SP * 0.35);
    });
    // cut walls at both ends, hatched like wood in section
    [[-8, 0], [IW, IW + 8]].forEach(([a, b]) => {
        S_(house, rect(a, 246, b, FLOOR_FRONT + 6), SP);
        const h = [];
        for (let y = 250; y < FLOOR_FRONT + 6; y += 6)
            h.push(`M${a} ${y + 4} L${b} ${y}`);
        P_(house, h.join(' '), SP * 0.35);
    });
    // floors: earthen genkan, raised tatami room, earthen kitchen
    const floor = el('g', {}, house);
    const doma = (a, b) => {
        S_(floor, rect(a, BASE, b, FLOOR_FRONT), SP * 0.8);
        const st = [];
        for (let i = 0; i < (b - a) / 9; i++) {
            const x = a + 4 + ((i * 13.7) % (b - a - 8)), y = BASE + 6 + ((i * 17.3) % (FLOOR_FRONT - BASE - 12));
            st.push(oval(x, y, 3 + (i % 3), 1.2 + (i % 2) * 0.4));
        }
        P_(floor, st.join(' '), SP * 0.4);
    };
    doma(0, 84);
    doma(236, IW);
    const tatami = C_(floor, rect(84, BASE, 236, FLOOR_FRONT), rgb(COL.tatami), SP * 0.8);
    const tl = [];
    for (let y = BASE + 3; y < FLOOR_FRONT; y += 3)
        tl.push(`M84 ${y} L236 ${y}`);
    P_(floor, tl.join(' '), SP * 0.22);
    const heri = el('path', { d: `M84 371 L236 371 M160 ${BASE} L160 ${FLOOR_FRONT}`, fill: 'none', stroke: rgb(COL.heri), 'stroke-width': 2.2 }, floor);
    P_(floor, `M84 369.9 L236 369.9 M84 372.1 L236 372.1 M158.9 ${BASE} L158.9 ${FLOOR_FRONT} M161.1 ${BASE} L161.1 ${FLOOR_FRONT}`, SP * 0.35);
    // step up from the genkan, and the front sill + foundation stones
    C_(floor, rect(80, BASE, 86, FLOOR_FRONT), rgb(COL.wood), SP * 0.8);
    C_(house, rect(-8, FLOOR_FRONT, IW + 8, FLOOR_FRONT + 6), rgb(COL.woodDark), SP);
    const stones = [];
    for (let x = -4; x < IW + 6; x += 22)
        stones.push(`M${x} 416 Q${x - 1} 405 ${x + 9} 404.6 Q${x + 19} 405 ${x + 18} 416`);
    S_(house, stones.join(' '), SP * 0.7);
    // ------------------------------------------------------------------ genkan
    // the lattice door we came in by, the street light showing through it
    const doorPane = el('path', { d: rect(16, 282, 64, BASE), fill: PAPER }, house);
    const lat = [`M16 282 L64 282 L64 ${BASE} L16 ${BASE}Z`, `M40 282 L40 ${BASE}`, `M16 290 L64 290`];
    for (let x = 18.5; x < 64; x += 2.5)
        if (Math.abs(x - 40) > 1)
            lat.push(`M${x} 290 L${x} ${BASE - 2}`);
    P_(house, lat.join(' '), SP * 0.5);
    C_(house, rect(13, 278, 67, 282), rgb(COL.wood), SP * 0.7);
    // a short noren inside the door
    C_(house, `M18 283 L39 283 L38.6 296 L18.4 296.4Z M41 283 L62 283 L61.6 296.4 L41.4 296Z`, rgb(COL.indigo), SP * 0.6);
    text(house, 40, 289.6, 'ゆ', 7, { fill: '#f3ead8' });
    // sandals on the earth floor
    B_(house, 'M30 356 q3 -1.6 7 0 q0.8 1.6 -1 2 l-5 0 q-1.6 -0.4 -1 -2Z M39 357 q3 -1.6 7 0 q0.8 1.6 -1 2 l-5 0 q-1.6 -0.4 -1 -2Z');
    // umbrella in a stand
    S_(house, rect(66, 332, 74, BASE), SP * 0.6);
    P_(house, 'M70 332 L71 300 M71 300 Q67 312 68 330 M71 300 Q75 312 73 330', SP * 0.6);
    // ------------------------------------------------------------------ tatami room
    // tokonoma with a hanging scroll and a vase
    S_(house, rect(92, 254, 142, 334), SP * 0.8);
    C_(house, rect(92, 330, 142, 336), rgb(COL.wood), SP * 0.7);
    S_(house, rect(106, 262, 128, 318), SP * 0.6);
    P_(house, 'M104 262 L130 262 M104 318.4 L130 318.4 M117 256 L117 262 M113 256 L121 256', SP * 0.8);
    text(house, 117, 288, '松', 13);
    P_(house, 'M110 304 q4 -4 7 -1 q3 -5 8 -2', SP * 0.4);
    S_(house, 'M132 330 Q128 326 130 321 L134 321 Q136 326 132 330Z', SP * 0.6);
    P_(house, 'M132 321 Q131 312 126 306 M132 321 Q134 310 140 304 M127 307 l-3 -1 M139 305 l2 -3', SP * 0.5);
    // shoji window with the hour outside
    const windowPane = el('path', { d: rect(152, 258, 228, 304), fill: PAPER }, house);
    const sg = [rect(152, 258, 228, 304)];
    for (let i = 1; i < 6; i++)
        sg.push(`M${152 + (76 * i) / 6} 258 L${152 + (76 * i) / 6} 304`);
    for (let i = 1; i < 4; i++)
        sg.push(`M152 ${258 + (46 * i) / 4} L228 ${258 + (46 * i) / 4}`);
    P_(house, sg.join(' '), SP * 0.5);
    C_(house, rect(149, 304, 231, 307), rgb(COL.wood), SP * 0.6);
    // chabudai and two cushions
    const zab = [C_(house, 'M146 352 Q145 348 150 347.6 L166 347.6 Q171 348 170 352 Q170 355 165 355 L151 355 Q146 355 146 352Z', rgb(COL.red), SP * 0.7),
        C_(house, 'M202 352 Q201 348 206 347.6 L222 347.6 Q227 348 226 352 Q226 355 221 355 L207 355 Q202 355 202 352Z', rgb(COL.red), SP * 0.7)];
    P_(house, 'M158 349 l0 4 M156 351 l4 0 M214 349 l0 4 M212 351 l4 0', SP * 0.5);
    // bedding laid out at night in front of the tokonoma
    const futon = el('g', { opacity: 0 }, house);
    C_(futon, 'M92 352 Q91 347 97 347 L141 347 Q147 347 146 352 L146 357 Q146 361 140 361 L98 361 Q92 361 92 357Z', PAPER, SP * 0.8);
    const quilt = C_(futon, 'M104 348.6 L144 348.6 Q146 349 146 352 L146 357 Q146 360.6 141 360.6 L104 360.6Z', rgb(COL.indigo), SP * 0.7);
    P_(futon, 'M112 349 l0 11 M122 349 l0 11 M132 349 l0 11', SP * 0.35);
    C_(futon, 'M94 349.6 Q94 348 98 348 L101 348 Q103 348 103 350 L103 352 Q103 354 101 354 L97 354 Q94 354 94 352Z', PAPER, SP * 0.6);
    const tableTop = C_(house, `M162 335.4 Q162 331.6 186 331.6 Q210 331.6 210 335.4 L210 338 Q210 339.4 186 339.4 Q162 339.4 162 338Z`, rgb(COL.wood), SP * 0.8);
    P_(house, 'M162 335.6 Q186 339 210 335.6', SP * 0.45);
    P_(house, 'M167 339 L167 350 M205 339 L205 350 M171 339.2 L171 347', SP * 1.1);
    // a paper lamp from the beam
    P_(house, 'M186 241 L186 262', SP * 0.6);
    const lampShade = C_(house, 'M178 264 Q177 272 179 280 L193 280 Q195 272 194 264Z', PAPER, SP * 0.8);
    P_(house, 'M177.6 268 L194.4 268 M177.4 272 L194.6 272 M177.8 276 L194.2 276', SP * 0.35);
    C_(house, rect(180, 262, 192, 264.4), rgb(COL.woodDark), SP * 0.5);
    // ------------------------------------------------------------------ kitchen
    // a short indigo noren where the kitchen starts
    C_(house, `M244 247 L268 247 L267.6 264 L244.4 264.4Z M270 247 L294 247 L293.6 264.4 L270.4 264Z`, rgb(COL.indigo), SP * 0.6);
    text(house, 256, 255.6, '台', 8, { fill: '#f3ead8' });
    text(house, 282, 255.6, '所', 8, { fill: '#f3ead8' });
    // shelf with bowls, hooks with a ladle and a strainer
    C_(house, rect(300, 280, 366, 283), rgb(COL.wood), SP * 0.7);
    P_(house, 'M304 283 L306 289 M362 283 L360 289', SP * 0.6);
    [[308, 274], [318, 274], [313, 268.6]].forEach(([x, y]) => S_(house, `M${x - 4.6} ${y} Q${x} ${y + 6.6} ${x + 4.6} ${y}Z`, SP * 0.6));
    C_(house, 'M330 271 L336 271 L335.4 280 L330.6 280Z', rgb(COL.indigo), SP * 0.6);
    C_(house, 'M340 273 L345 273 L344.6 280 L340.4 280Z', PAPER, SP * 0.6);
    C_(house, 'M352 266 Q352 262 357 262 Q362 262 362 266 L362 280 L352 280Z', rgb(COL.woodDark), SP * 0.6);
    P_(house, 'M300 292 L366 292', SP * 0.7);
    P_(house, 'M314 292 L314 300 M314 300 q-3 0 -3 3 q0 3 3 3 q3 0 3 -3 q0 -3 -3 -3 M330 292 L330 297', SP * 0.6);
    S_(house, oval(330, 301, 4, 4), SP * 0.5);
    P_(house, 'M327.4 299 l5.2 4 M327.4 303 l5.2 -4', SP * 0.3);
    // the counter: wooden top, sliding doors below, a sink, the rice tub
    C_(house, rect(248, 318, 370, 322), rgb(COL.wood), SP * 0.8);
    S_(house, rect(250, 322, 368, BASE), SP * 0.8);
    P_(house, 'M289 322 L289 344 M329 322 L329 344', SP * 0.6);
    [[283, 333], [295, 333], [323, 333], [335, 333], [362, 333]].forEach(([x, y]) => S_(house, oval(x, y, 1.1, 2.2), SP * 0.4));
    // sink: a dark opening in the top and a bamboo spout
    B_(house, 'M336 318.4 L358 318.4 L356 320.2 L338 320.2Z');
    C_(house, 'M346 296 L350 296 L350 307 Q350 310 347 310 L343 310 L343 307.6 L346 307.6Z', rgb(hex('#9fb36a')), SP * 0.6);
    // the cutting board
    C_(house, rect(268, 315, 308, 318), rgb(mix(COL.wood, [255, 245, 225], 0.45)), SP * 0.7);
    P_(house, 'M271 318 L271 318.8 M305 318 L305 318.8', SP * 1.2);
    // the rice tub (hangiri), steaming rice in it
    C_(house, 'M313 312 L333 312 L331.6 318 L314.4 318Z', rgb(COL.wood), SP * 0.7);
    P_(house, 'M313.6 314.6 L332.4 314.6', SP * 0.9).setAttribute('stroke', rgb(COL.copper));
    C_(house, 'M314.4 312 Q323 306.6 331.6 312Z', rgb(COL.rice), SP * 0.6);
    const steam = P_(house, '', SP * 0.45);
    // a hanging bulb for the kitchen
    P_(house, 'M300 241 L300 260', SP * 0.6);
    C_(house, 'M293 264 L296 259 L304 259 L307 264Z', rgb(COL.woodDark), SP * 0.6);
    const bulb = el('ellipse', { cx: 300, cy: 266, rx: 2.6, ry: 2.4, fill: PAPER, stroke: 'currentColor', 'stroke-width': SP * 0.5 }, house);
    // ------------------------------------------------------------------ what moves
    const props = inner();
    const actors = el('g', {}, root);
    const top = inner();
    const glowL = inner();
    const fx = inner();
    const glows = [
        el('circle', { cx: 186, cy: 272, r: 70, fill: 'url(#v-warmglow)', opacity: 0 }, glowL),
        el('circle', { cx: 300, cy: 268, r: 52, fill: 'url(#v-warmglow)', opacity: 0 }, glowL),
    ];
    // fish block and knife stay on the board
    const block = C_(props, '', rgb(COL.salmon), SP * 0.6);
    const blockLines = el('path', { fill: 'none', stroke: '#fff3e6', 'stroke-width': 0.5, 'stroke-linecap': 'round' }, props);
    const knife = el('g', {}, props);
    C_(knife, 'M0 -0.4 L12.4 -0.4 Q13.4 -0.6 13.2 -1.8 L0 -2.2Z', PAPER, SP * 0.5);
    C_(knife, 'M-6.4 -0.6 L0 -0.6 L0 -2 L-6.4 -2Z', rgb(COL.woodDark), SP * 0.5);
    // the dish: a geta board and three nigiri (each a rice dome and a slice)
    const dish = el('g', {}, props);
    const geta = el('g', { opacity: 0 }, dish);
    const getaTop = C_(geta, 'M-14 -3.4 L14 -3.4 L14 -1.8 L-14 -1.8Z', rgb(COL.wood), SP * 0.6);
    P_(geta, 'M-10.6 -1.8 L-10.6 0 M10.6 -1.8 L10.6 0', SP * 1.4);
    const pieces = [0, 1, 2].map((i) => {
        const g = el('g', { opacity: 0 }, dish);
        const rice = el('g', {}, g);
        C_(rice, 'M-3.4 0 Q-3.7 -3.3 0 -3.5 Q3.7 -3.3 3.4 0Z', PAPER, SP * 0.55);
        P_(rice, 'M-1.6 -1.4 l0.5 0 M1 -2.2 l0.5 0 M0.4 -0.8 l0.5 0', SP * 0.4);
        const slice = el('g', {}, g);
        const tuna = false; // all three are salmon, cut from one block
        C_(slice, 'M-4 -2.4 Q0 -4.8 4.2 -2.8 Q4.6 -1.5 3.6 -1.1 Q0 -2.4 -3.7 -0.9 Q-4.6 -1.3 -4 -2.4Z', rgb(tuna ? COL.tuna : COL.salmon), SP * 0.55);
        if (!tuna)
            el('path', { d: 'M-2.4 -2.4 q1 -0.8 2 -1 M0.6 -2.8 q1 -0.5 2 -0.4', fill: 'none', stroke: '#fff3e6', 'stroke-width': 0.45, 'stroke-linecap': 'round' }, slice);
        return { g, rice, slice, eaten: 0, tuna };
    });
    const floatText = text(fx, 0, 0, '', 9, { weight: 600 });
    floatText.setAttribute('font-style', 'italic');
    floatText.setAttribute('font-family', '"Iowan Old Style", Georgia, serif');
    let floatT = 9, floatPos = [0, 0];
    const say = (s, at) => { floatText.textContent = s; floatT = 0; floatPos = at; };
    // ------------------------------------------------------------------ the recipe
    // step: 0 board ready · 1 rice shaped · 2 fish sliced · 3 nigiri · 4 on the geta ·
    //       5 carried · 6 on the table (eat them) — anim runs 0→1 while a step plays
    const STEPS = [
        { label: 'Pirinci al', dur: 1.6, chop: 0 },
        { label: 'Balığı dilimle', dur: 1.9, chop: 1 },
        { label: 'Nigiri yap', dur: 1.6, chop: 0 },
        { label: 'Tabağa koy', dur: 1.0, chop: 0 },
    ];
    let step = 0, anim = -1, eaten = 0, eatT = -1, made = 0, resetT = -1, futonOp = 0;
    const lock = { x: IX + SPOT.cook, y: 352, heading: -0.66 };
    const near = (pl, x, dx) => Math.abs(pl.x - (IX + x)) < dx && pl.y < 364;
    const where = (pl) => near(pl, SPOT.door, 24) ? 'door' : near(pl, SPOT.cook, 20) ? 'cook' : near(pl, SPOT.table, 30) ? 'table' : near(pl, SPOT.futon, 20) ? 'futon' : null;
    const api = {
        root, actors,
        bounds: { x0: IX + 14, x1: IX + IW - 14 },
        view: { x0: IX - 14, x1: IX + IW + 14 },
        spawn: { x: IX + 44, y: 356 },
        /** The figure stands still at the board while a step plays. */
        get lock() { return anim >= 0 ? lock : null; },
        /** the story allows sleep (at night, when the day is done) */
        canSleep: false,
        get step() { return step; },
        get eaten() { return eaten; },
        /** the close-up sets how far the recipe got */
        setStep(n) { if (step < 5) {
            step = n;
            anim = -1;
        } },
        /** Arm pose targets for the figure. */
        pose: { work: 0, chop: 0, hold: 0 },
        /** The label of what can be done here, or null. */
        prompt(pl) {
            if (anim >= 0 || eatT >= 0 || resetT >= 0)
                return null;
            const w = where(pl);
            if (w === 'door')
                return step === 5 ? null : 'Dışarı çık';
            if (w === 'cook' && step < 4)
                return step === 0 ? 'Suşi hazırla' : 'Suşiye devam et';
            if (w === 'cook' && step === 4)
                return 'Tabağı al';
            if (w === 'table' && step === 5)
                return 'Masaya koy';
            if (w === 'table' && step === 6)
                return `Ye · ${3 - eaten} kaldı`;
            if (w === 'futon' && api.canSleep && step !== 5)
                return 'Uyu';
            return null;
        },
        /** Do it. Returns 'exit' when the figure should go back out to the street. */
        act(pl) {
            const label = api.prompt(pl);
            if (!label)
                return null;
            const w = where(pl);
            if (w === 'door')
                return 'exit';
            if (w === 'cook' && step < 4)
                return 'cook';
            if (w === 'futon')
                return 'sleep';
            if (w === 'cook' && step === 4) {
                step = 5;
                top.appendChild(dish);
                return null;
            }
            if (w === 'table' && step === 5) {
                step = 6;
                props.appendChild(dish);
                say('itadakimasu', [TABLE_TOP[0], TABLE_TOP[1] - 34]);
                return null;
            }
            if (w === 'table' && step === 6) {
                eatT = 0;
                return null;
            }
            return null;
        },
        get carrying() { return step === 5; },
        get made() { return made; },
        draw(t, dt, P, pl) {
            // colours of the hour
            const lit = smooth(0.08, 0.3, P.lamp);
            const outside = rgb(mix(P.bot, P.top, 0.35));
            windowPane.setAttribute('fill', rgb(mix(mix(P.bot, P.top, 0.35), COL.warm, lit * 0.25)));
            doorPane.setAttribute('fill', outside);
            lampShade.setAttribute('fill', rgb(mix(P.paper, COL.warm, lit * 0.95)));
            bulb.setAttribute('fill', rgb(mix(P.paper, hex('#fff1c9'), lit)));
            glows.forEach((g, i) => g.setAttribute('opacity', f(lit * (i ? 0.75 : 0.95) * (0.94 + 0.06 * Math.sin(t * 5.3 + i)))));
            tatami.setAttribute('fill', tint(COL.tatami, P, 0.5));
            futonOp += ((api.canSleep ? 1 : 0) - futonOp) * Math.min(1, dt * 3);
            futon.setAttribute('opacity', f(futonOp));
            quilt.setAttribute('fill', tint(COL.indigo, P));
            heri.setAttribute('stroke', tint(COL.heri, P));
            zab.forEach((z) => z.setAttribute('fill', tint(COL.red, P)));
            tableTop.setAttribute('fill', tint(COL.wood, P));
            getaTop.setAttribute('fill', tint(COL.wood, P));
            block.setAttribute('fill', tint(COL.salmon, P, 0.35));
            grd.setAttribute('fill', rgb(P.paper));
            steam.setAttribute('d', [0, 1].map((k) => { const x = 320 + k * 6, y0 = 306; const s = Math.sin(t * 1.6 + k * 2); return `M${x} ${y0} q${f(2 + s)} -4 0 -8 q${f(-2 - s)} -4 0 -8`; }).join(' '));
            steam.setAttribute('opacity', f(0.35 + 0.15 * Math.sin(t * 0.9)));
            // play the current step
            const cur = anim >= 0 ? STEPS[step] : null;
            if (cur) {
                anim += dt / cur.dur;
                if (anim >= 1) {
                    anim = -1;
                    step++;
                    if (step === 4)
                        say('hazır!', [DISH_HOME[0], DISH_HOME[1] - 30]);
                }
            }
            const p = anim >= 0 ? anim : 1;
            // 1 · rice: three balls fly from the tub to the board
            const riceP = step >= 1 ? 1 : step === 0 && anim >= 0 ? p : 0;
            // 2 · slicing: the block shrinks, the knife chops
            const cutP = step >= 2 ? 1 : step === 1 && anim >= 0 ? p : 0;
            // 3 · nigiri: slices go onto the rice
            const nigP = step >= 3 ? 1 : step === 2 && anim >= 0 ? p : 0;
            // 4 · onto the geta
            const plateP = step >= 4 ? 1 : step === 3 && anim >= 0 ? p : 0;
            const cuts = Math.min(3, Math.floor(cutP * 3 + 0.15));
            const bw = BLOCK.w0 - cuts * BLOCK.cut;
            const bx0 = BLOCK.x1 - bw;
            block.setAttribute('d', rect(+f(bx0), BLOCK.y0, BLOCK.x1, BLOCK.y1));
            blockLines.setAttribute('d', `M${f(bx0 + 0.6)} 311 q${f(bw / 2)} -1 ${f(bw - 1.2)} 0 M${f(bx0 + 0.6)} 313.2 q${f(bw / 2)} -1 ${f(bw - 1.2)} 0`);
            if (step === 1 && anim >= 0) {
                const lift = 5 * Math.abs(Math.sin(cutP * 3 * Math.PI));
                knife.setAttribute('transform', `translate(${f(bx0 - 0.2)} ${f(300 - lift)}) rotate(90)`);
            }
            else
                knife.setAttribute('transform', 'translate(296 320.6)');
            // the dish and its pieces
            let dx = IX + DISH_HOME[0], dy = DISH_HOME[1];
            if (step === 5) {
                dx = pl.hands[0];
                dy = pl.hands[1] + 2.4;
            }
            else if (step === 6) {
                dx = IX + TABLE_TOP[0];
                dy = TABLE_TOP[1];
            }
            dish.setAttribute('transform', `translate(${f(dx - IX)} ${f(dy)})`);
            // carried away from you, the dish is behind the body
            if (step === 5) {
                const behind = Math.sin(pl.heading) < -0.3;
                const want = behind ? props : top;
                if (dish.parentNode !== want)
                    want.appendChild(dish);
            }
            geta.setAttribute('opacity', f(easeOut(plateP)));
            const onPlate = -3.4 * ease(plateP);
            pieces.forEach((pc, i) => {
                // rice
                const rp = clamp(riceP * 3.2 - i, 0, 1), re = ease(rp);
                const rx = lerp(TUB[0], SLOT_X[i], re), ry = lerp(TUB[1], 0, re) - 9 * Math.sin(Math.PI * re) + onPlate;
                pc.rice.setAttribute('transform', `translate(${f(rx)} ${f(ry)}) scale(${f(lerp(0.5, 1, re))})`);
                // slice: appears at the pile when cut, then flies onto its rice
                const cut = cuts > i ? 1 : 0;
                const sp = clamp(nigP * 3.2 - i, 0, 1), se = ease(sp);
                const sx = lerp(PILE[0] + i * 0.6, SLOT_X[i], se), sy = lerp(PILE[1] - i * 0.7, -2.6, se) - 7 * Math.sin(Math.PI * se) + onPlate;
                pc.slice.setAttribute('transform', `translate(${f(sx)} ${f(sy)})`);
                pc.slice.setAttribute('opacity', f(cut));
                // eaten
                const gone = step === 6 ? clamp(pc.eaten, 0, 1) : 0;
                pc.g.setAttribute('opacity', f(riceP > 0 || cut ? 1 - gone : 0));
                pc.rice.parentElement.setAttribute('transform', gone > 0 ? `translate(${f(SLOT_X[i])} ${f(onPlate)}) scale(${f(1 - gone * 0.7)}) translate(${f(-SLOT_X[i])} ${f(-onPlate)})` : '');
            });
            // eating, one piece per tap
            if (eatT >= 0) {
                eatT += dt;
                const pc = pieces[eaten];
                pc.eaten = clamp(eatT / 0.45, 0, 1);
                if (eatT > 0.5) {
                    eatT = -1;
                    eaten++;
                    say(eaten < 3 ? 'mm…' : 'afiyet olsun!', [pl.x - IX, pl.y - 52]);
                    if (eaten >= 3) {
                        resetT = 0;
                        made++;
                    }
                }
            }
            if (resetT >= 0) {
                resetT += dt;
                geta.setAttribute('opacity', f(1 - clamp(resetT / 0.6, 0, 1)));
                if (resetT > 1.2) {
                    resetT = -1;
                    step = 0;
                    eaten = 0;
                    pieces.forEach((pc) => { pc.eaten = 0; });
                    props.appendChild(dish);
                }
            }
            // the figure's arms
            api.pose.work = anim >= 0 ? 1 : 0;
            api.pose.chop = step === 1 && anim >= 0 ? 1 : 0;
            api.pose.hold = step === 5 ? 1 : 0;
            // words that drift up and fade
            if (floatT < 2.2) {
                floatT += dt;
                floatText.setAttribute('x', f(floatPos[0]));
                floatText.setAttribute('y', f(floatPos[1] - floatT * 8));
                floatText.setAttribute('opacity', f(smooth(0, 0.2, floatT) * (1 - smooth(1.4, 2.2, floatT))));
            }
            else
                floatText.setAttribute('opacity', '0');
        },
    };
    return api;
}
