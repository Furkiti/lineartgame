// A thumb joystick drawn in the same pen as the scene, plus arrow keys / WASD.
export function createJoystick(base, knob) {
    const v = { x: 0, y: 0, active: false, touched: false };
    let id = null;
    const R = () => base.getBoundingClientRect().width * 0.38;
    const set = (e) => {
        const b = base.getBoundingClientRect();
        let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
        const r = R(), d = Math.hypot(dx, dy);
        if (d > r) {
            dx *= r / d;
            dy *= r / d;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        v.x = dx / r;
        v.y = dy / r;
    };
    const release = () => { id = null; v.active = false; v.x = 0; v.y = 0; knob.style.transform = ''; base.classList.remove('on'); };
    base.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; base.setPointerCapture(id); v.active = true; v.touched = true; base.classList.add('on'); set(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id)
        set(e); });
    base.addEventListener('pointerup', (e) => { if (e.pointerId === id)
        release(); });
    base.addEventListener('pointercancel', (e) => { if (e.pointerId === id)
        release(); });
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
    };
}
