export type Visit = 'none' | 'planned' | 'waiting' | 'inside' | 'missed' | 'done';
export function nextVisit(visit: Visit, tau: number, inside: boolean): Visit {
  if (visit === 'planned' && tau >= .70) return tau >= .88 ? 'missed' : inside ? 'inside' : 'waiting';
  if (visit === 'waiting') return tau >= .88 ? 'missed' : inside ? 'inside' : 'waiting';
  return visit;
}
export function timeRate(mode: string, day: number, kiteDone: boolean, modal: boolean) {
  if (modal || mode === 'intro' || mode === 'cine' || mode === 'sleep' || mode === 'craft' || (!kiteDone && day === 1)) return 0;
  if (mode === 'brush' || mode === 'desk' || mode === 'cook') return .12;
  return 1;
}
