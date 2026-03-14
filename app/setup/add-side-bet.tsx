import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoundStore } from '../../src/store/roundStore';
import { useCourseStore } from '../../src/store/courseStore';
import { getTeeOrDefault } from '../../src/types/course';
import { SIDE_BET_TYPES } from '../../src/data/sideBetTypes';
import { NavBar } from '../../src/components/NavBar';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { PrimaryBtn } from '../../src/components/PrimaryBtn';
import { Colors } from '../../src/theme/colors';

function eligibleHoles(typeId: string, holes: { par: number; hole: number }[]): number[] {
  if (!holes?.length) return [];
  const t = SIDE_BET_TYPES.find((x) => x.id === typeId);
  if (!t) return holes.map((h) => h.hole);
  if (t.par3only) return holes.filter((h) => h.par === 3).map((h) => h.hole);
  if (t.par3exclude) return holes.filter((h) => h.par !== 3).map((h) => h.hole);
  return holes.map((h) => h.hole);
}

export default function AddSideBetScreen() {
  const router = useRouter();
  const { round, setRound, players } = useRoundStore();
  const selectedCourse = useCourseStore((s) => s.selectedCourse);
  const tee = getTeeOrDefault(selectedCourse, round?.tee ?? '');
  const numHoles = round?.numHoles ?? '18';
  const firstHole = numHoles === 'back9' ? 10 : 1;
  const lastHole = numHoles === 'front9' ? 9 : 18;
  const holes = (tee?.holes ?? []).filter((h) => h.hole >= firstHole && h.hole <= lastHole);
  const eligibleForType = (typeId: string) => eligibleHoles(typeId, holes);

  const [type, setType] = useState<string>('ctp');
  const [selections, setSelections] = useState<{ ctp: number[]; ld: number[]; birdie: boolean }>({
    ctp: [],
    ld: [],
    birdie: false,
  });
  const [amount, setAmount] = useState<string>('5');

  const typeInfo = SIDE_BET_TYPES.find((t) => t.id === type);
  const needsHole = typeInfo && !typeInfo.noHole;
  const eligible = useMemo(() => eligibleForType(type), [type, holes]);

  const selectedHoles = type === 'ctp' ? selections.ctp : type === 'longdrive' ? selections.ld : [];

  const toggleHole = (h: number) => {
    const key = type === 'ctp' ? 'ctp' : 'ld';
    setSelections((prev) => {
      const arr = prev[key];
      const next = arr.includes(h) ? arr.filter((x) => x !== h) : [...arr, h].sort((a, b) => a - b);
      return { ...prev, [key]: next };
    });
  };

  const toggleBirdie = () => setSelections((prev) => ({ ...prev, birdie: !prev.birdie }));

  const handleAdd = () => {
    const prevBets = Array.isArray(round?.sideBets) ? round.sideBets : [];
    const amountNum = Math.max(1, parseInt(amount, 10) || 5);
    let baseId = Date.now();
    const newBets: { id: number; type: string; hole: number | null; amount: number }[] = [];

    selections.ctp.forEach((h, i) => {
      newBets.push({ id: baseId + i, type: 'ctp', hole: h, amount: amountNum });
    });
    baseId += selections.ctp.length;
    selections.ld.forEach((h, i) => {
      newBets.push({ id: baseId + i, type: 'longdrive', hole: h, amount: amountNum });
    });
    baseId += selections.ld.length;
    if (selections.birdie) {
      newBets.push({ id: baseId, type: 'birdie', hole: null, amount: amountNum });
    }

    setRound({ sideBets: [...prevBets, ...newBets] });
    router.back();
  };

  const canAdd = selections.ctp.length > 0 || selections.ld.length > 0 || selections.birdie;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <NavBar title="Add Side Bet" subtitle="" onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SectionLabel>Type</SectionLabel>
        <View style={styles.pickerRow}>
          {SIDE_BET_TYPES.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setType(t.id)}
              style={[styles.pickerOpt, type === t.id && styles.pickerOptActive]}
            >
              <Text style={[styles.pickerText, type === t.id && styles.pickerTextActive]}>{t.label}</Text>
              <Text style={[styles.pickerDesc, type === t.id && styles.pickerDescActive]}>{t.desc}</Text>
            </Pressable>
          ))}
        </View>

        {type === 'birdie' ? (
          <>
            <SectionLabel>Birdie Pool</SectionLabel>
            <Pressable
              onPress={toggleBirdie}
              style={[styles.holeChip, styles.birdieChip, selections.birdie && styles.holeChipActive]}
            >
              <Text style={[styles.holeChipText, selections.birdie && styles.holeChipTextActive]}>
                {selections.birdie ? '✓ Selected' : 'Tap to add Birdie Pool'}
              </Text>
            </Pressable>
          </>
        ) : needsHole && (
          <>
            <SectionLabel>Holes (tap to select multiple)</SectionLabel>
            <View style={styles.holesWrap}>
              {eligible.map((h) => {
                const hd = holes.find((x) => x.hole === h);
                if (!hd) return null;
                const isSelected = selectedHoles.includes(h);
                return (
                  <Pressable
                    key={h}
                    onPress={() => toggleHole(h)}
                    style={[styles.holeChip, isSelected && styles.holeChipActive]}
                  >
                    <Text style={[styles.holeChipText, isSelected && styles.holeChipTextActive]}>
                      H{h} (Par {hd.par})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedHoles.length > 0 && (
              <Text style={styles.holeHint}>
                {selectedHoles.length} hole{selectedHoles.length !== 1 ? 's' : ''} selected — {selectedHoles.length} separate bet{selectedHoles.length !== 1 ? 's' : ''}
              </Text>
            )}
          </>
        )}

        <SectionLabel>Amount per player ($)</SectionLabel>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="5"
        />

        <PrimaryBtn label="Add Side Bets" onPress={handleAdd} disabled={!canAdd} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pickerOpt: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.parchment,
  },
  pickerOptActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  pickerText: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  pickerTextActive: { fontSize: 12, color: Colors.cream },
  pickerDesc: { fontSize: 11, color: Colors.gray, marginTop: 2 },
  pickerDescActive: { fontSize: 11, color: Colors.cream, marginTop: 2, opacity: 0.9 },
  holesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  birdieChip: { marginBottom: 16 },
  holeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.parchment,
  },
  holeChipActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  holeChipText: { fontSize: 12, color: Colors.ink },
  holeChipTextActive: { fontSize: 12, color: Colors.cream, fontWeight: '700' },
  holeHint: { fontSize: 12, color: Colors.gray, marginBottom: 12 },
  amountInput: {
    borderWidth: 1,
    borderColor: Colors.grayLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.forest,
    backgroundColor: Colors.parchment,
    marginBottom: 24,
  },
});
