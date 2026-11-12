// A thumb joystick drawn in the same pen as the scene, plus arrow keys / WASD.
// It is hidden until you touch the card: it appears centred under your thumb,
// follows the drag, and fades away as soon as you lift it.
export function createJoystick(area, base, knob) {
    const v = { x: 0, y: 0, active: false, touched: false };
    let id = null, cx = 0, cy = 0;
    const R = () => base.offsetWidth * 0.38;
    const set = (e) => {
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const r = R(), d = Math.hypot(dx, dy);
        if (d > r) {
            dx *= r / d;
            dy *= r / d;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        v.x = dx / r;
        v.y = dy / r;
    };
    const release = (e) => {
        if (e.pointerId !== id)
            return;
        id = null;
        v.active = false;
        v.x = 0;
        v.y = 0;
        knob.style.transform = '';
        base.classList.remove('on');
    };
    // capture phase, so it also works over the lanterns, the canal, the people… (they still get poked)
    area.addEventListener('pointerdown', (e) => {
        if (id !== null)
            return;
        const t = e.target;
        if (t.closest?.('.drag, #win.show, button, .closeup, .brushpad, .defter, .choices, .letter, #opening'))
            return; // sun/moon scrubbing and the win card keep their own touch
        e.preventDefault();
        id = e.pointerId;
        cx = e.clientX;
        cy = e.clientY;
        try {
            area.setPointerCapture(id);
        }
        catch { }
        const a = area.getBoundingClientRect();
        base.style.left = `${cx - a.left}px`;
        base.style.top = `${cy - a.top}px`;
        v.active = true;
        v.touched = true;
        knob.style.transform = '';
        base.classList.add('on');
        set(e);
    }, true);
    area.addEventListener('pointermove', (e) => { if (e.pointerId === id)
        set(e); });
    area.addEventListener('pointerup', release);
    area.addEventListener('pointercancel', release);
    area.addEventListener('lostpointercapture', release);
    const keys = new Set();
    addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow') || e.key === ' ')
        e.preventDefault(); v.touched = true; });
    addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => keys.clear());
    return {
        read() {
            if (v.active)
                return { x: v.x, y: v.y };
            let x = 0, y = 0;
            if (keys.has('arrowleft') || keys.has('a'))
                x -= 1;
            if (keys.has('arrowright') || keys.has('d'))
                x += 1;
            if (keys.has('arrowup') || keys.has('w'))
                y -= 1;
            if (keys.has('arrowdown') || keys.has('s'))
                y += 1;
            const m = Math.hypot(x, y);
            if (!m)
                return { x: 0, y: 0 };
            const k = keys.has('shift') ? 1 : 0.55; // shift to run
            return { x: (x / m) * k, y: (y / m) * k };
        },
        get touched() { return v.touched; },
        get active() { return v.active; },
    };
}
