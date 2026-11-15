export const DRAFT_KEY = 'ink-street-draft-v1';
export const SAVE_KEY = 'ink-street-v2';
let resetting = false;
export type SavedGame = { version: 2; story: Record<string, any>; art: Record<string, any>; home: Record<string, any>; world: { x: number; y: number; inside: boolean; fair: boolean; tau: number } };
export function readSave(): SavedGame | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s?.version !== 2 || !s.story || !s.art || !s.home || !s.world) return null;
    if (![s.world.x, s.world.y, s.world.tau, s.story.day].every(Number.isFinite) || s.story.day < 1) return null;
    return s;
  } catch { return null; }
}
export function writeSave(save: SavedGame) { if (resetting) return false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; } }

/** Stop unload/visibility autosaves before removing the old journey. */
export function resetSave() {
  resetting = true;
  try { localStorage.removeItem(SAVE_KEY); try { localStorage.removeItem(DRAFT_KEY); } catch {} return true; }
  catch { resetting = false; return false; }
}
