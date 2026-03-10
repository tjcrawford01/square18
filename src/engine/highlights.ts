/**
 * Highlight computation for shareable results card.
 * Returns { label, detail, emoji } or null if not computable.
 */

import type { HoleInfo } from '../types/course';
import { strokesOnHole } from './handicap';
import { computeSkins } from './skins';
import { computeFiveThreeOne } from './fiveThreeOne';
import { teamMatchResult } from './matchPlay';
import type { SkinResult } from './skins';

export interface Highlight {
  label: string;
  detail: string;
  emoji: string;
}

interface PlayerLike {
  id: number;
  name: string;
}

type Scores = Record<number, Record<number, number>>;
type Handicaps = Record<number, number>;

/** Best gross score relative to par. Eagle > Birdie. */
export function getBiggestMoment(
  players: PlayerLike[],
  scores: Scores,
  holes: HoleInfo[],
): Highlight | null {
  let best: { player: PlayerLike; hole: number; relToPar: number; desc: string } | null = null;
  for (const p of players) {
    const pScores = scores[p.id];
    if (!pScores) continue;
    for (const hd of holes) {
      const g = pScores[hd.hole];
      if (g == null) continue;
      const relToPar = hd.par - g;
      if (relToPar < 0) continue; // bogey or worse
      const desc = relToPar === 2 ? 'Eagle' : relToPar === 1 ? 'Birdie' : '';
      if (!desc) continue;
      if (!best || relToPar > best.relToPar) {
        best = { player: p, hole: hd.hole, relToPar, desc };
      }
    }
  }
  if (!best) return null;
  return {
    label: `Biggest Moment ${best.relToPar === 2 ? '🦅' : '🐦'}`,
    detail: `${best.player.name} • ${best.desc} on ${best.hole}`,
    emoji: best.relToPar === 2 ? '🦅' : '🐦',
  };
}

/** Worst adjusted score = gross - par - strokes on that hole. */
export function getBiggestChoke(
  players: PlayerLike[],
  scores: Scores,
  holes: HoleInfo[],
  hcps: Handicaps,
): Highlight | null {
  let worst: { player: PlayerLike; hole: number; adjusted: number } | null = null;
  for (const p of players) {
    const pScores = scores[p.id];
    const phcp = hcps[p.id] ?? 0;
    if (!pScores) continue;
    for (const hd of holes) {
      const g = pScores[hd.hole];
      if (g == null) continue;
      const strokes = strokesOnHole(phcp, hd.si);
      const adjusted = g - hd.par - strokes;
      if (adjusted <= 0) continue;
      if (!worst || adjusted > worst.adjusted) {
        worst = { player: p, hole: hd.hole, adjusted };
      }
    }
  }
  if (!worst) return null;
  return {
    label: 'Biggest Choke 💀',
    detail: `${worst.player.name} • +${worst.adjusted} on ${worst.hole}`,
    emoji: '💀',
  };
}

/** Hole where match lead swung most, or Skins biggest win, or Wolf/5-3-1 points swing. */
export function getMomentumSwing(
  players: PlayerLike[],
  scores: Scores,
  holes: HoleInfo[],
  gameStyle: string,
  opts?: {
    t1ids?: number[];
    t2ids?: number[];
    hcps?: Handicaps;
    skinResults?: SkinResult[];
    five31PointsByHole?: Record<number, number[]>;
  },
): Highlight | null {
  if (gameStyle === 'matchplay' && opts?.t1ids && opts?.t2ids && opts?.hcps) {
    return getMomentumSwingMatch(scores, opts.hcps, opts.t1ids, opts.t2ids, holes, players);
  }
  if (gameStyle === 'skins' && opts?.skinResults) {
    const skinResults = opts.skinResults;
    const best = skinResults
      .filter((r) => r.winner != null && (r.skinsWon ?? 0) > 0)
      .sort((a, b) => (b.skinsWon ?? 0) - (a.skinsWon ?? 0))[0];
    if (!best) return null;
    const winner = players.find((p) => p.id === best.winner);
    if (!winner) return null;
    return {
      label: 'Momentum Swing ⚡',
      detail: `${winner.name} took the lead on ${best.hole}`,
      emoji: '⚡',
    };
  }
  if (gameStyle === 'fivethreeone') {
    // For 5-3-1: find hole with biggest point spread (e.g. 5 vs 1)
    const hcps: Handicaps = {};
    players.forEach((p) => (hcps[p.id] = 0));
    const ids = players.map((p) => p.id);
    const f531 = computeFiveThreeOne(scores, hcps, ids, holes);
    let best: { player: PlayerLike; hole: number; swing: number } | null = null;
    const cumul: Record<number, number> = {};
    ids.forEach((id) => (cumul[id] = 0));
    for (let h = 1; h <= 18; h++) {
      const pts = f531.flatMap((r) => {
        const p = r.pointsByHole?.[h - 1];
        return p != null ? [{ id: r.playerId, pts: p }] : [];
      });
      if (pts.length < 3) continue;
      const maxPts = Math.max(...pts.map((x) => x.pts));
      const minPts = Math.min(...pts.map((x) => x.pts));
      const swing = maxPts - minPts;
      if (swing > 0) {
        const leader = pts.find((x) => x.pts === maxPts);
        if (leader && (!best || swing > best.swing)) {
          const player = players.find((p) => p.id === leader.id);
          if (player) best = { player, hole: h, swing };
        }
      }
    }
    if (!best) return null;
    return {
      label: 'Momentum Swing ⚡',
      detail: `${best.player.name} took the lead on ${best.hole}`,
      emoji: '⚡',
    };
  }
  // Wolf: use wolf results - biggest hole win
  if (gameStyle === 'wolf') {
    // Fallback: just pick first hole with a clear winner from skins-like logic
    const hcps: Handicaps = {};
    players.forEach((p) => (hcps[p.id] = 0));
    const skinRes = computeSkins(scores, hcps, players.map((p) => p.id), holes);
    const best = skinRes
      .filter((r) => r.winner != null && !r.tied)
      .sort((a, b) => (b.skinsWon ?? 0) - (a.skinsWon ?? 0))[0];
    if (!best) return null;
    const winner = players.find((p) => p.id === best.winner);
    if (!winner) return null;
    return {
      label: 'Momentum Swing ⚡',
      detail: `${winner.name} took the lead on ${best.hole}`,
      emoji: '⚡',
    };
  }
  return null;
}

function getMomentumSwingMatch(
  scores: Scores,
  hcps: Handicaps,
  t1ids: number[],
  t2ids: number[],
  holes: HoleInfo[],
  players: PlayerLike[],
): Highlight | null {
  let prevLead = 0;
  let maxSwing = 0;
  let swingHole = 0;
  let swingLeaderId: number | null = null;
  for (let h = 1; h <= 18; h++) {
    const hd = holes[h - 1];
    if (!hd) continue;
    const res = teamMatchResult(scores, hcps, t1ids, t2ids, h, h, holes);
    if (res.holesPlayed === 0) continue;
    const lead = res.result;
    const swing = Math.abs(lead - prevLead);
    if (swing > maxSwing && lead !== 0) {
      maxSwing = swing;
      swingHole = h;
      swingLeaderId = lead > 0 ? t1ids[0] : t2ids[0];
    }
    prevLead = lead;
  }
  if (swingHole === 0 || swingLeaderId == null) return null;
  const player = players.find((p) => p.id === swingLeaderId);
  if (!player) return null;
  return {
    label: 'Momentum Swing ⚡',
    detail: `${player.name} took the lead on ${swingHole}`,
    emoji: '⚡',
  };
}
