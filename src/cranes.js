// Paper cranes (orizuru) hovering over the street. Walk into one and it wakes,
// flaps and flies off over the roofs.
import { el, f } from "./lib/ink.js";
import { rnd, clamp, rgb, hex, mix, smooth } from "./village/kit.js";
import { Y_MIN, Y_MAX } from "./player.js";
const RED = '#c8423a';
const tint = (c, P, k = 0.45) => rgb(mix(hex(c), mix(hex(c), [12, 16, 30], 0.6), P.inkT * k));
export function createCranes(parent, shadows, glow) {
    const list = [];
    const make = (x, y) => {
        const shadow = el('ellipse', { rx: 6, ry: 1.3, fill: 'currentColor', opacity: 0.16 }, shadows);
        const halo = el('circle', { r: 16, fill: 'url(#v-warmglow)', opacity: 0 }, glow);
        const g = el('g', {}, parent);
        const s = { stroke: 'currentColor', 'stroke-width': 0.7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
        const farWing = el('path', { d: 'M-2 -1.6 L3 -1.8 L-2.4 -12.4Z', fill: RED, ...s }, g);
        const body = el('path', { d: 'M-7.4 -0.6 L0 -3 L8 -1.6 L0.6 2.6Z', fill: RED, ...s }, g);
        const tail = el('path', { d: 'M-6 -0.4 L-11.4 -8.4 L-3.6 -1.8Z', fill: RED, ...s }, g);
        const neck = el('path', { d: 'M5.6 -1.8 L10 -9 L12.6 -8.2 L10.4 -7.6 L7.6 -0.8Z', fill: RED, ...s }, g);
        const nearWing = el('path', { d: 'M-1.4 -1.2 L3.6 -1.4 L1.2 -12.6Z', fill: RED, ...s }, g);
        const crease = el('path', { d: 'M-3.4 -1.6 L4.4 -0.4', fill: 'none', ...s, 'stroke-width': 0.45 }, g);
        const c = { g, shadow, halo, parts: [farWing, body, tail, neck, nearWing], farWing, nearWing, crease, x, y, ph: rnd(0, 6), dir: Math.random() < 0.5 ? 1 : -1, state: 'hover', t: 0, appear: 0 };
        list.push(c);
        return c;
    };
    return {
        list,
        spawn(avoidX, at) {
            if (at !== undefined) {
                make(clamp(at, 30, 930), rnd(Y_MIN + 6, Y_MAX - 6));
                return;
            }
            let x = 0;
            for (let i = 0; i < 20; i++) {
                x = rnd(30, 930);
                if (Math.abs(x - avoidX) > 160 && list.every((c) => c.state !== 'hover' || Math.abs(c.x - x) > 90))
                    break;
            }
            make(x, rnd(Y_MIN + 2, Y_MAX - 2));
        },
        /** returns how many were collected this frame */
        draw(t, dt, P, px, py, pdir) {
            let got = 0;
            for (let i = list.length - 1; i >= 0; i--) {
                const c = list[i];
                c.t += dt;
                let hx = c.x, hy = c.y - 17 - Math.sin(t * 2 + c.ph) * 1.6, flap = 0.85 + Math.sin(t * 3 + c.ph) * 0.12, op = 1, scale = 1;
                if (c.state === 'hover') {
                    c.appear = Math.min(1, c.appear + dt * 1.5);
                    scale = smooth(0, 1, c.appear);
                    if (Math.abs(px - c.x) < 10 && Math.abs(py - c.y) < 7) {
                        c.state = 'fly';
                        c.t = 0;
                        c.dir = pdir;
                        got++;
                    }
                }
                else {
                    const u = c.t;
                    hx = c.x + c.dir * (18 * u + 22 * u * u);
                    hy = c.y - 15 - (26 * u + 38 * u * u);
                    flap = Math.sin(t * 26) * 0.9;
                    op = 1 - smooth(1.0, 1.8, u);
                    scale = 1 + u * 0.25;
                    if (u > 1.8) {
                        c.g.remove();
                        c.shadow.remove();
                        c.halo.remove();
                        list.splice(i, 1);
                        continue;
                    }
                }
                c.g.setAttribute('transform', `translate(${f(hx)} ${f(hy)}) scale(${f(c.dir * scale * 1.3)} ${f(scale * 1.3)})`);
                c.g.setAttribute('opacity', f(op));
                c.nearWing.setAttribute('transform', `translate(1 -1.4) scale(1 ${f(flap)}) translate(-1 1.4)`);
                c.farWing.setAttribute('transform', `translate(1 -1.6) scale(1 ${f(clamp(flap * 0.9, -1, 1))}) translate(-1 1.6)`);
                c.shadow.setAttribute('cx', f(c.x));
                c.shadow.setAttribute('cy', f(c.y));
                c.shadow.setAttribute('opacity', f(c.state === 'hover' ? 0.16 * scale : Math.max(0, 0.16 - c.t * 0.2)));
                c.halo.setAttribute('cx', f(hx));
                c.halo.setAttribute('cy', f(hy - 4));
                c.halo.setAttribute('opacity', f(P.lamp * 0.7 * op));
                const col = tint(RED, P);
                c.parts.forEach((n) => n.setAttribute('fill', col));
            }
            return got;
        },
    };
}
