import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Highlight } from '../engine/highlights';

const GOLD = '#b8953a';
const WHITE = '#FFFFFF';
const RED = '#8b2020';
const DIVIDER = '#333333';
const WATERMARK = '#555555';

interface PlayerLike {
  id: number;
  name: string;
}

export interface ShareableResultsCardProps {
  date: string;
  courseName: string;
  players: PlayerLike[];
  netPerPlayer: Record<number, number>;
  gameStyle: string;
  highlights: (Highlight | null)[];
}

export function ShareableResultsCard({
  date,
  courseName,
  players,
  netPerPlayer,
  gameStyle,
  highlights,
}: ShareableResultsCardProps) {
  const sortedPlayers = [...players].sort(
    (a, b) => (netPerPlayer[b.id] ?? 0) - (netPerPlayer[a.id] ?? 0)
  );
  const displayedHighlights = highlights.filter((h): h is Highlight => h != null).slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>SQUARE18</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.courseName}>{courseName}</Text>

      <View style={styles.divider} />

      {/* Match Results */}
      <Text style={styles.sectionLabel}>MATCH RESULTS</Text>
      {sortedPlayers.map((p) => {
        const net = netPerPlayer[p.id] ?? 0;
        const isWinner = net > 0;
        const isLoser = net < 0;
        return (
          <View key={p.id} style={[styles.resultRow, isWinner && styles.winnerRow]}>
            <Text style={styles.playerName}>{p.name}</Text>
            <Text style={[styles.netAmt, isWinner && styles.netPositive, isLoser && styles.netNegative]}>
              {net >= 0 ? '+' : ''}{net}
            </Text>
          </View>
        );
      })}

      {displayedHighlights.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>HIGHLIGHTS</Text>
          {displayedHighlights.map((h, i) => (
            <View key={i} style={styles.highlightCard}>
              <Text style={styles.highlightHead}>{h.label}</Text>
              <Text style={styles.highlightDetail}>{h.detail}</Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.divider} />
      <Text style={styles.watermark}>via Square18</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 1080,
    height: 1080,
    backgroundColor: '#000000',
    padding: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 2,
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
    letterSpacing: 1,
  },
  courseName: {
    fontSize: 32,
    fontWeight: '700',
    color: WHITE,
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    height: 2,
    backgroundColor: DIVIDER,
    marginVertical: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 0,
  },
  winnerRow: {
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
  },
  playerName: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
  },
  netAmt: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
  },
  netPositive: {
    color: GOLD,
  },
  netNegative: {
    color: RED,
  },
  highlightCard: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  highlightHead: {
    fontSize: 20,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 4,
  },
  highlightDetail: {
    fontSize: 16,
    color: WHITE,
    opacity: 0.9,
  },
  watermark: {
    fontSize: 12,
    color: WATERMARK,
    textAlign: 'center',
    marginTop: 8,
  },
});
