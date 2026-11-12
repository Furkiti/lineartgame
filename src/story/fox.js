// A shy fox that comes out at night — but only to someone who stands still under the lamp.
// Walks in with pauses, sniffs, sits and curls its tail; startles and runs if you move.
import { el, f, pt, PEN, PAPER } from "../lib/ink.js";
import { FS, rgb, hex, mix } from "../village/kit.js";
import { clamp01, lerp, easeInOut, approach } from "./fx.js";
const tint = (c, P, k = 0.35) => rgb(mix(hex(c), mix(hex(c), [12, 16, 30], 0.6), P.inkT * k));
export function createFox(parent, glow) {
    const g = el('g', { opacity: 0 }, parent);
    const legsFar = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 1.6, 'stroke-linecap': 'round' }, g);
    const tail = el('path', { fill: '#d9884a', stroke: 'currentColor', 'stroke-width': PEN, 'stroke-linejoin': 'round' }, g);
    const tailTip = el('path', { fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.8, 'stroke-linejoin': 'round' }, g);
    const body = el('path', { fill: '#d9884a', stroke: 'currentColor', 'stroke-width': PEN, 'stroke-linejoin': 'round' }, g);
    const chest = el('path', { fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.7 }, g);
    const legsNear = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 1.6, 'stroke-linecap': 'round' }, g);
    const head = el('path', { fill: '#d9884a', stroke: 'currentColor', 'stroke-width': PEN, 'stroke-linejoin': 'round' }, g);
    const ears = el('path', { fill: '#d9884a', stroke: 'currentColor', 'stroke-width': PEN * 0.9, 'stroke-linejoin': 'round' }, g);
    const earIn = el('path', { fill: 'currentColor' }, g);
    const muzzle = el('path', { fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.7 }, g);
    const eye = el('ellipse', { rx: 1.2, ry: 1.4, fill: '#f6e7a6', stroke: 'currentColor', 'stroke-width': 0.5 }, g);
    const nose = el('circle', { r: 1.1, fill: 'currentColor' }, g);
    const eyeGlow = el('circle', { r: 7, fill: 'url(#v-warmglow)', opacity: 0 }, glow);
    let state = 'away', stT = 0, op = 0, phase = 0, go = 0, sit = 0, curl = 0, earT = 9, look = 0, hop = 0;
    let tx = 0, pauseT = 0;
    const self = {
        g, x: 0, y: 0, dir: -1,
        get state() { return state; },
        get visible() { return op > 0.05; },
        /** walk in from off to one side and sit near (toX, y) */
        come(fromX, toX, y) { state = 'come'; stT = 0; self.x = fromX; self.y = y; tx = toX; self.dir = toX > fromX ? 1 : -1; pauseT = 0; sit = 0; curl = 0; },
        startle() { if (state === 'come' || state === 'sit') {
            state = 'flee';
            stT = 0;
            hop = 1;
            self.dir = -self.dir;
        } },
        leave() { if (state === 'sit') {
            state = 'leave';
            stT = 0;
        } },
        draw(t, dt, P) {
            stT += dt;
            let speed = 0;
            if (state === 'come') {
                const d = tx - self.x;
                // trots in, stops twice to sniff and look
                pauseT -= dt;
                if (pauseT < 0 && Math.abs(d) > 4 && Math.random() < dt * 0.35)
                    pauseT = 1.1;
                if (Math.abs(d) < 2) {
                    state = 'sit';
                    stT = 0;
                }
                speed = pauseT > 0 ? 0 : Math.sign(d) * Math.min(18, Math.abs(d) * 2 + 6);
                op = approach(op, 1, 2, dt);
            }
            else if (state === 'flee') {
                speed = self.dir * 90;
                op = approach(op, 0, 1.6, dt);
                if (stT > 1.6)
                    state = 'away';
            }
            else if (state === 'leave') {
                speed = self.dir * 22;
                if (stT < 0.6)
                    speed = 0;
                if (stT > 0.6 && self.dir * (tx - self.x) >= 0)
                    self.dir = -self.dir;
                op = approach(op, stT > 3 ? 0 : 1, 1.4, dt);
                if (stT > 5)
                    state = 'away';
            }
            else if (state === 'away')
                op = approach(op, 0, 3, dt);
            self.x += speed * dt;
            go = approach(go, Math.abs(speed) > 1 ? 1 : 0, 8, dt);
            phase += dt * (Math.abs(speed) > 30 ? 4.2 : 2.6) * go;
            sit = approach(sit, state === 'sit' ? 1 : 0, 3, dt);
            curl = approach(curl, state === 'sit' && stT > 1.2 ? 1 : 0, 1.4, dt);
            hop = approach(hop, 0, 3, dt);
            look = approach(look, state === 'sit' || pauseT > 0 ? 1 : 0, 3, dt);
            earT -= dt;
            if (earT < -0.2)
                earT = 2 + Math.random() * 3;
            const twitch = earT < 0 ? Math.sin((earT + 0.2) * Math.PI * 10) * 6 : 0;
            g.setAttribute('opacity', f(op * clamp01(P.night * 1.4)));
            const jump = Math.sin(Math.PI * clamp01(1 - hop)) * hop * 10;
            g.setAttribute('transform', `translate(${f(self.x)} ${f(self.y - jump * FS)}) scale(${f(self.dir * FS * 0.95)} ${f(FS * 0.95)}) translate(-40 -120)`);
            // body: a long oval when walking, tips up when sitting
            const by = 104 + sit * -3, tilt = sit * -26;
            const R = (x, y) => { const a = tilt * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - 34, dy = y - by; return [34 + dx * c - dy * s, by + dx * s + dy * c]; };
            const bob = Math.sin(phase * Math.PI * 2) * 0.8 * go;
            const B = (x, y) => pt(R(x, y + bob));
            body.setAttribute('d', `M${B(20, by - 2)} Q${B(22, by - 9)} ${B(34, by - 9)} Q${B(48, by - 10)} ${B(52, by - 4)} Q${B(54, by + 4)} ${B(46, by + 5)} L${B(26, by + 5)} Q${B(18, by + 4)} ${B(20, by - 2)}Z`);
            chest.setAttribute('d', `M${B(47, by + 4)} Q${B(53, by + 2)} ${B(52, by - 4)} Q${B(50, by + 2)} ${B(44, by + 5)}Z`);
            // legs
            const leg = (hx, ph, front) => {
                const s = Math.sin(phase * Math.PI * 2 + ph) * go;
                const hip = R(hx, by + 3 + bob);
                const sitFold = front ? 0 : sit;
                const foot = [lerp(hip[0] + s * 6, hip[0] + 6, sitFold), lerp(118 - Math.max(0, -s) * 3 * go, 118, sitFold)];
                const knee = [lerp((hip[0] + foot[0]) / 2 + (front ? 1.5 : -2), hip[0] - 4, sitFold), lerp((hip[1] + foot[1]) / 2, 114, sitFold)];
                return `M${pt(hip)} Q${pt(knee)} ${pt(foot)} l${front ? 2.4 : 2} 0`;
            };
            legsNear.setAttribute('d', leg(47, 0, true) + ' ' + leg(26, Math.PI, false));
            legsFar.setAttribute('d', leg(45, Math.PI, true) + ' ' + leg(24, 0, false));
            // the tail: sways when walking, wraps around the paws when sitting
            const tb = R(20, by - 3 + bob);
            const sway = Math.sin(t * 2.2) * 4 * (1 - curl);
            const tm = [lerp(tb[0] - 14, tb[0] + 6, curl), lerp(tb[1] - 4 + sway, 116, curl)];
            const te = [lerp(tb[0] - 24, tb[0] + 24, curl), lerp(tb[1] - 10 + sway * 1.6, 117, curl)];
            tail.setAttribute('d', `M${pt(tb)} Q${f(tm[0])} ${f(tm[1] - 7)} ${pt(te)} Q${f(tm[0] + 2)} ${f(tm[1] + 5)} ${f(tb[0] + 1)} ${f(tb[1] + 5)}Z`);
            tailTip.setAttribute('d', `M${f(lerp(te[0], te[0], 0.5) + (curl > 0.5 ? -5 : 5))} ${f(te[1] - 2)} Q${pt(te)} ${pt(te)} Q${f(te[0] + (curl > 0.5 ? -4 : 4))} ${f(te[1] + 3)} ${f(te[0] + (curl > 0.5 ? -6 : 6))} ${f(te[1] + 1)}Z`);
            // head: looks at you (toward the viewer) when paused or sitting
            const hc = R(56, by - 9 + bob);
            const hx = hc[0] + sit * -1, hy = hc[1] - 4 - sit * 4 + Math.sin(t * 1.3) * 0.4 * look;
            const turn = look * 0.45;
            head.setAttribute('d', `M${f(hx - 6)} ${f(hy)} Q${f(hx - 6)} ${f(hy - 6)} ${f(hx)} ${f(hy - 6)} Q${f(hx + 6)} ${f(hy - 5)} ${f(hx + 7 - turn * 4)} ${f(hy - 1)} L${f(hx + 13 - turn * 7)} ${f(hy + 2)} Q${f(hx + 11 - turn * 6)} ${f(hy + 5)} ${f(hx + 4)} ${f(hy + 5)} Q${f(hx - 5)} ${f(hy + 6)} ${f(hx - 6)} ${f(hy)}Z`);
            muzzle.setAttribute('d', `M${f(hx + 3)} ${f(hy + 2)} L${f(hx + 12 - turn * 7)} ${f(hy + 2.4)} Q${f(hx + 9 - turn * 6)} ${f(hy + 5)} ${f(hx + 3)} ${f(hy + 4.6)}Z`);
            nose.setAttribute('cx', f(hx + 13 - turn * 7));
            nose.setAttribute('cy', f(hy + 2));
            eye.setAttribute('cx', f(hx + 3 - turn * 2));
            eye.setAttribute('cy', f(hy - 1.4));
            const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
            eye.setAttribute('ry', f(1.4 * blink));
            const e1 = -6 + twitch * 0.3, e2 = twitch;
            ears.setAttribute('d', `M${f(hx - 4)} ${f(hy - 5)} L${f(hx - 5 + e1 * 0.2)} ${f(hy - 14)} L${f(hx + 1)} ${f(hy - 6)}Z M${f(hx + 1)} ${f(hy - 6)} L${f(hx + 3 + e2 * 0.2)} ${f(hy - 14.5)} L${f(hx + 6)} ${f(hy - 4.6)}Z`);
            earIn.setAttribute('d', `M${f(hx - 3.6)} ${f(hy - 6)} L${f(hx - 4.4)} ${f(hy - 11)} L${f(hx - 1)} ${f(hy - 6.4)}Z`);
            [body, tail, head, ears].forEach((n) => n.setAttribute('fill', tint('#d9884a', P)));
            // eyeshine in the dark
            const ex = self.x + self.dir * FS * 0.95 * (hx + 3 - 40), ey = self.y + FS * 0.95 * (hy - 1.4 - 120) - jump * FS;
            eyeGlow.setAttribute('cx', f(ex));
            eyeGlow.setAttribute('cy', f(ey));
            eyeGlow.setAttribute('opacity', f(op * P.night * 0.5));
            void easeInOut;
        },
    };
    return self;
}
