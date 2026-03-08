import type { HoleInfo } from '../types/course';
import { netScore } from './handicap';
import type { Scores, Handicaps } from './matchPlay';

export interface SkinResult {
  hole: number;
  winner: number | null;
  skinsWon?: number;
  carryover: number;
  pending?: boolean;
  tied?: boolean;
}

export function computeSkins(scores: Scores, hcps: Handicaps, playerIds: number[], holes: HoleInfo[]): SkinResult[] {
  let carryover = 0;
  const results: SkinResult[] = [];
  for (let h = 1; h <= 18; h++) {
    const hd = holes[h - 1];
    const nets = playerIds.map((id) => {
      const g = scores[id]?.[h];
      return { id, net: g == null ? Infinity : netScore(g, hcps[id] || 0, hd.si) };
    });
    if (nets.some((n) => n.net === Infinity)) {
      results.push({ hole: h, winner: null, pending: true, carryover });
      continue;
    }
    const best = Math.min(...nets.map((n) => n.net));
    const winners = nets.filter((n) => n.net === best);
    if (winners.length === 1) {
      const skinsWon = 1 + carryover;
      results.push({ hole: h, winner: winners[0].id, skinsWon, carryover, pending: false, tied: false });
      carryover = 0;
    } else {
      results.push({ hole: h, winner: null, skinsWon: 0, carryover, pending: false, tied: true });
      carryover++;
    }
  }
  return results;
}

