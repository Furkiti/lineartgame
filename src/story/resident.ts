// A neighbour with a place in the street, rather than a voice from an empty doorway.
import { el, f, PAPER, type Vec } from "../lib/ink.ts";
import { approach } from "./fx.ts";

export function createResident(
  parent: Element,
  name: string,
  x: number,
  y: number,
  color = "#a66354",
) {
  const g = el("g", { "data-resident": name }, parent);
  const ink = (d: string, width = 1.2, fill = "none") =>
    el(
      "path",
      {
        d,
        fill,
        stroke: "currentColor",
        "stroke-width": width,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
      g,
    );
  const shadow = el(
    "ellipse",
    { cx: 0, cy: 0, rx: 8, ry: 1.3, fill: "currentColor", opacity: 0.1 },
    g,
  );
  const legs = ink("M-3 -15L-4 0H-8M3 -15L5 0H9", 1.7);
  const body = ink("M-6 -38Q0 -41 6 -38L8 -14Q0 -11-8 -14Z", 1, color);
  ink("M-6 -34L5 -29M-5 -27H6M-5 -27L-6 -15H7L5 -27", 0.6, "#efe2c9");
  const farArm = ink("M-5 -36Q-10 -26-7 -19", 2.1);
  const arm = ink("", 2.1);
  const hand = el(
    "circle",
    { r: 1.4, fill: PAPER, stroke: "currentColor", "stroke-width": 0.5 },
    g,
  );
  const headG = el("g", {}, g);
  el(
    "ellipse",
    {
      cx: 0,
      cy: -44,
      rx: 4.2,
      ry: 5,
      fill: PAPER,
      stroke: "currentColor",
      "stroke-width": 0.8,
    },
    headG,
  );
  el(
    "path",
    {
      d: "M-4 -43Q-7-51 0-50Q4-50 4-46L1-47Q-1-46-4-43Z",
      fill: "#3c3838",
      stroke: "currentColor",
      "stroke-width": 0.6,
    },
    headG,
  );
  el(
    "circle",
    {
      cx: -4.5,
      cy: -49,
      r: 2.7,
      fill: "#3c3838",
      stroke: "currentColor",
      "stroke-width": 0.6,
    },
    headG,
  );
  el(
    "path",
    {
      d: "M1 -44h1M1 -41q1 .8 2 0",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 0.65,
      "stroke-linecap": "round",
    },
    headG,
  );
  let tx = x,
    ty = y,
    motion = 0;
  const self = {
    g,
    x,
    y,
    dir: -1,
    talking: false,
    faceTarget: null as number | null,
    visible: true,
    get head(): Vec {
      return [self.x, self.y - 49];
    },
    get walking() {
      return Math.hypot(tx - self.x, ty - self.y) > 0.7;
    },
    walkTo(nx: number, ny = self.y) {
      tx = nx;
      ty = ny;
    },
    draw(t: number, dt: number) {
      g.style.display = self.visible ? "" : "none";
      if (!self.visible) return;
      const dx = tx - self.x,
        dy = ty - self.y,
        dist = Math.hypot(dx, dy);
      motion = approach(motion, self.walking ? 1 : 0, 5, dt);
      if (dist > 0.7) {
        const d = Math.min(dist, dt * 26);
        self.x += (dx / dist) * d;
        self.y += (dy / dist) * d;
        if (Math.abs(dx) > 1) self.dir = Math.sign(dx);
      }
      if (self.faceTarget !== null)
        self.dir = self.faceTarget < self.x ? -1 : 1;
      g.setAttribute(
        "transform",
        `translate(${f(self.x)} ${f(self.y)}) scale(${self.dir} 1)`,
      );
      g.setAttribute("data-facing", self.dir);
      const breath = Math.sin(t * 1.8) * 0.35;
      headG.setAttribute(
        "transform",
        `translate(0 ${f(breath)}) rotate(${f(self.talking ? Math.sin(t * 2.4) * 2 : 0)} 0 -44)`,
      );
      body.setAttribute("transform", `translate(0 ${f(breath * 0.6)})`);
      const step = Math.sin(t * 7) * motion * 5;
      legs.setAttribute(
        "d",
        `M-3 -15L${f(-4 + step)} 0h-4M3 -15L${f(5 - step)} 0h4`,
      );
      const hx = self.talking ? 10 + Math.sin(t * 2.3) * 1.5 : 7,
        hy = self.talking ? -27 + Math.sin(t * 2.3) * 2 : -19;
      arm.setAttribute("d", `M5 ${f(-36 + breath)}Q12 -29 ${f(hx)} ${f(hy)}`);
      hand.setAttribute("cx", f(hx));
      hand.setAttribute("cy", f(hy));
      void shadow;
      void farArm;
    },
  };
  return self;
}
