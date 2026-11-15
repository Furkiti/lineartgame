// Tactile shared work: physical parts/cups/brushes keep their identity while dragged.
import { el, f, PAPER, type Vec } from "../lib/ink.ts";
import { approach, sfx, haptic } from "./fx.ts";

type Kind = "shelter" | "tea" | "drawing" | "chime";
type Part = {
  g: SVGGElement;
  at: Vec;
  home: Vec;
  target: Vec;
  placed: boolean;
  id: number;
};
export function createHandwork(card: HTMLElement, onExit: () => void) {
  const root = document.createElement("section");
  root.className = "handwork";
  root.setAttribute("aria-label", "Birlikte yap");
  root.innerHTML =
    '<header><small></small><h1></h1><p></p></header><svg viewBox="0 0 370 520" role="img" aria-label="Parçaları yerlerine sürükle"></svg><button class="handwork-back" type="button">Sonra devam ederim</button>';
  card.appendChild(root);
  const svg = root.querySelector("svg")!,
    title = root.querySelector("h1")!,
    tip = root.querySelector("p")!,
    kicker = root.querySelector("small")!;
  let parts: Part[] = [],
    drag: { id: number; pointer: number; offset: Vec } | null = null,
    active = false,
    finishAt = -1;
  let done: (() => void) | null = null,
    placed: ((ids: number[]) => void) | null = null;
  const path = (parent: Element, d: string, fill = "none", width = 1.4) =>
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
      parent,
    );
  function art(g: Element, kind: Kind, i: number) {
    if (kind === "shelter")
      path(
        g,
        i < 2
          ? "M-5 -55H5V55H-5ZM-5 -35H5M-5 30H5"
          : "M-102 18L-80 -12H80L102 18Q52 9 0 18Q-52 9-102 18Z",
        i < 2 ? "#bf9b6e" : "#e8d7b7",
      );
    else if (kind === "chime")
      path(g, "M-17 -28H17V28H-17ZM0 -32V-28", "#fff7df", 1);
    else if (kind === "tea") {
      path(
        g,
        "M-17 -10H17L13 12Q0 20-13 12ZM-17 -10Q0-18 17-10Q0-3-17-10",
        "#e5c9a0",
      );
      path(g, "M-10 -9Q0-13 10-9", "#9b7750", 0.7);
    } else {
      path(g, "M-3 26L0 -20H5L3 27ZM0 -20Q-7-28 2-35Q10-28 5-20", "#a87a4d");
      path(g, "M0 -20Q-5-27 2-32Q8-27 5-20", "#3e3530");
    }
  }
  const client = (e: PointerEvent): Vec => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [q.x, q.y];
  };
  svg.addEventListener("pointerdown", (e) => {
    if (!active || drag || finishAt >= 0) return;
    const id = (e.target as Element)
      .closest("[data-handwork-part]")
      ?.getAttribute("data-handwork-part");
    if (id === undefined || id === null) return;
    const part = parts[+id];
    if (!part || part.placed) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = client(e);
    drag = {
      id: +id,
      pointer: e.pointerId,
      offset: [part.at[0] - p[0], part.at[1] - p[1]],
    };
    svg.appendChild(part.g);
    sfx.tap();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const p = client(e),
      part = parts[drag.id];
    part.at = [p[0] + drag.offset[0], p[1] + drag.offset[1]];
    part.g.setAttribute(
      "transform",
      `translate(${f(part.at[0])} ${f(part.at[1])})`,
    );
  });
  function release(commit: boolean) {
    if (!drag) return;
    const part = parts[drag.id];
    if (
      commit &&
      Math.hypot(part.at[0] - part.target[0], part.at[1] - part.target[1]) < 58
    ) {
      part.placed = true;
      part.g.setAttribute("data-placed", "true");
      haptic(10);
      sfx.press();
      placed?.(parts.filter((p) => p.placed).map((p) => p.id));
      tip.textContent = parts.every((p) => p.placed)
        ? "Oldu. Şimdi burada bir yerimiz var."
        : "Bir parça daha…";
      if (parts.every((p) => p.placed)) finishAt = 0.8;
    }
    drag = null;
  }
  svg.addEventListener("pointerup", () => release(true));
  svg.addEventListener("pointercancel", () => release(false));
  root.querySelector("button")!.addEventListener("click", () => {
    if (finishAt >= 0) return;
    active = false;
    drag = null;
    root.classList.remove("show");
    done = null;
    onExit();
  });
  return {
    get isOpen() {
      return active;
    },
    open(
      kind: Kind,
      options: {
        restored?: number[];
        onPlaced?: (ids: number[]) => void;
        preview?: string;
        then: () => void;
      },
    ) {
      active = true;
      drag = null;
      finishAt = -1;
      done = options.then;
      placed = options.onPlaced ?? null;
      svg.replaceChildren();
      root.classList.add("show");
      root.setAttribute("data-kind", kind);
      kicker.textContent =
        kind === "shelter" ? "Yağmurda bir yer." : "Aynı sofrada.";
      title.textContent =
        kind === "shelter"
          ? "Birlikte kuralım."
          : kind === "chime"
            ? "Dilini çana bağla."
            : kind === "tea"
              ? "Çaylar ellerinden."
              : "Fırçalar hazır.";
      tip.textContent =
        kind === "shelter"
          ? "Parçaları soluk yerlerine sürükle."
          : kind === "chime"
            ? "Çizdiğin kâğıdı ipin ucuna sürükle."
            : "Her komşuya bir tane uzat.";
      path(svg, "M12 352H358M12 365H358", "none", 1);
      if (kind === "shelter") {
        path(svg, "M20 345Q80 338 137 346M240 349q45-8 105-2", "none", 0.5);
      } else if (kind === "chime") {
        path(
          svg,
          "M185 95V145M158 194Q157 145 185 145Q213 145 212 194ZM185 183V252",
          "#d5e0d4",
          1.4,
        );
      } else {
        [75, 185, 295].forEach((x, i) => {
          const g = el("g", { transform: `translate(${x} 244)` }, svg);
          path(
            g,
            "M-12 -58Q0-65 12-58L16-9H-16Z",
            ["#365271", "#b16e5c", "#727e60"][i],
          );
          el(
            "circle",
            {
              cx: 0,
              cy: -73,
              r: 11,
              fill: PAPER,
              stroke: "currentColor",
              "stroke-width": 1.2,
            },
            g,
          );
          path(g, "M-5 -72h1m8 0h1M-4 -66q4 3 8 0", "none", 0.7);
          path(g, "M-12 -52Q-23 -24-12 -20M12 -52Q23-24 12-20", "none", 2);
        });
        path(svg, "M25 264H345L331 283H39ZM48 283V340M322 283V340", "#caa477");
      }
      path(svg, "M18 388H352V488H18Z", "#eadac0", 0.7);
      const targets: Vec[] =
        kind === "chime"
          ? [[185, 287]]
          : kind === "shelter"
            ? [
                [96, 292],
                [274, 292],
                [185, 219],
              ]
            : [
                [75, 257],
                [185, 257],
                [295, 257],
              ];
      const homes: Vec[] =
        kind === "chime"
          ? [[185, 435]]
          : kind === "shelter"
            ? [
                [60, 437],
                [120, 437],
                [253, 438],
              ]
            : [
                [82, 435],
                [185, 435],
                [288, 435],
              ];
      targets.forEach((at, i) => {
        const g = el(
          "g",
          {
            transform: `translate(${at[0]} ${at[1]})`,
            opacity: 0.3,
            "stroke-dasharray": "4 5",
            "data-handwork-target": i,
          },
          svg,
        );
        art(g, kind, i);
      });
      parts = homes.map((at, i) => {
        const g = el(
          "g",
          {
            "data-handwork-part": i,
            "data-placed": String(options.restored?.includes(i) ?? false),
            style: "cursor:grab",
          },
          svg,
        );
        art(g, kind, i);
        if (kind === "chime" && options.preview) {
          const ink = el("g", {}, g);
          ink.innerHTML = options.preview;
        }
        el(
          "rect",
          {
            x: kind === "shelter" && i === 2 ? -102 : -24,
            y: kind === "shelter" && i < 2 ? -55 : -35,
            width: kind === "shelter" && i === 2 ? 204 : 48,
            height: kind === "shelter" && i < 2 ? 110 : 70,
            fill: "transparent",
          },
          g,
        );
        const restored = options.restored?.includes(i) ?? false;
        const pos = restored ? targets[i] : at;
        g.setAttribute("transform", `translate(${pos[0]} ${pos[1]})`);
        return {
          g,
          at: [...pos] as Vec,
          home: at,
          target: targets[i],
          placed: restored,
          id: i,
        };
      });
      if (parts.every((p) => p.placed)) finishAt = 0.5;
    },
    draw(dt: number) {
      if (!active) return;
      parts.forEach((part) => {
        if (drag?.id === part.id) return;
        const target = part.placed ? part.target : part.home;
        part.at = [
          approach(part.at[0], target[0], 12, dt),
          approach(part.at[1], target[1], 12, dt),
        ];
        part.g.setAttribute(
          "transform",
          `translate(${f(part.at[0])} ${f(part.at[1])})`,
        );
      });
      if (finishAt >= 0) {
        finishAt -= dt;
        if (finishAt <= 0) {
          active = false;
          finishAt = -1;
          root.classList.remove("show");
          sfx.chime();
          const cb = done;
          done = null;
          cb?.();
        }
      }
    },
  };
}
