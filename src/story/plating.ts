import { type Vec } from '../lib/ink.ts';
export type PlatePattern = 'row' | 'triangle';
export type PlateDesign = { pattern: PlatePattern; garnish: boolean };
export function plateGeometry(portrait: boolean, pattern: PlatePattern) {
  const plate = portrait ? { x: 248, y: 270, w: 164, h: 38 } : { x: 460, y: 182, w: 156, h: 38 };
  const cx = plate.x + plate.w / 2, cy = plate.y + plate.h / 2;
  const sources: Vec[] = portrait ? [[260, 210], [330, 210], [400, 210]] : [[250, 224], [308, 224], [366, 224]];
  const slots: Vec[] = pattern === 'row' ? [[cx - 53, cy], [cx, cy], [cx + 53, cy]] : [[cx - 51, cy - 6], [cx, cy + 8], [cx + 51, cy - 6]];
  return { plate, sources, slots, camera: (portrait ? [226, 130, 434, 342] : [220, 125, 642, 294]) as [number, number, number, number] };
}
export function freePlateSlot(point: Vec, slots: Vec[], occupied: number[], radius = 34) {
  let match = -1, distance = radius;
  slots.forEach((slot, i) => { const d = Math.hypot(point[0] - slot[0], point[1] - slot[1]); if (!occupied.includes(i) && d < distance) { match = i; distance = d; } });
  return match;
}
