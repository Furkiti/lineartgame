// The traveller you steer: straw kasa hat, indigo jacket, a red furoshiki bundle on
// the back. Legs are solved by gait() — a walk and an adult run blended by how far
// the joystick is pushed — so the planted foot stays put at any speed. Arms, the
// bundle and the hat lag on springs.
import { el, pen, shape, blot, paint, limb, solid, shoe, f, pt, PEN, PAPER } from './lib/ink.js';
import { gait } from './lib/gait.js';
import { spring, clamp, lerp, smooth } from './lib/motion.js';
import { FS, rgb, hex, mix } from './village/kit.js';
const RAD = Math.PI / 180;
const tint = (c, P, k = 0.55) => rgb(mix(hex(c), mix(hex(c), [12, 16, 30], 0.6), P.inkT * k));
const C = { jacket: '#34507a', trousers: '#3a3a40', bundle: '#b3412d', hat: '#e3c78a', obi: '#d3a24c' };
export const Y_MIN = 351, Y_MAX = 380;
export function createPlayer(parent, x, y) {
    const g = el('g', {}, parent);
    const farArm = limb(g, 3.6);
    const legs = [solid(limb(g, 4.4), C.trousers), solid(limb(g, 4.4), C.trousers)];
    const shoes = [blot(g), blot(g)];
    const bundle = paint(g, C.bundle);
    const bundleDots = el('path', { fill: 'none', stroke: '#f2e6d0', 'stroke-width': 0.9, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 3.2' }, g);
    const knot = paint(g, C.bundle, PEN * 0.8);
    const jacket = paint(g, C.jacket);
    const obi = paint(g, C.obi, PEN * 0.7);
    const strap = pen(g, PEN * 0.8);
    const seam = pen(g, PEN * 0.55);
    const head = el('ellipse', { rx: 3.7, ry: 4.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, g);
    const hair = blot(g);
    const string = pen(g, PEN * 0.45);
    const hat = paint(g, C.hat, PEN * 0.85);
    const weave = pen(g, PEN * 0.4);
    const nearArm = limb(g, 3.6);
    const hand = el('circle', { r: 1.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.7 }, g);
    const walk = gait({ kind: 'walk' });
    const run = gait({ kind: 'run', thigh: 23, shin: 23, stride: 30, lift: 13, period: 0.62, heelKick: 5, ankleY: 118.4, toe: 4.2, heelOff: 12 });
    const arms = [spring(70, 10), spring(70, 10)];
    const bend = spring(40, 9);
    const sway = spring(26, 3.2), hatS = spring(30, 4.5);
    let phase = 0, go = 0, r = 0, lastBob = 0;
    const self = {
        g, x, y, dir: 1, speed: 0, running: 0, moving: 0,
        /** jx, jy ∈ [-1, 1] from the joystick. */
        update(t, dt, jx, jy, P, wind) {
            const m = Math.min(1, Math.hypot(jx, jy));
            const want = m > 0.12 ? 1 : 0;
            go += (want - go) * Math.min(1, dt * (want ? 7 : 5));
            if (go < 0.002)
                go = 0;
            const runT = want ? smooth(0.6, 0.92, m) : r;
            r += (runT - r) * Math.min(1, dt * 4);
            const rate = lerp(0.8, 1.15, smooth(0.12, 0.6, m));
            const period = lerp(walk.period / rate, run.period, r);
            phase += (dt / period) * go;
            const speed = lerp(walk.speed * rate, run.speed, r) * FS * go;
            if (m > 0.12) {
                if (Math.abs(jx) > 0.15)
                    self.dir = jx > 0 ? 1 : -1;
                self.x += (jx / m) * speed * dt;
                self.y += (jy / m) * speed * 0.6 * dt;
            }
            self.x = clamp(self.x, 14, 946);
            self.y = clamp(self.y, Y_MIN, Y_MAX);
            self.speed = speed;
            self.running = r * go;
            self.moving = go;
            g.setAttribute('transform', `translate(${f(self.x)} ${f(self.y)}) scale(${f(self.dir * FS)} ${f(FS)}) translate(-40 -120)`);
            // legs: the same phase drives both gaits, so blending them keeps the feet in step
            const pw = walk.pose(phase, go), pr = run.pose(phase, go);
            const L = (a, b) => [lerp(a[0], b[0], r), lerp(a[1], b[1], r)];
            const hip = L(pw.hip, pr.hip);
            const breathe = go < 0.5 ? Math.sin(t * 2.1) * 0.35 * (1 - go * 2) : 0;
            const bob = hip[1] - pw.hip[1] + pw.bob + breathe;
            const feet = [0, 1].map((i) => {
                const a = L(pw.feet[i].ankle, pr.feet[i].ankle), k = L(pw.feet[i].knee, pr.feet[i].knee);
                return { a, k, pitch: lerp(pw.feet[i].pitch, pr.feet[i].pitch, r) };
            });
            feet.forEach((fo, i) => { legs[i].draw([hip, fo.k, fo.a], [0.3, 0.8]); shoe(shoes[i], fo.a, fo.pitch); });
            const front = feet[0].a[0] >= feet[1].a[0] ? 0 : 1;
            g.insertBefore(legs[1 - front].g, legs[front].g);
            g.insertBefore(shoes[front], bundle);
            g.insertBefore(shoes[1 - front], shoes[front]);
            // torso leans into the run
            const lean = r * go * 5;
            const sh = [41 + lean, 42 + bob + r * 1.2];
            const kF = feet[front].k;
            const hy = hip[1];
            const fx = Math.max(kF[0] * 0.45 + 40 * 0.55 + 4.4, 46 + lean * 0.3);
            jacket.setAttribute('d', `M${f(sh[0] - 6.4)} ${f(sh[1] + 1.4)} Q${f(sh[0] - 1)} ${f(sh[1] - 2.6)} ${f(sh[0] + 5.2)} ${f(sh[1] + 1)} Q${f(sh[0] + 6)} ${f((sh[1] + hy) / 2)} ${f(fx)} ${f(hy + 6)} L${f(fx + 0.6)} ${f(hy + 12)} Q${f((fx + 33) / 2)} ${f(hy + 13.6)} 32.6 ${f(hy + 12.4)} L33.4 ${f(hy + 2)} Q${f(33 + lean * 0.2)} ${f((sh[1] + hy) / 2)} ${f(sh[0] - 6.4)} ${f(sh[1] + 1.4)}Z`);
            const ob0 = lerp(sh[0] - 6.4, 33.4, 0.82), ob1 = lerp(sh[0] + 5.2, fx, 0.8);
            obi.setAttribute('d', `M${f(ob0 - 0.4)} ${f(hy - 5.4)} L${f(ob1 + 0.2)} ${f(hy - 5.6)} L${f(ob1 + 0.5)} ${f(hy - 1.6)} L${f(ob0 - 0.6)} ${f(hy - 1.4)}Z`);
            seam.setAttribute('d', `M${f(sh[0] + 2.6)} ${f(sh[1] + 0.6)} Q${f(sh[0] + 1.4)} ${f(sh[1] + 9)} ${f(lerp(sh[0] + 2, ob1, 0.5))} ${f(hy - 5.6)}`);
            // bundle on the back: swings with the bounce and the stride
            const bobV = (bob - lastBob) / Math.max(dt, 1e-3);
            lastBob = bob;
            const sw = sway.step(-self.speed * 0.05 - wind * 0.6 + bobV * 0.02, dt);
            const bc = [sh[0] - 9.6 + sw * 0.5, sh[1] + 10 + Math.abs(sw) * 0.15];
            bundle.setAttribute('d', `M${f(bc[0] + 3)} ${f(bc[1] - 8)} Q${f(bc[0] - 7.6)} ${f(bc[1] - 7.4)} ${f(bc[0] - 7.4)} ${f(bc[1] + 1)} Q${f(bc[0] - 6.6)} ${f(bc[1] + 8.4)} ${f(bc[0] + 1)} ${f(bc[1] + 8)} Q${f(bc[0] + 7)} ${f(bc[1] + 7.6)} ${f(bc[0] + 6.4)} ${f(bc[1] - 1)} Q${f(bc[0] + 6.4)} ${f(bc[1] - 7.6)} ${f(bc[0] + 3)} ${f(bc[1] - 8)}Z`);
            bundleDots.setAttribute('d', `M${f(bc[0] - 4)} ${f(bc[1] - 3)} L${f(bc[0] + 4)} ${f(bc[1] - 3.6)} M${f(bc[0] - 5)} ${f(bc[1] + 1.4)} L${f(bc[0] + 4.6)} ${f(bc[1] + 0.8)} M${f(bc[0] - 4)} ${f(bc[1] + 5.2)} L${f(bc[0] + 3.4)} ${f(bc[1] + 4.8)}`);
            const kn = [bc[0] + 3.4, bc[1] - 8.4];
            knot.setAttribute('d', `M${pt(kn)} q${f(-3.6 + sw * 0.4)} -2.6 ${f(-4.4 + sw * 0.6)} 0.6 q1.6 1.4 4.4 -0.6 q2.4 -3.4 ${f(4.2 + sw * 0.3)} -1 q-1.4 2.2 -4.2 1Z`);
            strap.setAttribute('d', `M${f(kn[0] + 1)} ${f(kn[1] + 0.4)} Q${f(sh[0] + 2)} ${f(sh[1] + 2)} ${f(sh[0] + 4.2)} ${f(sh[1] + 9.6)}`);
            // head and the kasa, which nods a little behind the bounce
            const hc = [sh[0] + 1.8 + lean * 0.3, sh[1] - 9.6];
            head.setAttribute('cx', f(hc[0]));
            head.setAttribute('cy', f(hc[1]));
            hair.setAttribute('d', `M${f(hc[0] - 3.6)} ${f(hc[1] - 1.4)} Q${f(hc[0] - 4.4)} ${f(hc[1] + 3.6)} ${f(hc[0] - 1.6)} ${f(hc[1] + 3.4)} Q${f(hc[0] - 2.6)} ${f(hc[1])} ${f(hc[0] - 1)} ${f(hc[1] - 2.6)}Z`);
            const tilt = hatS.step(-lean * 1.4 - bobV * 0.04 + wind * 1.5, dt);
            const hr = (deg, p) => { const a = (deg * RAD), c = Math.cos(a), s = Math.sin(a); const dx = p[0] - hc[0], dy = p[1] - hc[1]; return [hc[0] + dx * c - dy * s, hc[1] + dx * s + dy * c]; };
            const H = (dx, dy) => pt(hr(tilt, [hc[0] + dx, hc[1] + dy]));
            hat.setAttribute('d', `M${H(-13.4, -1.6)} Q${H(-6, -6.4)} ${H(0.4, -11.4)} Q${H(6.6, -6.6)} ${H(13.8, -2.2)} Q${H(0.2, 0.4)} ${H(-13.4, -1.6)}Z`);
            weave.setAttribute('d', `M${H(0.4, -11)} L${H(-6.6, -0.9)} M${H(0.4, -11)} L${H(0.2, -0.6)} M${H(0.4, -11)} L${H(7, -0.9)} M${H(-8.6, -3.4)} Q${H(0, -5)} ${H(9.2, -3.6)}`);
            string.setAttribute('d', `M${H(-2.6, -1)} Q${f(hc[0] + 0.6)} ${f(hc[1] + 6.4)} ${H(3.4, -1.2)}`);
            // arms: opposite the legs, bent at the elbow when running
            const legSwing = clamp((feet[0].a[0] - 40) / 14, -1.2, 1.2);
            const amp = lerp(15, 38, r) * go;
            const aF = arms[0].step(-legSwing * amp, dt) * RAD, aN = arms[1].step(legSwing * amp, dt) * RAD;
            const elb = bend.step(lerp(0.15, 1.5, r * go), dt);
            const shF = [sh[0] - 1, sh[1] + 2.4], shN = [sh[0] + 1.4, sh[1] + 2.6];
            const eF = [shF[0] + 15 * Math.sin(aF), shF[1] + 15 * Math.cos(aF)];
            farArm.draw([shF, eF, [eF[0] + 14 * Math.sin(aF + elb), eF[1] + 14 * Math.cos(aF + elb)]], [0.2, 0.5]);
            const eN = [shN[0] + 15 * Math.sin(aN), shN[1] + 15 * Math.cos(aN)];
            const hN = [eN[0] + 14 * Math.sin(aN + elb), eN[1] + 14 * Math.cos(aN + elb)];
            nearArm.draw([shN, eN, hN], [0.2, 0.4]);
            hand.setAttribute('cx', f(hN[0]));
            hand.setAttribute('cy', f(hN[1]));
            // colours sink into the night palette
            legs.forEach((l) => l.g.querySelector('path').setAttribute('fill', tint(C.trousers, P, 0.4)));
            jacket.setAttribute('fill', tint(C.jacket, P));
            obi.setAttribute('fill', tint(C.obi, P));
            bundle.setAttribute('fill', tint(C.bundle, P));
            knot.setAttribute('fill', tint(C.bundle, P));
            hat.setAttribute('fill', tint(C.hat, P));
        },
    };
    return self;
}
