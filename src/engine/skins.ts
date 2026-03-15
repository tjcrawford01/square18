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

/**
 * Compute net skins settlement per player using pairwise differentials (same as 5-3-1).
 * For every pair of players, the one with fewer skins pays the one with more skins:
 * payment = (skinsA - skinsB) × stake (positive = B pays A, negative = A pays B).
 * stake = per-player per-hole amount as entered (e.g. $5 with 4 players → each skin diff = $5).
 * Unresolved carry-overs: excluded from counts (no winner), stakes effectively returned.
 */
export function computeSkinsNet(
  skinsWon: Record<number, number>,
  playerIds: number[],
  stake: number,
): Record<number, number> {
  const netPerPlayer: Record<number, number> = {};
  playerIds.forEach((id) => (netPerPlayer[id] = 0));

  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const idA = playerIds[i]!;
      const idB = playerIds[j]!;
      const skinsA = skinsWon[idA] ?? 0;
      const skinsB = skinsWon[idB] ?? 0;
      const diff = skinsA - skinsB;
      const amt = Math.round(Math.abs(diff) * stake);
      console.log(
        `[Skins pairwise] ${idA} vs ${idB}: ${skinsA} - ${skinsB} = ${diff} skins, stake=$${stake}, amt=$${amt}`
      );
      if (diff > 0) {
        netPerPlayer[idA] = (netPerPlayer[idA] ?? 0) + amt;
        netPerPlayer[idB] = (netPerPlayer[idB] ?? 0) - amt;
      } else if (diff < 0) {
        netPerPlayer[idB] = (netPerPlayer[idB] ?? 0) + amt;
        netPerPlayer[idA] = (netPerPlayer[idA] ?? 0) - amt;
      }
    }
  }

  return netPerPlayer;
}

