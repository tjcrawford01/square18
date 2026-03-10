import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';

export interface HistoryEntry {
  date: string;
  courseName: string;
  gameStyle: string;
  players: { name: string; netAmount: number }[];
  totalPot: number;
}

const HISTORY_PREFIX = 'history:';

function formatHistoryDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const GAME_STYLE_LABELS: Record<string, string> = {
  matchplay: 'Match Play',
  skins: 'Skins',
  fivethreeone: '5-3-1',
  wolf: 'Wolf',
};

function computeHeadToHead(
  entries: HistoryEntry[]
): Array<{ pair: string; wins: number; losses: number }> {
  const h2h = new Map<string, { wins: number; losses: number }>();

  function key(a: string, b: string) {
    const [x, y] = [a, b].sort();
    return `${x} vs ${y}`;
  }

  for (const e of entries) {
    const names = e.players.map((p) => p.name);
    const netMap = new Map(names.map((n, i) => [n, e.players[i]!.netAmount]));

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i]!;
        const b = names[j]!;
        const k = key(a, b);
        const [first, second] = k.split(' vs ');
        const rec = h2h.get(k) ?? { wins: 0, losses: 0 };
        const netA = netMap.get(a) ?? 0;
        const netB = netMap.get(b) ?? 0;
        if (netA > netB) {
          // A won
          if (a === first) rec.wins += 1;
          else rec.losses += 1;
        } else if (netB > netA) {
          // B won
          if (b === first) rec.wins += 1;
          else rec.losses += 1;
        }
        h2h.set(k, rec);
      }
    }
  }

  return Array.from(h2h.entries())
    .filter(([, v]) => v.wins + v.losses > 0)
    .map(([pair, v]) => ({ pair, wins: v.wins, losses: v.losses }))
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HistoryModal({ visible, onClose }: HistoryModalProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const historyKeys = keys.filter((k) => k.startsWith(HISTORY_PREFIX)).sort().reverse();
      const items = await AsyncStorage.multiGet(historyKeys);
      const parsed: HistoryEntry[] = items
        .map(([, v]) => (v ? (JSON.parse(v) as HistoryEntry) : null))
        .filter((e): e is HistoryEntry => e != null)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEntries(parsed);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    if (visible) loadHistory();
  }, [visible, loadHistory]);

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Delete all past rounds? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const historyKeys = keys.filter((k) => k.startsWith(HISTORY_PREFIX));
              await AsyncStorage.multiRemove(historyKeys);
              setEntries([]);
            } catch {
              // ignore
            }
          },
        },
      ]
    );
  };

  const h2hArray = computeHeadToHead(entries);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>History 📊</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {entries.length === 0 ? (
              <Text style={styles.empty}>No rounds yet. Complete a round to see history.</Text>
            ) : (
              <>
                {entries.map((e, i) => (
                  <View key={i} style={styles.entry}>
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryDate}>{formatHistoryDate(e.date)}</Text>
                      <Text style={styles.entryCourse}>{e.courseName}</Text>
                      <Text style={styles.entryGame}>
                        {GAME_STYLE_LABELS[e.gameStyle] ?? e.gameStyle}
                      </Text>
                    </View>
                    {e.players.map((p, j) => (
                      <View key={j} style={styles.playerRow}>
                        <Text style={styles.playerName}>{p.name}</Text>
                        <Text
                          style={[
                            styles.playerNet,
                            p.netAmount > 0 && styles.netPositive,
                            p.netAmount < 0 && styles.netNegative,
                          ]}
                        >
                          {p.netAmount >= 0 ? '+' : ''}{p.netAmount}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}

                {h2hArray.length > 0 && (
                  <View style={styles.h2hSection}>
                    <Text style={styles.h2hTitle}>Head-to-Head</Text>
                    {h2hArray.map(({ pair, wins, losses }) => (
                      <Text key={pair} style={styles.h2hRow}>
                        {pair}: {wins}-{losses}
                      </Text>
                    ))}
                  </View>
                )}

                <Pressable style={styles.clearBtn} onPress={clearHistory}>
                  <Text style={styles.clearBtnText}>Clear History</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  empty: {
    fontSize: 15,
    color: Colors.gray,
    textAlign: 'center',
    paddingVertical: 24,
  },
  entry: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  entryHeader: {
    marginBottom: 8,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
  },
  entryCourse: {
    fontSize: 13,
    color: Colors.gray,
  },
  entryGame: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  playerName: {
    fontSize: 14,
    color: Colors.ink,
  },
  playerNet: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray,
  },
  netPositive: {
    color: Colors.forest,
  },
  netNegative: {
    color: Colors.red,
  },
  h2hSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.grayLight,
  },
  h2hTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 8,
  },
  h2hRow: {
    fontSize: 13,
    color: Colors.gray,
    marginBottom: 4,
  },
  clearBtn: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 15,
    color: Colors.red,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: Colors.forest,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.cream,
  },
});
