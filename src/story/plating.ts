import { type Vec } from '../lib/ink.ts';
export type PlatePattern = 'row' | 'triangle';
export type PlateDesign = { pattern: PlatePattern; garnish: boolean };
export function plateGeometry(portrait: boolean, pattern: PlatePattern) {
  // a long geta for a full set of six, in two staggered rows
  const plate = portrait ? { x: 236, y: 266, w: 188, h: 50 } : { x: 452, y: 178, w: 172, h: 48 };
  const cx = plate.x + plate.w / 2, cy = plate.y + plate.h / 2;
  const sources: Vec[] = portrait ? [[262, 196], [316, 194], [370, 196], [282, 236], [336, 238], [390, 236]] : [[250, 206], [304, 204], [358, 206], [270, 238], [324, 240], [378, 238]];
  const dx = plate.w / 3.4;
  const slots: Vec[] = pattern === 'row'
    ? [[cx - dx, cy - 12], [cx, cy - 13], [cx + dx, cy - 12], [cx - dx, cy + 10], [cx, cy + 11], [cx + dx, cy + 10]]
    : [[cx - dx, cy - 11], [cx, cy + 10], [cx + dx, cy - 11], [cx - dx, cy + 10], [cx, cy - 12], [cx + dx, cy + 10]];
  return { plate, sources, slots, camera: (portrait ? [220, 128, 440, 346] : [214, 120, 648, 300]) as [number, number, number, number] };
}
export function freePlateSlot(point: Vec, slots: Vec[], occupied: number[], radius = 34) {
  let match = -1, distance = radius;
  slots.forEach((slot, i) => { const d = Math.hypot(point[0] - slot[0], point[1] - slot[1]); if (!occupied.includes(i) && d < distance) { match = i; distance = d; } });
  return match;
}
