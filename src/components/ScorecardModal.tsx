import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Share } from 'react-native';
import type { HoleInfo } from '../types/course';
import { strokesOnHole } from '../engine/handicap';
import { getWolfIndexForHole } from '../engine/wolf';
import type { WolfDecisions } from '../store/roundStore';
import { buildScorecardShareText, type ScorecardShareInput } from '../engine/settlement';
import { Colors } from '../theme/colors';

interface PlayerLike {
  id: number;
  name: string;
}

interface ScorecardModalProps {
  visible: boolean;
  onClose: () => void;
  round: { tee: string; gameStyle: string; numHoles?: string };
  courseName: string;
  players: PlayerLike[];
  scores: Record<number, Record<number, number>>;
  hcps: Record<number, number>;
  holes: HoleInfo[];
  wolfDecisions?: WolfDecisions;
}

function scoreColor(gross: number, par: number): keyof typeof Colors {
  const diff = gross - par;
  if (diff <= -2) return 'gold';
  if (diff === -1) return 'fairway';
  if (diff === 0) return 'ink';
  if (diff === 1) return 'ink';
  return 'red';
}

export function ScorecardModal({
  visible,
  onClose,
  round,
  courseName,
  players,
  scores,
  hcps,
  holes,
  wolfDecisions,
}: ScorecardModalProps) {
  const handleShare = () => {
    const input: ScorecardShareInput = { round, courseName, players, scores, hcps, holes };
    const message = buildScorecardShareText(input);
    Share.share({ message, title: 'Scorecard' });
  };

  const gameLabel =
    round.gameStyle === 'matchplay' ? 'Match Play' : round.gameStyle === 'fivethreeone' ? '5-3-1' : round.gameStyle === 'wolf' ? 'Wolf' : 'Skins';

  const getWolfRole = (holeNum: number, playerId: number): string | null => {
    if (!wolfDecisions || round.gameStyle !== 'wolf') return null;
    const d = wolfDecisions[holeNum];
    if (!d) return null;
    const wolfId = players[d.wolfIndex]?.id;
    if (wolfId == null) return null;
    if (playerId === wolfId) return d.isBlind ? '🐺🐺' : '🐺';
    if (d.partnerId === playerId) return 'P';
    return null;
  };

  const renderTable = (start: number, end: number, showOutTotal: boolean) => {
    const slice = holes.slice(start, end);
    const parTotal = slice.reduce((s, h) => s + h.par, 0);
    const playerTotals = players.map((p) =>
      slice.reduce((s, h) => s + (scores[p.id]?.[h.hole] ?? 0), 0)
    );
    return (
      <View style={styles.tableWrap}>
        <View style={styles.tableRowHeader}>
          <Text style={[styles.cell, styles.cellHole, styles.headerCell]}>Hole</Text>
          <Text style={[styles.cell, styles.cellNarrow, styles.headerCell]}>Par</Text>
          <Text style={[styles.cell, styles.cellNarrow, styles.headerCell]}>SI</Text>
          {players.map((p) => (
            <Text key={p.id} style={[styles.cell, styles.cellPlayer, styles.headerCell]} numberOfLines={1}>
              {p.id === players[0].id ? 'You' : p.name}
            </Text>
          ))}
        </View>
        {slice.map((h) => (
          <View key={h.hole} style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellHole]}>{h.hole}</Text>
            <Text style={[styles.cell, styles.cellNarrow]}>{h.par}</Text>
            <Text style={[styles.cell, styles.cellNarrow]}>{h.si}</Text>
            {players.map((p) => {
              const gross = scores[p.id]?.[h.hole];
              const stroke = gross != null && strokesOnHole(hcps[p.id] ?? 0, h.si) > 0;
              const color = gross != null ? scoreColor(gross, h.par) : 'gray';
              const wolfRole = getWolfRole(h.hole, p.id);
              return (
                <View key={p.id} style={styles.cellPlayer}>
                  {gross != null ? (
                    <>
                      <Text style={[styles.scoreVal, { color: Colors[color] }]}>{gross}</Text>
                      {stroke && <Text style={styles.strokeDot}>●</Text>}
                    </>
                  ) : (
                    <Text style={styles.scoreBlank}>—</Text>
                  )}
                  {wolfRole != null && <Text style={styles.wolfRole}>{wolfRole}</Text>}
                </View>
              );
            })}
          </View>
        ))}
        {showOutTotal && (
          <View style={styles.totalRow}>
            <Text style={[styles.cell, styles.cellHole]}>{start === 0 ? 'OUT' : 'IN'}</Text>
            <Text style={[styles.cell, styles.cellNarrow]}>{parTotal}</Text>
            <Text style={[styles.cell, styles.cellNarrow]}></Text>
            {playerTotals.map((tot, i) => (
              <View key={players[i].id} style={styles.cellPlayer}>
                <Text style={[styles.scoreVal, styles.totalText]}>{tot}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Scorecard</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>
            {round.tee} · {gameLabel}
          </Text>
          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {renderTable(0, 9, true)}
            {renderTable(9, 18, true)}
            <View style={styles.totalRow}>
              <Text style={[styles.cell, styles.cellHole]}>TOTAL</Text>
              <Text style={[styles.cell, styles.cellNarrow]}>{holes.reduce((s, h) => s + h.par, 0)}</Text>
              <Text style={[styles.cell, styles.cellNarrow]}></Text>
              {players.map((p) => (
                <View key={p.id} style={styles.cellPlayer}>
                  <Text style={[styles.scoreVal, styles.totalText]}>
                    {holes.reduce((s, h) => s + (scores[p.id]?.[h.hole] ?? 0), 0)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: Colors.ink },
  closeBtn: { fontSize: 22, color: Colors.gray },
  sheetSub: { fontSize: 12, color: Colors.gray, paddingHorizontal: 20, marginBottom: 12 },
  shareBtn: {
    alignSelf: 'flex-end',
    marginRight: 20,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.forest,
    borderRadius: 8,
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: Colors.cream },
  scroll: { paddingHorizontal: 12 },
  tableWrap: { marginBottom: 16 },
  tableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.forest,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: Colors.parchment,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  cell: { fontFamily: 'monospace', fontSize: 12 },
  cellHole: { width: 32, color: Colors.ink },
  cellNarrow: { width: 28, textAlign: 'center' as const },
  headerCell: { color: Colors.cream },
  cellPlayer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scoreVal: { fontWeight: '700', fontSize: 13 },
  scoreBlank: { color: Colors.gray, fontSize: 13 },
  strokeDot: { fontSize: 8, color: Colors.forest },
  totalText: { fontWeight: '700', color: Colors.ink },
  wolfRole: { fontSize: 9, color: Colors.gray, marginLeft: 2 },
});
