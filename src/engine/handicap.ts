import type { Tee } from '../types/course';

export function courseHandicap(index: number, tee: Tee): number {
  return Math.round(index * (tee.slope / 113) + (tee.rating - 71));
}

/**
 * Convert course handicaps to playing handicaps (relative to lowest in group).
 * All game modes: full course handicap, then subtract min (lowest gets 0).
 */
export function playingHandicaps(
  courseHandicaps: Record<number, number>,
  _isMatchPlay: boolean,
): Record<number, number> {
  const ids = Object.keys(courseHandicaps).map(Number);
  const values = ids.map((id) => courseHandicaps[id]);
  const minHcp = Math.min(...values);
  const result: Record<number, number> = {};
  ids.forEach((id, i) => {
    result[id] = Math.max(0, values[i]! - minHcp);
  });
  return result;
}

/** Strokes received on a hole based on playing handicap and stroke index. */
export function strokesOnHole(playingHcp: number, si: number): number {
  if (playingHcp <= 0) return 0;
  if (playingHcp >= si) {
    return 1 + (playingHcp > 18 && playingHcp - 18 >= si ? 1 : 0);
  }
  return 0;
}

export function netScore(gross: number, playingHcp: number, si: number): number {
  return gross - strokesOnHole(playingHcp, si);
}

