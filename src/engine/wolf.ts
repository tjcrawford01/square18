/**
 * Wolf game mode engine.
 * Hole-by-hole betting: Wolf picks partner or goes Lone/Blind Wolf.
 * Uses net scores (handicap strokes per hole).
 */

import type { HoleInfo } from '../types/course';
import { netScore } from './handicap';

export interface WolfDecision {
  wolfIndex: number;
  partnerId: number | null;
  isBlind: boolean;
  /** Set when hole is halved (both teams same net score); no money changes hands */
  tied?: boolean;
}

export type WolfDecisions = Record<number, WolfDecision>;

export interface PlayerLike {
  id: number;
  name: string;
}

/**
 * Get the Wolf player index for a hole (0-based).
 * Rotation: P0 on H1, P1 on H2, P2 on H3, P3 on H4, P0 on H5, etc.
 */
export function getWolfIndexForHole(hole: number, playerCount: number): number {
  return (hole - 1) % playerCount;
}

/**
 * Calculate Wolf settlement: net winnings per player (positive = won, negative = lost).
 */
export function calculateWolf(
  players: PlayerLike[],
  scores: Record<number, Record<number, number>>,
  wolfDecisions: WolfDecisions,
  holes: HoleInfo[],
  hcps: Record<number, number>,
  stake: number
): Record<number, number> {
  const netPerPlayer: Record<number, number> = {};
  players.forEach((p) => (netPerPlayer[p.id] = 0));

  if (players.length < 3 || players.length > 4) return netPerPlayer;

  for (const hd of holes) {
    const h = hd.hole;
    const decision = wolfDecisions[h];
    if (!decision) continue;

    const wolfId = players[decision.wolfIndex]?.id;
    if (wolfId == null) continue;

    const nets = players.map((p) => ({
      id: p.id,
      net: scores[p.id]?.[h] != null ? netScore(scores[p.id][h], hcps[p.id] ?? 0, hd.si) : Infinity,
    }));
    if (nets.some((n) => n.net === Infinity)) continue;

    const isLoneWolf = decision.partnerId == null;
    const effectiveStake = decision.isBlind ? stake * 3 : stake;

    if (decision.tied) continue;

    if (isLoneWolf) {
      const wolfNet = nets.find((n) => n.id === wolfId)?.net ?? Infinity;
      const wolfWon = nets.every((n) => n.id === wolfId || n.net > wolfNet);
      const wolfLost = nets.some((n) => n.id !== wolfId && n.net < wolfNet);
      const others = players.filter((p) => p.id !== wolfId);

      if (wolfWon && !wolfLost) {
        netPerPlayer[wolfId] += others.length * effectiveStake;
        others.forEach((p) => (netPerPlayer[p.id] -= effectiveStake));
      } else if (wolfLost) {
        netPerPlayer[wolfId] -= others.length * effectiveStake;
        others.forEach((p) => (netPerPlayer[p.id] += effectiveStake));
      }
      // wolfTied: no money changes hands
    } else {
      const wolfTeam = [wolfId, decision.partnerId];
      const oppTeam = players.filter((p) => !wolfTeam.includes(p.id)).map((p) => p.id);
      const wolfBest = Math.min(...wolfTeam.map((id) => nets.find((n) => n.id === id)?.net ?? Infinity));
      const oppBest = Math.min(...oppTeam.map((id) => nets.find((n) => n.id === id)?.net ?? Infinity));

      if (wolfBest < oppBest) {
        wolfTeam.forEach((id) => (netPerPlayer[id] += oppTeam.length * effectiveStake));
        oppTeam.forEach((id) => (netPerPlayer[id] -= effectiveStake * 2));
      } else if (oppBest < wolfBest) {
        oppTeam.forEach((id) => (netPerPlayer[id] += wolfTeam.length * effectiveStake));
        wolfTeam.forEach((id) => (netPerPlayer[id] -= effectiveStake * oppTeam.length));
      }
      // wolfBest === oppBest: tied, no money changes hands
    }
  }

  return netPerPlayer;
}

/**
 * Check if a Wolf hole is tied (both teams have the same best net score).
 * Call when all scores are in for the hole.
 */
export function isWolfHoleTied(
  players: PlayerLike[],
  scores: Record<number, Record<number, number>>,
  decision: WolfDecision,
  holeNum: number,
  hcps: Record<number, number>,
  holeInfo: HoleInfo
): boolean {
  const wolfId = players[decision.wolfIndex]?.id;
  if (wolfId == null) return false;

  const nets = players.map((p) => ({
    id: p.id,
    net: scores[p.id]?.[holeNum] != null ? netScore(scores[p.id][holeNum], hcps[p.id] ?? 0, holeInfo.si) : Infinity,
  }));
  if (nets.some((n) => n.net === Infinity)) return false;

  const isLoneWolf = decision.partnerId == null;
  if (isLoneWolf) {
    const wolfNet = nets.find((n) => n.id === wolfId)?.net ?? Infinity;
    const wolfWon = nets.every((n) => n.id === wolfId || n.net > wolfNet);
    const wolfLost = nets.some((n) => n.id !== wolfId && n.net < wolfNet);
    return !wolfWon && !wolfLost;
  }

  const wolfTeam = [wolfId, decision.partnerId];
  const oppTeam = players.filter((p) => !wolfTeam.includes(p.id)).map((p) => p.id);
  const wolfBest = Math.min(...wolfTeam.map((id) => nets.find((n) => n.id === id)?.net ?? Infinity));
  const oppBest = Math.min(...oppTeam.map((id) => nets.find((n) => n.id === id)?.net ?? Infinity));
  return wolfBest === oppBest;
}
