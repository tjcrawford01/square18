import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { teamMatchResult, computePresses } from '../engine/matchPlay';
import { computeSkins } from '../engine/skins';
import { computeSideBetNet } from '../engine/sideBets';
import { countBirdies, computeBirdiePoolResult } from '../engine/birdies';
import type { Scores, Handicaps } from '../engine/matchPlay';
import type { HoleInfo } from '../types/course';
import { Colors } from '../theme/colors';

interface SideBetLike {
  id: number;
  type: string;
  hole: number | null;
  amount: number;
}

interface RoundLike {
  gameStyle: 'matchplay' | 'skins';
  players: { id: number; name: string; initials?: string }[];
  teams: { id: number; playerIds: number[] }[];
  stakes: { front: number; back: number; total: number };
  autoPress: boolean;
  pressAt: number;
  skinValue: number;
  sideBets?: SideBetLike[];
}

interface ScoreboardPanelProps {
  round: RoundLike;
  scores: Scores;
  hcps: Handicaps;
  currentHole: number;
  holes: HoleInfo[];
  firstHole?: number;
  lastHole?: number;
  sideBetWinners?: Record<number, number>;
}

export function ScoreboardPanel({ round, scores, hcps, currentHole, holes, firstHole = 1, lastHole = 18, sideBetWinners = {} }: ScoreboardPanelProps) {
  const isMatchPlay = round.gameStyle === 'matchplay';
  const holesPlayed = currentHole - firstHole;
  const holesPlayedSoFar = holes.filter((h) => h.hole >= firstHole && h.hole <= currentHole);
  const is2v2 = round.gameStyle === 'matchplay' && round.players.length === 4 &&
    round.teams?.[0]?.playerIds?.length === 2 && round.teams?.[1]?.playerIds?.length === 2;
  const sideBetNet = round.sideBets?.length
    ? computeSideBetNet(round.sideBets, sideBetWinners, round.players, is2v2 ? round.teams : undefined)
    : null;
  const birdiePool = round.sideBets?.find((sb) => sb.type === 'birdie');
  const birdieCounts = birdiePool && holesPlayed >= 1
    ? countBirdies(scores, round.players.map((p) => p.id), holesPlayedSoFar)
    : null;
  const birdiePoolResult = birdiePool && birdieCounts
    ? computeBirdiePoolResult(birdieCounts, round.players.map((p) => p.id), birdiePool.amount, is2v2 ? round.teams : undefined)
    : null;

  if (isMatchPlay) {
    const t1 = round.teams[0].playerIds;
    const t2 = round.teams[1].playerIds;
    const getFirstName = (id: number) =>
      round.players.find((p) => p.id === id)?.name?.split(' ')[0] ?? '?';
    const getTeamNames = (ids: number[]) =>
      ids.map((id) => getFirstName(id)).join('/');

    const frontStart = Math.max(firstHole, 1);
    const frontEnd = Math.min(9, lastHole);
    const backStart = Math.max(firstHole, 10);
    const backEnd = Math.min(18, lastHole);
    const front = frontEnd >= frontStart && holesPlayed >= 1 ? teamMatchResult(scores, hcps, t1, t2, frontStart, Math.min(firstHole + holesPlayed, frontEnd), holes) : null;
    const back = backEnd >= backStart && holesPlayed >= (backStart - firstHole + 1) ? teamMatchResult(scores, hcps, t1, t2, backStart, Math.min(firstHole + holesPlayed, backEnd), holes) : null;
    const total = holesPlayed >= 1 ? teamMatchResult(scores, hcps, t1, t2, firstHole, Math.min(firstHole + holesPlayed, lastHole), holes) : null;

    const frontPresses = round.autoPress && frontEnd >= frontStart ? computePresses(scores, hcps, t1, t2, frontStart, frontEnd, round.stakes.front, round.pressAt, holes) : [];
    const backPresses = round.autoPress && backEnd >= backStart ? computePresses(scores, hcps, t1, t2, backStart, backEnd, round.stakes.back, round.pressAt, holes) : [];
    const activePresses = [...frontPresses, ...backPresses].filter((p) => p.startHole <= firstHole + holesPlayed);

    let dollarBar: { net: number; leader: string | null } | null = null;
    if (total) {
      const oppMult = (r: number) => (is2v2 ? (r > 0 ? t2.length : r < 0 ? t1.length : 1) : 1);
      const fAmt = front ? Math.sign(front.result) * round.stakes.front * oppMult(front.result) : 0;
      const bAmt = back ? Math.sign(back.result) * round.stakes.back * oppMult(back.result) : 0;
      const tAmt = total ? Math.sign(total.result) * round.stakes.total * oppMult(total.result) : 0;
      let pAmt = 0;
      activePresses.forEach((p) => {
        const pr = teamMatchResult(scores, hcps, t1, t2, p.startHole, Math.min(firstHole + holesPlayed, p.endHole), holes);
        pAmt += Math.sign(pr.result) * p.stake * oppMult(pr.result);
      });
      let sbAmt = 0;
      if (sideBetNet) {
        // Side bets are zero-sum (t1Net + t2Net = 0), so use t1Net only — t1Net - t2Net would double-count
        sbAmt = t1.reduce((sum, id) => sum + (sideBetNet[id] ?? 0), 0);
      }
      if (birdiePoolResult) {
        sbAmt += t1.reduce((sum, id) => sum + (birdiePoolResult.netPerPlayer[id] ?? 0), 0);
      }
      const net = fAmt + bAmt + tAmt + pAmt + sbAmt;
      dollarBar = { net, leader: net > 0 ? getTeamNames(t1) : net < 0 ? getTeamNames(t2) : null };
    }

    function getStatusLabel(result: number, holesPlayed: number, maxHoles: number): string {
      if (result === 0) return 'tied';
      const rem = maxHoles - holesPlayed;
      if (rem <= 0) return result > 0 ? getTeamNames(t1) : getTeamNames(t2);
      const lead = Math.abs(result);
      if (lead > rem) return 'CLOSED';   // impossible to tie or win
      if (lead === rem) return 'DORMIE'; // best opponent can do is tie
      return result > 0 ? getTeamNames(t1) : getTeamNames(t2);
    }

    function Badge({
      data,
      label,
      maxHoles,
    }: {
      data: { result: number; holesPlayed: number } | null;
      label: string;
      maxHoles: number;
    }) {
      if (!data) return <View style={styles.badge} />;
      const { result, holesPlayed: hp } = data;
      const statusLabel = getStatusLabel(result, hp, maxHoles);
      const isDormieOrClosed = statusLabel === 'DORMIE' || statusLabel === 'CLOSED';
      return (
        <View style={[styles.badge, { flex: 1 }]}>
          <Text style={styles.badgeLabel}>{label}</Text>
          <Text
            style={[
              styles.badgeValue,
              result === 0 ? styles.badgeTied : styles.badgeUp,
            ]}
          >
            {result === 0 ? 'AS' : `${Math.abs(result)}↑`}
          </Text>
          {isDormieOrClosed ? (
            <Text style={styles.dormie}>{statusLabel}</Text>
          ) : (
            <Text style={styles.badgeSub}>{statusLabel}</Text>
          )}
        </View>
      );
    }

    return (
      <View style={styles.matchRoot}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchTitle}>MATCH STATUS · THRU {holesPlayed}</Text>
          {dollarBar && (
            <Text
              style={[
                styles.matchDollar,
                dollarBar.net === 0 ? styles.dollarEven : styles.dollarUp,
              ]}
            >
              {dollarBar.net === 0 ? 'EVEN' : `${dollarBar.leader} +$${Math.round(Math.abs(dollarBar.net))}`}
            </Text>
          )}
        </View>
        <View style={styles.badgesRow}>
          {lastHole - firstHole + 1 === 9 ? (
            <Badge data={total} label="9" maxHoles={9} />
          ) : (
            <>
              <Badge data={front} label="FRONT" maxHoles={9} />
              <View style={styles.divider} />
              <Badge data={back} label="BACK" maxHoles={9} />
              <View style={styles.divider} />
              <Badge data={total} label="TOTAL" maxHoles={18} />
            </>
          )}
        </View>
        {activePresses.length > 0 && (
          <View style={styles.pressesSection}>
            {activePresses.map((p, i) => {
              const pr = teamMatchResult(scores, hcps, t1, t2, p.startHole, Math.min(firstHole + holesPlayed, p.endHole), holes);
              const pressMaxHoles = p.endHole - p.startHole + 1;
              const pressStatus = getStatusLabel(pr.result, pr.holesPlayed, pressMaxHoles);
              return (
                <View key={i} style={styles.pressRow}>
                  <Text style={styles.pressLabel}>🔁 Press H{p.startHole}–{p.endHole} (${Math.round(p.stake)})</Text>
                  <Text style={[styles.pressResult, pr.result === 0 ? styles.dollarEven : styles.dollarUp]}>
                    {pr.result === 0 ? 'AS' : `${Math.abs(pr.result)}↑ ${pressStatus}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  const skinResults = computeSkins(scores, hcps, round.players.map((p) => p.id), holes);
  const skinsWon: Record<number, number> = {};
  round.players.forEach((p) => (skinsWon[p.id] = 0));
  skinResults.forEach((r) => {
    if (r.winner != null) skinsWon[r.winner] = (skinsWon[r.winner] ?? 0) + (r.skinsWon ?? 0);
  });
  const currentCarry = skinResults.find((r) => r.hole === currentHole)?.carryover ?? 0;
  const perSkin = round.skinValue * Math.max(0, round.players.length - 1);
  const hotPot = (currentCarry + 1) * perSkin;

  return (
    <View style={styles.skinsRoot}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchTitle}>SKINS · THRU {holesPlayed}</Text>
        {currentCarry > 0 && (
          <View style={styles.hotPotBadge}>
            <Text style={styles.hotPotText}>🔥 ${Math.round(hotPot)} ON THIS HOLE</Text>
          </View>
        )}
      </View>
      <View style={styles.skinsRow}>
        {round.players.map((p) => {
          const firstName = p.name?.split(' ')[0] ?? p.initials ?? '?';
          const skinAmt = skinsWon[p.id] * perSkin;
          const sbAmt = sideBetNet ? (sideBetNet[p.id] ?? 0) : 0;
          const totalAmt = Math.round(skinAmt + sbAmt);
          const allTotals = round.players.map((q) => skinsWon[q.id] * perSkin + (sideBetNet ? (sideBetNet[q.id] ?? 0) : 0));
          const maxSkinAmt = Math.max(...allTotals);
          const minSkinAmt = Math.min(...allTotals);
          const isAhead = totalAmt === maxSkinAmt && maxSkinAmt > minSkinAmt;
          const isBehind = totalAmt === minSkinAmt && maxSkinAmt > minSkinAmt;
          return (
          <View key={p.id} style={styles.skinCell}>
            <Text style={styles.skinInitials}>{firstName}</Text>
            <Text style={[styles.skinCount, skinsWon[p.id] > 0 && styles.skinCountGold]}>{skinsWon[p.id]}</Text>
            <Text style={[
              styles.skinDollar,
              isAhead && styles.skinDollarUp,
              isBehind && styles.skinDollarDown,
            ]}>${totalAmt}</Text>
          </View>
        );})}
      </View>
      {currentCarry > 0 && (
        <Text style={styles.carryText}>
          {currentCarry} skin{currentCarry > 1 ? 's' : ''} carrying in
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  matchRoot: {
    backgroundColor: '#0e1a12',
    borderTopWidth: 2,
    borderTopColor: '#243a2c',
    paddingVertical: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchTitle: {
    color: '#5a8a6a',
    fontSize: 9,
    letterSpacing: 2,
  },
  matchDollar: { fontSize: 12, fontWeight: '700' },
  dollarEven: { color: Colors.gray },
  dollarUp: { color: '#7dd4a0' },
  dollarDown: { color: '#ff9090' },
  badgesRow: { flexDirection: 'row', gap: 4 },
  badge: { flex: 1, alignItems: 'center' },
  badgeLabel: { color: '#5a8a6a', fontSize: 9, letterSpacing: 1 },
  badgeValue: { fontSize: 22, fontWeight: '700', lineHeight: 22 },
  badgeTied: { color: '#8a9e90' },
  badgeUp: { color: '#7dd4a0' },
  badgeDown: { color: '#ff9090' },
  dormie: { fontSize: 8, color: Colors.gold, fontWeight: '700' },
  badgeSub: { fontSize: 9, color: '#5a8a6a' },
  divider: { width: 1, backgroundColor: '#243a2c' },
  pressesSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#243a2c', paddingTop: 6 },
  pressRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 10 },
  pressLabel: { color: '#5a8a6a', fontSize: 10 },
  pressResult: { fontSize: 10, fontWeight: '700' },
  skinsRoot: {
    backgroundColor: '#0e1a12',
    borderTopWidth: 2,
    borderTopColor: '#243a2c',
    paddingVertical: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  hotPotBadge: { backgroundColor: Colors.red, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  hotPotText: { color: Colors.cream, fontSize: 10, fontWeight: '700' },
  skinsRow: { flexDirection: 'row', gap: 6 },
  skinCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a2e22',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skinInitials: { fontSize: 9, color: '#5a8a6a' },
  skinCount: { fontSize: 20, fontWeight: '700', color: '#5a8a6a' },
  skinCountGold: { color: Colors.gold },
  skinDollar: { fontSize: 9, color: '#5a8a6a' },
  skinDollarUp: { color: '#7dd4a0' },
  skinDollarDown: { color: '#ff9090' },
  carryText: { marginTop: 6, color: '#5a8a6a', fontSize: 10, fontStyle: 'italic', textAlign: 'center' },
});
