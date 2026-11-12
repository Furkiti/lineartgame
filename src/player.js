// The traveller you steer: straw kasa hat, indigo jacket, a red furoshiki bundle on
// the back. Legs are solved by gait() — a walk and an adult run blended by how far
// the joystick is pushed — so the planted foot stays put at any speed. Arms, the
// bundle and the hat lag on springs.
//
// The figure turns all the way round. Every part is posed in a small 3-D body frame
// (u forward, w to the figure's left, v down) and projected for the current heading,
// so it can face right, toward you, left or away — and everything in between. The
// gait still solves the legs in the side plane; the projection does the turning.
import { el, paint, limb, solid, blot, f, pt, PEN, PAPER } from "./lib/ink.js";
import { gait } from "./lib/gait.js";
import { spring, clamp, lerp, smooth } from "./lib/motion.js";
import { FS, rgb, hex, mix } from "./village/kit.js";
const RAD = Math.PI / 180;
const tint = (c, P, k = 0.55) => rgb(mix(hex(c), mix(hex(c), [12, 16, 30], 0.6), P.inkT * k));
const C = { jacket: '#34507a', trousers: '#3a3a40', bundle: '#b3412d', hat: '#e3c78a', obi: '#d3a24c' };
export const Y_MIN = 351, Y_MAX = 380;
const PITCH = 0.2; // we look down on the street a little: nearer points sit a touch lower
const HIP_W = 3.1; // half the distance between the hips
const SHOULDER_W = 5.4; // half the distance between the shoulder joints
const TURN = 13; // how fast the body swings round to a new heading
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** Convex hull (monotone chain) of a few points — for shoes seen from any angle. */
function hull(p) {
    p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) {
        while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0)
            lo.pop();
        lo.push(q);
    }
    for (let i = p.length - 1; i >= 0; i--) {
        const q = p[i];
        while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0)
            up.pop();
        up.push(q);
    }
    return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** Soft open path through points: straight to the first midpoint, then quadratic through the rest. */
function soft(points, move = true) {
    let d = (move ? 'M' : 'L') + pt(points[0]);
    for (let i = 1; i < points.length - 1; i++) {
        const m = [(points[i][0] + points[i + 1][0]) / 2, (points[i][1] + points[i + 1][1]) / 2];
        d += ` Q${pt(points[i])} ${pt(m)}`;
    }
    return d + ` L${pt(points[points.length - 1])}`;
}
const ellipseD = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
export function createPlayer(parent, x, y) {
    const g = el('g', {}, parent);
    const part = () => el('g', {}, g);
    // legs (each with its shoe), drawn under the jacket
    const legG = [part(), part()];
    const legs = legG.map((lg) => solid(limb(lg, 4.4), C.trousers));
    const shoes = legG.map((lg) => { const s = blot(lg); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '0.7'); s.setAttribute('stroke-linejoin', 'round'); return s; });
    // jacket, belt, collar seam and the bundle's straps
    const torsoG = part();
    const jacket = paint(torsoG, C.jacket);
    const obi = paint(torsoG, C.obi, PEN * 0.7);
    const seam = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 0.55, 'stroke-linecap': 'round' }, torsoG);
    const strapPen = () => el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 0.8, 'stroke-linecap': 'round' }, torsoG);
    const straps = [[strapPen(), strapPen()], [strapPen(), strapPen()]]; // [side][back half, front half]
    // the furoshiki on the back
    const bundleG = part();
    const bundle = paint(bundleG, C.bundle);
    const bundleDots = el('path', { fill: 'none', stroke: '#f2e6d0', 'stroke-width': 0.9, 'stroke-linecap': 'round', 'stroke-dasharray': '0.1 3.2' }, bundleG);
    const knot = paint(bundleG, C.bundle, PEN * 0.8);
    // arms: [left, right]
    const armG = [part(), part()];
    const arms = armG.map((ag) => limb(ag, 3.6));
    const hands = armG.map((ag) => el('circle', { r: 1.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN * 0.7 }, ag));
    // head, hair (the head minus the face, so the back of the head is all hair) and the kasa
    const headG = part();
    const clipId = `traveller-head-${Math.random().toString(36).slice(2, 8)}`;
    const clip = el('clipPath', { id: clipId }, headG);
    const clipHead = el('ellipse', { rx: 3.7, ry: 4.6 }, clip);
    const head = el('ellipse', { rx: 3.7, ry: 4.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, headG);
    const hair = el('path', { fill: 'currentColor', 'fill-rule': 'evenodd', 'clip-path': `url(#${clipId})` }, headG);
    const string = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 0.45, 'stroke-linecap': 'round' }, headG);
    const hat = paint(headG, C.hat, PEN * 0.85);
    const weave = el('path', { fill: 'none', stroke: 'currentColor', 'stroke-width': PEN * 0.4, 'stroke-linecap': 'round' }, headG);
    // an unhurried walk, and at most a light jog — nobody is late for anything here
    const walk = gait({ kind: 'walk', period: 0.94, stride: 27 });
    const run = gait({ kind: 'run', thigh: 23, shin: 23, stride: 28, lift: 11, period: 0.68, heelKick: 4.5, ankleY: 118.4, toe: 4.2, heelOff: 12 });
    const JOG = 0.72;
    const armS = [spring(70, 10), spring(70, 10)];
    const bend = spring(40, 9);
    const sway = spring(26, 3.2), hatS = spring(30, 4.5);
    let phase = 0, go = 0, r = 0, lastBob = 0, heading = 0, lastOrder = '';
    const poseS = { work: 0, chop: 0, hold: 0 };
    const self = {
        g, x, y, dir: 1, speed: 0, running: 0, moving: 0,
        /** Where the figure may walk, in scene units. */
        bounds: { x0: 14, x1: 946 },
        /** Arm poses to blend toward, each 0…1: working at a counter, chopping with the right hand, carrying a tray. */
        pose: { work: 0, chop: 0, hold: 0 },
        /** When set, the body turns to this heading instead of following the stick. */
        faceTo: null,
        /** Both hands, averaged, in scene units (for things carried). */
        hands: [x, y - 30],
        /** the red bundle on the back (hang it up at home) */
        carryBundle: true,
        setHeading(h) { heading = wrap(h); },
        /** Heading in radians: 0 faces right, π/2 faces you, π left, -π/2 away. */
        heading: 0,
        /** cos(heading): 1 facing right … -1 facing left, smooth through the turn. */
        face: 1,
        /** jx, jy ∈ [-1, 1] from the joystick. */
        update(t, dt, jx, jy, P, wind) {
            const m = Math.min(1, Math.hypot(jx, jy));
            const want = m > 0.12 ? 1 : 0;
            go += (want - go) * Math.min(1, dt * (want ? 7 : 5));
            if (go < 0.002)
                go = 0;
            const runT = want ? smooth(0.65, 0.95, m) * JOG : r;
            r += (runT - r) * Math.min(1, dt * 2.5);
            const rate = lerp(0.8, 1.0, smooth(0.12, 0.6, m));
            const period = lerp(walk.period / rate, run.period, r);
            phase += (dt / period) * go;
            const speed = lerp(walk.speed * rate, run.speed, r) * FS * go;
            const aim = self.faceTo ?? (m > 0.12 ? Math.atan2(jy, jx) : null);
            if (aim !== null) {
                // turn the shortest way round toward where the stick points
                heading += wrap(aim - heading) * (1 - Math.exp(-dt * TURN));
                heading = wrap(heading);
            }
            if (m > 0.12) {
                self.x += (jx / m) * speed * dt;
                self.y += (jy / m) * speed * 0.6 * dt;
            }
            self.x = clamp(self.x, self.bounds.x0, self.bounds.x1);
            self.y = clamp(self.y, Y_MIN, Y_MAX);
            self.speed = speed;
            self.running = r * go;
            self.moving = go;
            const c = Math.cos(heading), s = Math.sin(heading);
            self.heading = heading;
            self.face = c;
            if (Math.abs(c) > 0.2)
                self.dir = c > 0 ? 1 : -1;
            g.setAttribute('transform', `translate(${f(self.x)} ${f(self.y)}) scale(${f(FS)}) translate(-40 -120)`);
            // body frame → figure space. depth > 0 is toward you.
            const X = (u, w, v) => [40 + u * c + w * s, v + (u * s - w * c) * PITCH];
            const depth = (u, w) => u * s - w * c;
            const toward = s; // 1 facing you, -1 facing away
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
            const legDepth = [];
            feet.forEach((fo, i) => {
                const w = i === 0 ? HIP_W : -HIP_W; // leg 0 is the left leg
                const hu = hip[0] - 40, ku = fo.k[0] - 40, au = fo.a[0] - 40;
                legs[i].draw([X(hu, w, hip[1]), X(ku, w * 1.05, fo.k[1]), X(au, w, fo.a[1])], [0.3, 0.8]);
                // shoe: the side-view wedge given a little width, then outlined from this angle
                const pr0 = fo.pitch * RAD, pc = Math.cos(pr0), ps = Math.sin(pr0);
                const prof = [[-1.6, -0.6], [4.6, -0.2], [6.4, 0.5], [5.6, 1.6], [-1.4, 1.5], [-2.2, 0.5]];
                const pts = [];
                for (const [sx, sy] of prof) {
                    const du = sx * pc - sy * ps, dv = sx * ps + sy * pc;
                    pts.push(X(au + du, w - 1.5, fo.a[1] + dv), X(au + du, w + 1.5, fo.a[1] + dv));
                }
                shoes[i].setAttribute('d', 'M' + hull(pts).map(pt).join('L') + 'Z');
                legDepth[i] = depth((hu + ku + au) / 3, w);
            });
            // torso leans into the run; the jacket is a few rings, outlined from this angle
            const lean = r * go * 5;
            const sh = [41 + lean, 42 + bob + r * 1.2];
            const su = sh[0] - 40;
            const hy = hip[1];
            const kneeU = Math.max(feet[0].k[0], feet[1].k[0]) - 40;
            const fx = Math.max(kneeU * 0.45 + 4.4, 6 + lean * 0.3); // the hem swings out over the front knee
            const ring = (v, back, front, half) => {
                const uc = (back + front) / 2, ru = (front - back) / 2;
                const cx = 40 + uc * c, hw = Math.sqrt((ru * c) ** 2 + (half * s) ** 2);
                const vy = v + uc * s * PITCH;
                return { l: [cx - hw, vy], r: [cx + hw, vy], cx, v: vy };
            };
            const R = [
                ring(sh[1] + 1.2, su - 6.4, su + 5.2, 7.4),
                ring((sh[1] + hy) / 2, -7 + lean * 0.2, su + 5.6, 7.2),
                ring(hy + 4, -6.8, fx, 7.3),
                ring(hy + 12.4, -7.4, fx + 0.6, 8.4),
            ];
            const top = [40 + (su - 0.6) * c, sh[1] - 2.8];
            const bottom = [R[3].cx, R[3].v + 1.3];
            jacket.setAttribute('d', `M${pt(R[0].l)} Q${pt(top)} ${pt(R[0].r)} ${soft(R.map((q) => q.r), false)} Q${pt(bottom)} ${pt(R[3].l)} ${soft(R.map((q) => q.l).reverse(), false)}Z`);
            // belt between two heights, read off the jacket's outline
            const at = (v) => {
                const k = clamp((v - R[1].v) / (R[2].v - R[1].v), 0, 1);
                return { l: lerp(R[1].l[0], R[2].l[0], k) + 0.3, r: lerp(R[1].r[0], R[2].r[0], k) - 0.3 };
            };
            const oT = hy - 5.4, oB = hy - 1.6, a0 = at(oT), a1 = at(oB), sag = 0.7 * Math.abs(s);
            obi.setAttribute('d', `M${f(a0.l)} ${f(oT)} Q${f((a0.l + a0.r) / 2)} ${f(oT + sag)} ${f(a0.r)} ${f(oT)} L${f(a1.r)} ${f(oB)} Q${f((a1.l + a1.r) / 2)} ${f(oB + sag)} ${f(a1.l)} ${f(oB)}Z`);
            // the jacket's crossed collar, on the front only
            const seamP = [X(su + 4.4, -2.6, sh[1] + 0.8), X(su + 5.4, 0.6, (sh[1] + hy) / 2), X(fx - 0.6, 2.6, hy - 5.6)];
            seam.setAttribute('d', `M${pt(seamP[0])} Q${pt(seamP[1])} ${pt(seamP[2])}`);
            seam.setAttribute('opacity', f(smooth(-0.45, -0.1, toward)));
            // bundle on the back: swings with the bounce and the stride
            const bobV = (bob - lastBob) / Math.max(dt, 1e-3);
            lastBob = bob;
            const sw = sway.step(-self.speed * 0.05 - wind * 0.6 * c + bobV * 0.02, dt);
            const bu = su - 9.6 + sw * 0.5, bv = sh[1] + 10 + Math.abs(sw) * 0.15;
            const bc = X(bu, 0, bv);
            const bw = Math.sqrt((7 * c) ** 2 + (7.6 * s) ** 2) / 7; // width from this angle, 1 = side view
            const sx = (c >= 0 ? 1 : -1) * bw;
            const B = (dx, dy) => `${f(bc[0] + dx * sx)} ${f(bc[1] + dy)}`;
            bundle.setAttribute('d', `M${B(3, -8)} Q${B(-7.6, -7.4)} ${B(-7.4, 1)} Q${B(-6.6, 8.4)} ${B(1, 8)} Q${B(7, 7.6)} ${B(6.4, -1)} Q${B(6.4, -7.6)} ${B(3, -8)}Z`);
            bundleDots.setAttribute('d', `M${B(-4, -3)} L${B(4, -3.6)} M${B(-5, 1.4)} L${B(4.6, 0.8)} M${B(-4, 5.2)} L${B(3.4, 4.8)}`);
            const kn = X(bu + 3.4, 0, bv - 8.4), ks = c >= 0 ? 1 : -1;
            const K = (dx, dy) => `${f(dx * ks)} ${f(dy)}`;
            knot.setAttribute('d', `M${pt(kn)} q${K(-3.6 + sw * 0.4, -2.6)} ${K(-4.4 + sw * 0.6, 0.6)} q${K(1.6, 1.4)} ${K(4.4, -0.6)} q${K(2.4, -3.4)} ${K(4.2 + sw * 0.3, -1)} q${K(-1.4, 2.2)} ${K(-4.2, 1)}Z`);
            // straps from the bundle over each shoulder to a knot at the chest
            const backA = 1 - smooth(0.1, 0.45, toward), frontA = smooth(-0.6, -0.25, toward);
            [1, -1].forEach((side, i) => {
                const A = X(bu + 4.4, side * 2.4, bv - 7.6), Bp = X(su - 0.4, side * 4.4, sh[1] - 0.6), Cp = X(su + 5.2, side * 0.6, sh[1] + 9.6);
                const ctl1 = X(su - 3.2, side * 4, sh[1] - 1.8), ctl2 = X(su + 3.6, side * 3.6, sh[1] + 1.6);
                straps[i][0].setAttribute('d', `M${pt(A)} Q${pt(ctl1)} ${pt(Bp)}`);
                straps[i][1].setAttribute('d', `M${pt(Bp)} Q${pt(ctl2)} ${pt(Cp)}`);
                straps[i][0].setAttribute('opacity', f(backA));
                straps[i][1].setAttribute('opacity', f(frontA));
            });
            // head and the kasa, which nods a little behind the bounce
            const hc = X(su + 1.8 + lean * 0.3, 0, sh[1] - 9.6);
            head.setAttribute('cx', f(hc[0]));
            head.setAttribute('cy', f(hc[1]));
            clipHead.setAttribute('cx', f(hc[0]));
            clipHead.setAttribute('cy', f(hc[1]));
            const facing = (toward + 1) / 2; // 0 away … 0.5 side … 1 toward you
            const faceA = smooth(0.1, 0.55, facing);
            let hairD = `M${f(hc[0] - 6)} ${f(hc[1] - 7)} h12 v14 h-12Z`;
            if (faceA > 0.02) {
                const off = c * (1.9 + 2.4 * (1 - faceA));
                hairD += ' ' + ellipseD(hc[0] + off, hc[1] + 0.8, 3.5 * lerp(0.55, 1, faceA), 4.1 * lerp(0.6, 1, faceA));
            }
            hair.setAttribute('d', hairD);
            const tilt = hatS.step(-lean * 1.4 - bobV * 0.04 + wind * 1.5 * c, dt) * c;
            const hr = (deg, p) => { const a = (deg * RAD), cc = Math.cos(a), ss = Math.sin(a); const dx = p[0] - hc[0], dy = p[1] - hc[1]; return [hc[0] + dx * cc - dy * ss, hc[1] + dx * ss + dy * cc]; };
            const H = (dx, dy) => pt(hr(tilt, [hc[0] + dx, hc[1] + dy]));
            hat.setAttribute('d', `M${H(-13.4, -1.6)} Q${H(-6, -6.4)} ${H(0.4, -11.4)} Q${H(6.6, -6.6)} ${H(13.8, -2.2)} Q${H(0.2, 0.4)} ${H(-13.4, -1.6)}Z`);
            // ribs of the weave turn with you; only the near half of the cone shows
            let wd = '';
            for (let k = 0; k < 4; k++) {
                const b = k * (Math.PI / 2) + heading;
                if (Math.sin(b) < -0.01)
                    continue;
                wd += `M${H(0.4, -11)} L${H(6.8 * Math.cos(b), -0.9 + 0.3 * Math.sin(b))} `;
            }
            weave.setAttribute('d', wd + `M${H(-8.6, -3.4)} Q${H(0, -5 + 0.6 * Math.abs(s))} ${H(9.2, -3.6)}`);
            string.setAttribute('d', `M${H(-2.8, -1)} Q${f(hc[0] + 0.6 * c)} ${f(hc[1] + 6.4)} ${H(3.2, -1.1)}`);
            string.setAttribute('opacity', f(smooth(0.15, 0.4, facing)));
            // arms: opposite the legs, bent at the elbow when running
            const legSwing = clamp((feet[0].a[0] - 40) / 14, -1.2, 1.2);
            const amp = lerp(15, 38, r) * go;
            const elb = bend.step(lerp(0.15, 1.5, r * go), dt);
            const armDepth = [];
            const ease = 1 - Math.exp(-dt * 8);
            poseS.work += (self.pose.work - poseS.work) * ease;
            poseS.chop += (self.pose.chop - poseS.chop) * ease;
            poseS.hold += (self.pose.hold - poseS.hold) * ease;
            const busy = Math.max(poseS.work, poseS.hold);
            const handSum = [0, 0];
            [1, -1].forEach((side, i) => {
                // walking: the left arm swings against the left leg. working: both reach forward, the right one chops.
                let aim = lerp(-side * legSwing * amp, 34 + (side < 0 ? Math.sin(t * 15) * 16 * poseS.chop : 0), poseS.work);
                aim = lerp(aim, 50, poseS.hold);
                const a = armS[i].step(aim, dt) * RAD;
                const eb = lerp(elb, lerp(1.0, 1.45, poseS.hold / Math.max(1e-3, busy)), busy);
                const w = side * SHOULDER_W, sv = sh[1] + 2.5, su0 = su + 0.2;
                const eu = su0 + 15 * Math.sin(a), ev = sv + 15 * Math.cos(a);
                const hu = eu + 14 * Math.sin(a + eb), hv = ev + 14 * Math.cos(a + eb);
                const hand = X(hu, lerp(w + side * 1.2, side * 2.6, poseS.hold), hv);
                handSum[0] += hand[0] / 2;
                handSum[1] += hand[1] / 2;
                arms[i].draw([X(su0, w, sv), X(eu, lerp(w + side * 0.7, side * 4.6, poseS.hold), ev), hand], [0.2, 0.4]);
                hands[i].setAttribute('cx', f(hand[0]));
                hands[i].setAttribute('cy', f(hand[1]));
                armDepth[i] = depth(su0, w);
            });
            self.hands = [self.x + (handSum[0] - 40) * FS, self.y + (handSum[1] - 120) * FS];
            bundleG.style.display = self.carryBundle ? '' : 'none';
            straps.forEach((pair) => pair.forEach((n) => n.style.display = self.carryBundle ? '' : 'none'));
            // painter's order, nearest last
            const order = [
                [legG[0], -100 + legDepth[0]], [legG[1], -100 + legDepth[1]],
                [torsoG, 0],
                [bundleG, toward < -0.25 ? 50 : -50],
                [armG[0], armDepth[0]], [armG[1], armDepth[1]],
                [headG, 100],
            ];
            order.sort((p, q) => p[1] - q[1]);
            const key = order.map((o) => (o[0] === headG ? 'h' : o[0] === torsoG ? 't' : o[0] === bundleG ? 'b' : o[0] === armG[0] ? 'A' : o[0] === armG[1] ? 'a' : o[0] === legG[0] ? 'L' : 'l')).join('');
            if (key !== lastOrder) {
                lastOrder = key;
                order.forEach((o) => g.appendChild(o[0]));
            }
            // colours sink into the night palette
            const trousers = tint(C.trousers, P, 0.4);
            legs.forEach((l) => l.g.querySelector('path').setAttribute('fill', trousers));
            jacket.setAttribute('fill', tint(C.jacket, P));
            obi.setAttribute('fill', tint(C.obi, P));
            bundle.setAttribute('fill', tint(C.bundle, P));
            knot.setAttribute('fill', tint(C.bundle, P));
            hat.setAttribute('fill', tint(C.hat, P));
        },
    };
    return self;
}
