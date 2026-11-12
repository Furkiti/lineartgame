// One day in the ink street, told without menus:
//   morning  — Kenta's kite is stuck in the cherry tree; you draw him a new one with the brush
//   evening  — make sushi at home (close-up), carry it to the table, Kenta comes to eat
//   night    — stand still under the street lamp and a shy fox comes to sit with you
//   sleep    — the notebook writes the day's page
// The story asks the camera for framings, shows signs (balloons, the guide crane, a ghost
// hand, twinkles) and decides what the single action button says.
import {} from "../lib/ink.js";
import { IX } from "../village/home.js";
import {} from "./ui.js";
import { createKenta, createStuckKite, createKite, createStroke, recognise } from "./kenta.js";
import { createFox } from "./fox.js";
import { createCloseup } from "./closeup.js";
import { createNotebook, SKETCH } from "./notebook.js";
import { sfx, haptic, wakeAudio, inkRing, approach } from "./fx.js";
const KENTA_HOME = [436, 357];
const STUCK = [486, 196];
const LAMP = [446, 352];
const DOOR_X = 826;
export function createStory(o) {
    const { svg, card, ui, home, player, layers, env } = o;
    // ------------------------------------------------------------------ cast
    const kenta = createKenta(layers.walkers, KENTA_HOME[0], KENTA_HOME[1]);
    kenta.want.sad = 1;
    const stuck = createStuckKite(layers.front, STUCK);
    const kite = createKite(layers.front);
    const stroke = createStroke(layers.stroke);
    const fox = createFox(layers.walkers, layers.glow);
    let guest = null, guestAte = 0;
    const notebook = createNotebook(card);
    const q = { kite: 'sad', sushi: false, fox: false, fresh: new Set(), day: 1, slept: 0 };
    const entries = () => [
        { id: 'kite', title: 'Kenta’nın uçurtması', hint: 'Kiraz ağacının altında biri üzgün.', sketch: SKETCH.kite, done: q.kite === 'done', fresh: q.fresh.has('kite') },
        { id: 'sushi', title: 'Akşam yemeği', hint: 'Mutfakta suşi yap, masaya götür.', sketch: SKETCH.sushi, done: q.sushi, fresh: q.fresh.has('sushi') },
        { id: 'fox', title: 'Gece misafiri', hint: 'Gece fenerin altında… sessizce.', sketch: SKETCH.fox, done: q.fox, fresh: q.fresh.has('fox') },
    ];
    const defterBtn = document.createElement('button');
    defterBtn.type = 'button';
    defterBtn.className = 'defter-btn';
    defterBtn.setAttribute('aria-label', 'Defter');
    defterBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3Z M8 3v18 M11 8h5 M11 11h5"/></svg><span class="dots"><i></i><i></i><i></i></span>`;
    card.appendChild(defterBtn);
    const dots = [...defterBtn.querySelectorAll('.dots i')];
    const refreshDots = () => { [q.kite === 'done', q.sushi, q.fox].forEach((d, i) => dots[i].classList.toggle('on', d)); };
    defterBtn.addEventListener('click', () => {
        sfx.tap();
        notebook.show({ dayN: q.day, subtitle: 'bugün', entries: entries(), sentence: q.fox ? 'Uzun, güzel bir gün.' : 'Sayfanın geri kalanı henüz boş.', button: 'Kapat' });
    });
    const mark = (id) => {
        q.fresh.add(id);
        refreshDots();
        defterBtn.classList.remove('bump');
        void defterBtn.offsetWidth;
        defterBtn.classList.add('bump');
    };
    // ------------------------------------------------------------------ the brush pad
    const pad = document.createElement('div');
    pad.className = 'brushpad';
    card.appendChild(pad);
    const toWorld = (cx, cy) => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const m = svg.getScreenCTM(); const r = m ? p.matrixTransform(m.inverse()) : p; return [r.x, r.y]; };
    let drawing = false, lastPt = null, fails = 0;
    pad.addEventListener('pointerdown', (e) => {
        if (mode !== 'brush')
            return;
        e.preventDefault();
        pad.setPointerCapture(e.pointerId);
        wakeAudio();
        drawing = true;
        stroke.clear();
        ui.hideGesture();
        env.tip(null);
        const p = toWorld(e.clientX, e.clientY);
        stroke.add(p, 0);
        lastPt = { p, t: performance.now() };
        sfx.paper();
    });
    pad.addEventListener('pointermove', (e) => {
        if (!drawing)
            return;
        const p = toWorld(e.clientX, e.clientY), now = performance.now();
        const sp = lastPt ? Math.hypot(p[0] - lastPt.p[0], p[1] - lastPt.p[1]) / Math.max(1, now - lastPt.t) * 1000 : 0;
        stroke.add(p, sp);
        lastPt = { p, t: now };
    });
    const lift = () => { if (!drawing)
        return; drawing = false; judge(); };
    pad.addEventListener('pointerup', lift);
    pad.addEventListener('pointercancel', lift);
    // ------------------------------------------------------------------ kitchen close-up
    const closeup = createCloseup(card, {
        onStep: (n) => home.setStep(n),
        onDone: () => { env.tip('Tabağı al, masaya götür.'); },
        onExit: () => { mode = 'walk'; cam = null; },
    });
    // ------------------------------------------------------------------ state & a tiny script runner
    let mode = 'walk';
    let cam = null;
    let script = null, waitT = 0, waitFn = null;
    let ctx;
    let blocks = true; // the intro runs in the background and blocks nothing
    const run = (g, block = true) => { script = g; blocks = block; waitT = 0; waitFn = null; advance(); };
    function advance() {
        while (script) {
            const r = script.next();
            if (r.done) {
                script = null;
                return;
            }
            if (typeof r.value === 'number') {
                waitT = r.value;
                return;
            }
            waitFn = r.value;
            return;
        }
    }
    /** a camera framing that fits a scene rectangle */
    const fit = (x0, y0, x1, y1, zmax = 3) => ({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z: Math.max(1, Math.min(zmax, ctx.base.w / (x1 - x0), ctx.base.h / (y1 - y0))) });
    const playerHead = () => [player.x, player.y - 50];
    const kentaHead = () => [kenta.head[0], kenta.head[1] - 6];
    const guestHead = () => guest ? [guest.head[0], guest.head[1] - 6] : [0, 0];
    let obj = null;
    const setObj = (at, near, inside) => { obj = { at, near, inside, since: 0, guided: false }; };
    // ------------------------------------------------------------------ scenes
    function* intro() {
        yield 0.6;
        env.banner(`${q.day}. gün`, 'Sabah. Sokak uyanıyor.');
        yield 2.6;
        // teach walking once: a ghost hand drags on the ground beside you
        if (!ctx.stickTouched) {
            env.tip('Ekranda bir yere bas ve sürükle.', true);
            ui.showGesture('path', () => [[player.x - 4, player.y + 14], [player.x + 26, player.y + 14]]);
            yield () => ctx.stickTouched;
            ui.hideGesture();
            env.tip(null);
        }
        yield 1.6;
        setObj(kentaHead, () => Math.abs(player.x - kenta.x) < 60, false);
    }
    function* talk() {
        mode = 'cine';
        obj = null;
        ui.guide(null);
        const x0 = Math.min(player.x, kenta.x), x1 = Math.max(player.x, kenta.x);
        cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
        player.faceTo = kenta.x > player.x ? 0.25 : Math.PI - 0.25;
        kenta.dir = player.x < kenta.x ? -1 : 1;
        kenta.want.sad = 0.4;
        yield 0.6;
        ui.say(kentaHead, 'Uçurtmam ağaca takıldı…');
        yield 2.4;
        kenta.want.look = 1;
        cam = fit(STUCK[0] - 70, STUCK[1] - 60, STUCK[0] + 70, STUCK[1] + 80, 2.4);
        yield 2.0;
        cam = fit(x0 - 45, 268, x1 + 45, 382, 2.2);
        kenta.want.look = 0;
        kenta.want.sad = 0.7;
        ui.say(kentaHead, 'Yenisini çizebilen biri olsa…');
        yield 2.6;
        q.kite = 'talked';
        ui.say(playerHead, '(Bohçamda bir fırça vardı…)', 2.8);
        ui.sparkle(() => [player.x - (Math.cos(player.heading) >= 0 ? 6 : -6), player.y - 30]);
        sfx.chime();
        yield 1.4;
        player.faceTo = null;
        mode = 'walk';
        cam = null;
    }
    function startBrush() {
        mode = 'brush';
        ui.sparkle(null);
        fails = 0;
        cam = fit(372, 148, 524, 388, 2.4);
        pad.classList.add('show');
        kenta.dir = 1;
        env.tip('Kenta’ya bir uçurtma çiz.', true);
        // the first time: a dotted kite and a hand that traces it
        const c = [kenta.x + 36, 292];
        ui.showGesture('path', () => [[c[0], c[1] - 18], [c[0] + 13, c[1]], [c[0], c[1] + 18], [c[0] - 13, c[1]], [c[0], c[1] - 18]], { period: 3 });
    }
    function endBrush() { pad.classList.remove('show'); ui.hideGesture(); env.tip(null); if (mode === 'brush') {
        mode = 'walk';
        cam = null;
    } }
    function judge() {
        const pts = stroke.points;
        const r = recognise(pts);
        if (r.kind === 'tiny') {
            stroke.vanish();
            return;
        }
        if (r.kind === 'kite') {
            run(kiteBorn(r.center));
            return;
        }
        fails++;
        stroke.vanish();
        sfx.nope();
        haptic(10);
        kenta.hop();
        ui.say(kentaHead, r.kind === 'ball' ? 'Bu bir top! Uçurtmanın köşeleri olur ama…' : r.kind === 'stick' ? 'Bir sopa mı? Uçurtma kapalı bir şekil olur.' : 'Hmm… bu ne? Üç dört köşeli bir şey lazım.');
        if (fails >= 2) {
            const c = [kenta.x + 36, 292];
            ui.showGesture('path', () => [[c[0], c[1] - 18], [c[0] + 13, c[1]], [c[0], c[1] + 18], [c[0] - 13, c[1]], [c[0], c[1] - 18]], { period: 3 });
        }
    }
    function* kiteBorn(at) {
        mode = 'cine';
        pad.classList.remove('show');
        env.tip(null);
        ui.hideGesture();
        stroke.vanish();
        kite.birth(at);
        stuck.remove();
        sfx.chime();
        haptic(16);
        yield 0.9;
        kenta.hop();
        kenta.want.raise = 1;
        kenta.want.sad = 0;
        kenta.want.look = 0.6;
        sfx.pop();
        ui.heart(kentaHead());
        cam = fit(360, 110, 530, 388, 2.2);
        yield 1.6;
        ui.say(kentaHead, 'Benim uçurtmam! Çok güzel olmuş!');
        q.kite = 'done';
        mark('kite');
        sfx.success();
        yield 2.8;
        kenta.want.look = 0;
        ui.say(kentaHead, 'Karnım acıktı… Sen suşi yapmayı biliyor musun?');
        yield 3.0;
        ui.say(kentaHead, 'Akşam sana uğrarım!');
        yield 1.8;
        mode = 'walk';
        cam = null;
        // next: home. the crane shows the way
        setObj(() => [DOOR_X, 300], () => ctx.inside, false);
    }
    function* cookIn() {
        mode = 'cook';
        obj = null;
        ui.guide(null);
        env.tip(null);
        player.faceTo = -0.66;
        cam = fit(IX + 250, 286, IX + 334, 340, 4);
        yield 0.65;
        closeup.open(Math.min(3, home.step));
        player.faceTo = null;
    }
    function* guestArrives() {
        guest = createKenta(home.actors, IX + 30, 356);
        guestAte = 0;
        guest.want.sad = 0;
        guest.dir = 1;
        guest.g.setAttribute('opacity', '0');
        kenta.g.style.display = 'none';
        kite.draw(0, 0, 0, null); // the street Kenta has come over
        yield 0.4;
        guest.g.setAttribute('opacity', '1');
        sfx.tap();
        ui.say(guestHead, 'Konbanwa! Kokusu buraya kadar geliyor!');
        guest.walkTo(IX + 214, 353);
        yield () => !guest.walking;
        guest.dir = -1;
        ui.say(guestHead, 'Itadakimasu!');
    }
    function* guestLeaves() {
        mode = 'cine';
        cam = fit(IX + 140, 276, IX + 240, 372, 2.6);
        yield 1.2;
        ui.say(guestHead, 'Çok teşekkürler! Sana bir sır vereyim…');
        yield 2.8;
        ui.say(guestHead, 'Gece fenerin altına bir tilki gelirmiş. Ama sadece kıpırdamadan bekleyene.');
        yield 4.4;
        ui.say(guestHead, 'Oyasumi!');
        guest.speed = 46;
        guest.walkTo(IX + 30, 356);
        mode = 'walk';
        cam = null;
        yield () => !guest.walking;
        guest.g.remove();
        guest = null;
        q.sushi = true;
        mark('sushi');
        setObj(() => [LAMP[0], LAMP[1] - 60], () => !ctx.inside && Math.abs(player.x - LAMP[0]) < 40, false);
    }
    let stillT = 0, foxSit = 0, foxDone = 0, toldStill = false, sunTaught = false, insideKey = '';
    function* foxMoment() {
        mode = 'cine';
        q.fox = true;
        mark('fox');
        sfx.chime();
        haptic(12);
        ui.heart([fox.x, fox.y - 26]);
        cam = fit(Math.min(player.x, fox.x) - 50, 290, Math.max(player.x, fox.x) + 50, 380, 2.6);
        yield 3.2;
        fox.leave();
        yield 2.2;
        ui.stillness(null);
        ui.say(playerHead, '(Uykum geldi. Eve döneyim.)', 2.6);
        mode = 'walk';
        cam = null;
        setObj(() => [DOOR_X, 300], () => ctx.inside, false);
    }
    function* sleep() {
        mode = 'sleep';
        obj = null;
        ui.guide(null);
        cam = fit(IX + 150, 250, IX + 230, 310, 3);
        yield 1.4;
        env.fade(1);
        yield () => env.isFaded();
        const sentence = q.fox ? 'Kenta’nın uçurtması uçtu, suşi paylaşıldı, bir tilki yanıma oturdu.' : q.sushi ? 'Kenta’yla suşi yedik. Tilkiyi bir dahaki geceye bırakalım.' : 'Sakin bir gün.';
        let closed = false;
        notebook.show({ dayN: q.day, subtitle: 'gün bitti', entries: entries(), sentence, button: 'Günaydın', then: () => { closed = true; } });
        q.fresh.clear();
        yield () => closed;
        q.slept = q.day;
        q.day++;
        env.setTau(0.27);
        cam = null;
        env.fade(0);
        yield 0.8;
        env.banner(`${q.day}. gün`, 'Devamı yakında: Hana’nın feneri, mektuplar…');
        mode = 'walk';
    }
    // ------------------------------------------------------------------ api
    run(intro(), false);
    refreshDots();
    return {
        get freeze() { return mode !== 'walk'; },
        get cam() { return cam; },
        get mode() { return mode; },
        get closeupOpen() { return closeup.isOpen; },
        /** what the action button says, if the story has something to offer */
        prompt() {
            if (mode === 'brush')
                return 'Vazgeç';
            if (mode !== 'walk')
                return '';
            if (!(script && blocks) && !ctx.inside && q.kite !== 'done' && Math.abs(player.x - kenta.x) < 34 && Math.abs(player.y - kenta.y) < 18)
                return q.kite === 'sad' ? 'Kenta ile konuş' : 'Fırçayı çıkar';
            return null;
        },
        act() {
            if (mode === 'brush') {
                endBrush();
                return true;
            }
            if (mode !== 'walk')
                return true;
            if (!(script && blocks) && !ctx.inside && q.kite !== 'done' && Math.abs(player.x - kenta.x) < 34) {
                sfx.tap();
                if (q.kite === 'sad')
                    run(talk());
                else
                    startBrush();
                return true;
            }
            return false;
        },
        /** the home asks the story to take over */
        onHome(what) { if (what === 'cook')
            run(cookIn());
        else
            run(sleep()); },
        sortables() { return ctx && !ctx.inside ? [kenta, fox].filter((c) => c.g.style.display !== 'none') : []; },
        update(c) {
            ctx = c;
            const { t, dt, P, wind } = c;
            // run the scene script
            if (script) {
                if (waitFn) {
                    if (waitFn()) {
                        waitFn = null;
                        advance();
                    }
                }
                else {
                    waitT -= dt;
                    if (waitT <= 0)
                        advance();
                }
            }
            // street Kenta: sad under the tree, then flying his kite, wandering a little
            if (kenta.g.style.display !== 'none') {
                if (q.kite === 'done' && !kenta.walking && Math.random() < dt * 0.25)
                    kenta.walkTo(410 + Math.random() * 60, 353 + Math.random() * 8);
                kenta.speed = q.kite === 'done' ? 18 : 26;
                kenta.draw(t, dt, P);
                if (q.kite !== 'done' && mode === 'walk' && !script) {
                    kenta.dir = player.x < kenta.x ? -1 : 1;
                    if (Math.random() < dt * 0.18 && Math.abs(player.x - kenta.x) > 40 && !ui.speaking)
                        ui.say(kentaHead, '…', 2);
                }
            }
            stuck.draw(t, dt, wind);
            kite.draw(t, dt, wind, kenta.g.style.display === 'none' ? null : kenta.hand);
            stroke.draw(dt);
            if (guest) {
                guest.draw(t, dt, P);
                // keep depth right against the player in the room
                if (player.g.parentNode === home.actors) {
                    const front = guest.y > player.y;
                    if (front && guest.g.previousElementSibling !== player.g)
                        home.actors.appendChild(guest.g);
                    if (!front && guest.g.nextElementSibling !== player.g)
                        home.actors.insertBefore(guest.g, player.g);
                }
                // you walked out while he was saying goodbye: he has gone home too
                if (!c.inside && q.sushi === false && home.step === 0 && guest.walking) {
                    guest.g.remove();
                    guest = null;
                    script = null;
                    mode = 'walk';
                    cam = null;
                    q.sushi = true;
                    mark('sushi');
                    setObj(() => [LAMP[0], LAMP[1] - 60], () => !ctx.inside && Math.abs(player.x - LAMP[0]) < 40, false);
                }
            }
            if (closeup.isOpen)
                closeup.draw(t, dt, P);
            else
                closeup.draw(t, dt, P); // lets it fade out
            // dinner: Kenta comes when the plate is on the table, reacts as you eat, leaves after
            if (q.kite === 'done' && !q.sushi && c.inside && home.step === 6 && !guest && !script)
                run(guestArrives());
            if (guest && home.eaten > guestAte) {
                guestAte = home.eaten;
                guest.hop();
                ui.heart(guestHead());
                sfx.pop();
                if (guestAte === 1)
                    ui.say(guestHead, 'Oishii!');
                if (guestAte === 2)
                    ui.say(guestHead, 'Bu somon ağızda eriyor!');
            }
            if (guest && home.step === 0 && !script && !q.sushi)
                run(guestLeaves());
            // night: the fox under the lamp
            fox.draw(t, dt, { inkT: P.inkT, night: P.night });
            if (q.sushi && !q.fox && !c.inside && mode === 'walk') {
                const isNight = P.night > 0.45;
                // in daylight, teach that the sun can be dragged
                if (!isNight && !sunTaught && !script) {
                    sunTaught = true;
                    const u = (c.tau - 0.225) / 0.55;
                    if (u > 0 && u < 1) {
                        const sun = (v) => [40 + 880 * v, 300 - 236 * Math.sin(Math.PI * v)];
                        env.tip('Acelen varsa güneşi sürükle.');
                        ui.showGesture('path', () => { const uu = Math.max(0.02, Math.min(0.98, (ctx.tau - 0.225) / 0.55)); return [sun(uu), sun(Math.min(1, uu + 0.12)), sun(Math.min(1, uu + 0.24))]; }, { period: 2.6 });
                        setTimeout(() => { ui.hideGesture(); env.tip(null); }, 7000);
                    }
                }
                const atLamp = Math.abs(player.x - LAMP[0]) < 30;
                if (isNight && atLamp) {
                    const still = !c.stickActive && player.moving < 0.05;
                    if (!toldStill) {
                        toldStill = true;
                        ui.say(playerHead, '(Kıpırdamadan bekle…)', 3);
                    }
                    if (still)
                        stillT += dt;
                    else {
                        if (fox.state === 'come' || fox.state === 'sit') {
                            fox.startle();
                            sfx.nope();
                            ui.say(playerHead, '(Ürktü… bir daha deneyelim.)', 2.6);
                        }
                        stillT = 0;
                        foxSit = 0;
                    }
                    ui.stillness(() => [player.x, player.y - 22], Math.min(1, stillT / 9));
                    if (stillT > 2.5 && fox.state === 'away')
                        fox.come(LAMP[0] + 120, player.x + 26, player.y + 4);
                    // the camera breathes in while you wait
                    cam = stillT > 1 ? fit(player.x - 70 + stillT * 2, 250, player.x + 120 - stillT * 2, 392, 2.4) : null;
                    if (fox.state === 'sit') {
                        foxSit += dt;
                        if (foxSit > 2.2 && foxDone === 0) {
                            foxDone = 1;
                            run(foxMoment());
                        }
                    }
                }
                else {
                    ui.stillness(null);
                    if (mode === 'walk' && !script)
                        cam = null;
                    stillT = 0;
                }
            }
            home.canSleep = c.inside && mode === 'walk' && (c.tau > 0.75 || c.tau < 0.21 || (q.fox && q.slept < q.day));
            // the recipe's next place, inside; the way home, outside
            if (q.kite === 'done' && !q.sushi && mode === 'walk' && !script) {
                if (c.inside) {
                    const key = home.step < 5 ? 'counter' + (home.step === 4 ? '4' : '') : home.step === 5 ? 'table' : 'eat';
                    if (key !== insideKey) {
                        insideKey = key;
                        if (key.startsWith('counter')) {
                            setObj(() => [IX + 292, 300], () => Math.abs(player.x - (IX + 262)) < 24, true);
                            env.tip(home.step === 4 ? 'Tabağı al.' : 'Mutfağa geç, suşi hazırla.');
                        }
                        else if (key === 'table') {
                            setObj(() => [IX + 186, 316], () => Math.abs(player.x - (IX + 186)) < 30, true);
                            env.tip('Tabağı masaya götür.');
                        }
                        else
                            obj = null;
                    }
                }
                else {
                    insideKey = '';
                    if (!obj || obj.inside)
                        setObj(() => [DOOR_X, 300], () => ctx.inside, false);
                }
            }
            // guide crane and the hint ladder
            if (obj && mode === 'walk' && !script) {
                obj.since += dt;
                const inScene = obj.inside === c.inside;
                const isNear = obj.near();
                // a new goal: the crane shows the way at once; later only if you seem lost
                if (!obj.guided && inScene && obj.since > 0.4) {
                    obj.guided = true;
                    ui.guide(obj.at);
                }
                if (isNear && ui.guiding)
                    ui.guide(null);
                if (!isNear && !ui.guiding && obj.since > 22 && inScene) {
                    ui.guide(obj.at);
                    obj.since = 0;
                }
                ui.sparkle(isNear && obj.since > 6 ? obj.at : null);
            }
            else if (mode !== 'walk')
                ui.guide(null);
            if (q.kite === 'talked' && mode === 'walk' && !script)
                ui.sparkle(() => [kenta.x, kenta.y - 30]);
        },
        /** called on any touch: a ring and a sound, everywhere */
        touch(e) { wakeAudio(); inkRing(card, e.clientX, e.clientY); },
        // debug hooks for headless checks
        _dbg: { q, kenta, fox, closeup, run, judgeWith: (pts) => { stroke.clear(); pts.forEach((p) => stroke.add(p, 50)); judge(); }, startBrush, approach },
    };
}
