import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { teamMatchResult, computePresses } from '../engine/matchPlay';
import { computeSkins } from '../engine/skins';
import type { Scores, Handicaps } from '../engine/matchPlay';
import type { HoleInfo } from '../data/aspetuck';
import { Colors } from '../theme/colors';

interface RoundLike {
  gameStyle: 'matchplay' | 'skins';
  players: { id: number; initials: string }[];
  teams: { id: number; playerIds: number[] }[];
  stakes: { front: number; back: number; total: number };
  autoPress: boolean;
  pressAt: number;
  skinValue: number;
}

interface ScoreboardPanelProps {
  round: RoundLike;
  scores: Scores;
  hcps: Handicaps;
  currentHole: number;
  holes: HoleInfo[];
}

export function ScoreboardPanel({ round, scores, hcps, currentHole, holes }: ScoreboardPanelProps) {
  const isMatchPlay = round.gameStyle === 'matchplay';
  const holesPlayed = currentHole - 1;

  if (isMatchPlay) {
    const t1 = round.teams[0].playerIds;
    const t2 = round.teams[1].playerIds;
    const getName = (ids: number[]) =>
      ids.map((id) => round.players.find((p) => p.id === id)?.initials ?? '?').join('/');

    const front = holesPlayed >= 1 ? teamMatchResult(scores, hcps, t1, t2, 1, Math.min(holesPlayed, 9), holes) : null;
    const back = holesPlayed >= 10 ? teamMatchResult(scores, hcps, t1, t2, 10, Math.min(holesPlayed, 18), holes) : null;
    const total = holesPlayed >= 1 ? teamMatchResult(scores, hcps, t1, t2, 1, Math.min(holesPlayed, 18), holes) : null;

    const frontPresses = round.autoPress && holesPlayed >= 1 ? computePresses(scores, hcps, t1, t2, 1, 9, round.stakes.front, round.pressAt, holes) : [];
    const backPresses = round.autoPress && holesPlayed >= 10 ? computePresses(scores, hcps, t1, t2, 10, 18, round.stakes.back, round.pressAt, holes) : [];
    const activePresses = [...frontPresses, ...backPresses].filter((p) => p.startHole <= holesPlayed);

    let dollarBar: { net: number; leader: string | null } | null = null;
    if (total) {
      const fAmt = front ? Math.sign(front.result) * round.stakes.front : 0;
      const bAmt = back ? Math.sign(back.result) * round.stakes.back : 0;
      const tAmt = total ? Math.sign(total.result) * round.stakes.total : 0;
      let pAmt = 0;
      activePresses.forEach((p) => {
        const pr = teamMatchResult(scores, hcps, t1, t2, p.startHole, Math.min(holesPlayed, p.endHole), holes);
        pAmt += Math.sign(pr.result) * p.stake;
      });
      const net = fAmt + bAmt + tAmt + pAmt;
      dollarBar = { net, leader: net > 0 ? getName(t1) : net < 0 ? getName(t2) : null };
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
      const rem = maxHoles - hp;
      const dormie = Math.abs(result) > 0 && Math.abs(result) >= rem && rem > 0;
      return (
        <View style={[styles.badge, { flex: 1 }]}>
          <Text style={styles.badgeLabel}>{label}</Text>
          <Text
            style={[
              styles.badgeValue,
              result === 0 && styles.badgeTied,
              result > 0 && styles.badgeUp,
              result < 0 && styles.badgeDown,
            ]}
          >
            {result === 0 ? 'AS' : result > 0 ? `${result}↑` : `${Math.abs(result)}↓`}
          </Text>
          {dormie && <Text style={styles.dormie}>DORMIE</Text>}
          {!dormie && (
            <Text style={styles.badgeSub}>
              {result === 0 ? 'tied' : result > 0 ? getName(t1) : getName(t2)}
            </Text>
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
                dollarBar.net === 0 && styles.dollarEven,
                dollarBar.net > 0 && styles.dollarUp,
                dollarBar.net < 0 && styles.dollarDown,
              ]}
            >
              {dollarBar.net === 0 ? 'EVEN' : `${dollarBar.leader} +$${Math.abs(dollarBar.net)}`}
            </Text>
          )}
        </View>
        <View style={styles.badgesRow}>
          <Badge data={front} label="FRONT" maxHoles={9} />
          <View style={styles.divider} />
          <Badge data={back} label="BACK" maxHoles={9} />
          <View style={styles.divider} />
          <Badge data={total} label="TOTAL" maxHoles={18} />
        </View>
        {activePresses.length > 0 && (
          <View style={styles.pressesSection}>
            {activePresses.map((p, i) => {
              const pr = teamMatchResult(scores, hcps, t1, t2, p.startHole, Math.min(holesPlayed, p.endHole), holes);
              return (
                <View key={i} style={styles.pressRow}>
                  <Text style={styles.pressLabel}>🔁 Press H{p.startHole}–{p.endHole} (${p.stake})</Text>
                  <Text style={[styles.pressResult, pr.result === 0 && styles.dollarEven, pr.result > 0 && styles.dollarUp, pr.result < 0 && styles.dollarDown]}>
                    {pr.result === 0 ? 'AS' : pr.result > 0 ? `${getName(t1)} +${pr.result}` : `${getName(t2)} +${Math.abs(pr.result)}`}
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
  const hotPot = (currentCarry + 1) * round.skinValue * round.players.length;

  return (
    <View style={styles.skinsRoot}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchTitle}>SKINS · THRU {holesPlayed}</Text>
        {currentCarry > 0 && (
          <View style={styles.hotPotBadge}>
            <Text style={styles.hotPotText}>🔥 ${hotPot} ON THIS HOLE</Text>
          </View>
        )}
      </View>
      <View style={styles.skinsRow}>
        {round.players.map((p) => (
          <View key={p.id} style={styles.skinCell}>
            <Text style={styles.skinInitials}>{p.initials}</Text>
            <Text style={[styles.skinCount, skinsWon[p.id] > 0 && styles.skinCountGold]}>{skinsWon[p.id]}</Text>
            <Text style={styles.skinDollar}>${skinsWon[p.id] * round.skinValue * round.players.length}</Text>
          </View>
        ))}
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
  carryText: { marginTop: 6, color: '#5a8a6a', fontSize: 10, fontStyle: 'italic', textAlign: 'center' },
});
