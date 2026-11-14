export const SAVE_KEY = 'ink-street-v2';
export type SavedGame = { version: 2; story: Record<string, any>; art: Record<string, any>; home: Record<string, any>; world: { x: number; y: number; inside: boolean; fair: boolean; tau: number } };
export function readSave(): SavedGame | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s?.version !== 2 || !s.story || !s.art || !s.home || !s.world) return null;
    if (![s.world.x, s.world.y, s.world.tau, s.story.day].every(Number.isFinite) || s.story.day < 1) return null;
    return s;
  } catch { return null; }
}
export function writeSave(save: SavedGame) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; } }
