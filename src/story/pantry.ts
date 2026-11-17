// What is in the icebox, and what can be made of it.
//
// The rules are written to never stop you:
//  · rice, vinegar, soy and ginger are staples: always there, never counted;
//  · three small recipes each need one kind of fresh thing, so almost any shelf can feed you;
//  · dishes you cooked and put away count as dinner too — cooking ahead is a choice, not a chore;
//  · the greengrocer takes no money (neighbours keep a different kind of account);
//  · and if a morning ever finds nothing to cook and nothing put away, a neighbour leaves eggs
//    at your door.
// The only limit is the size of the icebox: each thing has its own outlined places on a shelf.

export type Item = 'somon' | 'yumurta' | 'salatalık' | 'mandalina';
export type Topping = 'somon' | 'tamago' | 'kyuri';
export type Pantry = Record<Item, number>;

export const ITEMS: Record<Item, { name: string; spots: number }> = {
  somon: { name: 'Somon', spots: 2 },
  yumurta: { name: 'Yumurta', spots: 4 },
  'salatalık': { name: 'Salatalık', spots: 2 },
  mandalina: { name: 'Mandalina', spots: 2 },
};
export const ITEM_IDS = Object.keys(ITEMS) as Item[];

export const RECIPES: { id: Topping; name: string; needs: Partial<Record<Item, number>> }[] = [
  { id: 'somon', name: 'Somon nigiri', needs: { somon: 1 } },
  { id: 'tamago', name: 'Tamago nigiri', needs: { yumurta: 2 } },
  { id: 'kyuri', name: 'Salatalıklı nigiri', needs: { 'salatalık': 1 } },
];
/** a batch is six pieces (a full geta); the dish shelf holds two lacquer boxes of six */
export const PIECES = 6, DISH_BOXES = 2, BUNDLE = 4;
export type Box = Topping[];
export const START: Pantry = { somon: 1, yumurta: 2, 'salatalık': 0, mandalina: 0 };

export function normalize(p: Partial<Record<string, unknown>> | undefined | null): Pantry {
  const out = { ...START };
  if (p && typeof p === 'object') for (const id of ITEM_IDS) { const n = Number(p[id]); if (Number.isFinite(n)) out[id] = Math.max(0, Math.min(ITEMS[id].spots, Math.floor(n))); }
  return out;
}
const isTopping = (x: unknown): x is Topping => RECIPES.some(r => r.id === x);
/** boxes of dishes; an older save kept a flat list of pieces: pack those into boxes */
export function normalizeDishes(d: unknown): Box[] {
  if (!Array.isArray(d)) return [];
  const boxes: Box[] = d.some(Array.isArray) ? d.filter(Array.isArray).map(b => b.filter(isTopping).slice(0, PIECES)) : [];
  if (!d.some(Array.isArray)) { const flat = d.filter(isTopping); for (let i = 0; i < flat.length; i += PIECES) boxes.push(flat.slice(i, i + PIECES)); }
  return boxes.filter(b => b.length).slice(0, DISH_BOXES);
}
export const normalizeBasket = (b: unknown): Item[] => Array.isArray(b) ? b.filter((x): x is Item => ITEM_IDS.includes(x as Item)).slice(0, BUNDLE) : [];

export const recipe = (id: Topping) => RECIPES.find(r => r.id === id)!;
/** the recipe an ingredient belongs to (mandarins are for dessert: none) */
export const recipeFor = (item: Item) => RECIPES.find(r => (r.needs[item] ?? 0) > 0) ?? null;
export const canMake = (p: Pantry, id: Topping) => Object.entries(recipe(id).needs).every(([k, n]) => p[k as Item] >= (n ?? 0));
export const makeable = (p: Pantry) => RECIPES.filter(r => canMake(p, r.id)).map(r => r.id);
export function use(p: Pantry, id: Topping): Pantry {
  const out = { ...p };
  for (const [k, n] of Object.entries(recipe(id).needs)) out[k as Item] = Math.max(0, out[k as Item] - (n ?? 0));
  return out;
}
/** free places for one thing */
export const room = (p: Pantry, item: Item) => ITEMS[item].spots - p[item];
/** put groceries away; what does not fit stays in the bundle */
export function store(p: Pantry, items: Item[]): { pantry: Pantry; left: Item[] } {
  const out = { ...p }, left: Item[] = [];
  for (const it of items) if (out[it] < ITEMS[it].spots) out[it]++; else left.push(it);
  return { pantry: out, left };
}
/** things with no place filled: the shopping list writes itself from the dashed outlines */
export const missing = (p: Pantry) => ITEM_IDS.filter(id => p[id] === 0);
/** can tonight's dinner happen from what is at home (cooked or put away)? */
export const canFeed = (p: Pantry, dishes: Box[]) => dishes.some(b => b.length > 0) || makeable(p).length > 0;
/** the safety net: a morning with nothing to cook and nothing put away finds eggs at the door */
export function morningGift(p: Pantry, dishes: Box[]): { pantry: Pantry; gift: boolean } {
  if (canFeed(p, dishes)) return { pantry: p, gift: false };
  return { pantry: { ...p, yumurta: Math.min(ITEMS.yumurta.spots, p.yumurta + 2) }, gift: true };
}
/** what the greengrocer lets you carry: up to a bundle, and never more than the icebox can hold */
export function bundleFits(p: Pantry, picked: Item[], next: Item) {
  if (picked.length >= BUNDLE) return false;
  return picked.filter(x => x === next).length < room(p, next);
}

/** how each topping is drawn, wherever it appears (icebox, board, plate) */
export const LOOK: Record<Topping, { fill: string; line: string; band?: string }> = {
  somon: { fill: '#ec8c5f', line: '#fff3e6' },
  tamago: { fill: '#f2c94c', line: '#fbe7a6', band: '#2f3a2c' },
  kyuri: { fill: '#8fbf5a', line: '#e3f0cf' },
};
