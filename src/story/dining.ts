import { type Vec } from '../lib/ink.ts';
import { clamp01, easeInOut, lerp } from './fx.ts';
export const SEATS = [166, 206] as const;
export type MealTurn = 'player' | 'guest' | 'offer';
export function closestSeat(x: number, occupied = -1): 0 | 1 {
  const free = [0, 1].filter(i => i !== occupied);
  return free.reduce((a, b) => Math.abs(x - SEATS[a]) <= Math.abs(x - SEATS[b]) ? a : b) as 0 | 1;
}
/** alone, every piece is yours; shared, you take turns and the last piece is offered across the table */
export const mealTurn = (piece: number, shared: boolean, n = 3): MealTurn => !shared ? 'player' : piece >= n - 1 ? 'offer' : piece % 2 === 0 ? 'player' : 'guest';
const between = (a: Vec, b: Vec, t: number): Vec => { const u = easeInOut(clamp01(t)); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(Math.PI * u) * 2.5]; };
export function biteMotion(t: number, turn: MealTurn, source: Vec, mouth: Vec, guestMouth: Vec, handoff: Vec) {
  const offering = turn === 'offer';
  const liftAt = offering ? 1.6 : .34, biteAt = offering ? 2.2 : 1.1, end = offering ? 2.72 : 1.67;
  let food: Vec;
  if (offering && t < 1.6) food = t < .32 ? source : between(source, handoff, (t - .32) / .7);
  else food = between(offering ? handoff : source, turn === 'player' ? mouth : guestMouth, (t - liftAt) / (biteAt - liftAt));
  const playerHand = turn === 'player' || offering && t < 1.4 ? food : null;
  const guestHand = turn === 'guest' || offering && t > .95 ? food : null;
  return { food, playerHand, guestHand, bite: clamp01((t - biteAt) / .25), done: t >= end, stage: t < .32 ? 'reach' : t < biteAt ? offering ? 'offer' : 'lift' : 'bite' };
}
