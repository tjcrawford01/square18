import type { HoleInfo } from '../data/aspetuck';
import type { Scores } from './matchPlay';

export function countBirdies(scores: Scores, playerIds: number[], holes: HoleInfo[]): Record<number, number> {
  const counts: Record<number, number> = {};
  playerIds.forEach((id) => {
    counts[id] = 0;
  });
  for (let h = 1; h <= 18; h++) {
    const par = holes[h - 1].par;
    playerIds.forEach((id) => {
      const g = scores[id]?.[h];
      if (g != null && g <= par - 1) counts[id]++;
    });
  }
  return counts;
}

