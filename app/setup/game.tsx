import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoundStore, buildDefaultTeams } from '../../src/store/roundStore';
import { ASPETUCK, getTeeOrDefault } from '../../src/data/aspetuck';
import { SIDE_BET_TYPES } from '../../src/data/sideBetTypes';
import { courseHandicap } from '../../src/engine/handicap';
import { NavBar } from '../../src/components/NavBar';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { Toggle } from '../../src/components/Toggle';
import { PrimaryBtn } from '../../src/components/PrimaryBtn';
import { Colors } from '../../src/theme/colors';
import type { SideBet } from '../../src/store/roundStore';

function eligibleHoles(typeId: string, holes: { par: number; hole: number }[]): number[] {
  const t = SIDE_BET_TYPES.find((x) => x.id === typeId);
  if (!t) return holes.map((h) => h.hole);
  if (t.par3only) return holes.filter((h) => h.par === 3).map((h) => h.hole);
  if (t.par3exclude) return holes.filter((h) => h.par !== 3).map((h) => h.hole);
  return holes.map((h) => h.hole);
}

export default function GameScreen() {
  const router = useRouter();
  const { players, teams, setTeams, round, setRound, startRound } = useRoundStore();
  const [addingBet, setAddingBet] = useState(false);
  const [newBet, setNewBet] = useState({ type: 'ctp', hole: 5, amount: 5 });

  const tee = getTeeOrDefault(round.tee);
  const holes = tee.holes;
  const isMatchPlay = round.gameStyle === 'matchplay';
  const matchPlayDisabled = players.length === 3;

  useEffect(() => {
    if (players.length === 3 && round.gameStyle === 'matchplay') {
      setRound({ gameStyle: 'skins' });
    }
  }, [players.length]);

  useEffect(() => {
    if (round.stakes.front === 20 && round.stakes.back === 20 && round.stakes.total === 20) {
      setRound({ stakes: { front: 10, back: 10, total: 20 } });
    }
  }, []);

  const addBet = () => {
    const id = Date.now();
    const hole = newBet.type === 'birdie' || newBet.hole === 0 ? null : newBet.hole;
    setRound({
      sideBets: [...round.sideBets, { id, type: newBet.type, hole, amount: newBet.amount }],
    });
    setAddingBet(false);
    setNewBet({ type: 'ctp', hole: eligibleHoles('ctp')[0], amount: 5 });
  };

  const assignTeam = (pid: number, ti: number) => {
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, playerIds: t.playerIds.filter((id) => id !== pid) }));
      next[ti].playerIds.push(pid);
      return next;
    });
  };

  const handleLockAndTeeOff = () => {
    startRound();
    router.replace('/round/1');
  };

  return (
    <View style={styles.container}>
      <NavBar title="Game Setup" subtitle="Step 2 of 3" onBack={() => router.back()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionLabel>Game Style</SectionLabel>
        <View style={styles.gameStyleRow}>
          {[
            { id: 'matchplay', icon: '🏆', label: 'Match Play', desc: players.length === 2 ? '1v1 Nassau' : '2v2 Best Ball Nassau' },
            { id: 'skins', icon: '💰', label: 'Skins', desc: 'Win holes, carry ties' },
          ].map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                if (g.id === 'matchplay' && matchPlayDisabled) return;
                setRound({ gameStyle: g.id as 'matchplay' | 'skins' });
              }}
              style={[
                styles.gameStyleBtn,
                round.gameStyle === g.id && styles.gameStyleBtnActive,
                g.id === 'matchplay' && matchPlayDisabled && styles.gameStyleBtnDisabled,
              ]}
            >
              <Text style={styles.gameStyleIcon}>{g.icon}</Text>
              <Text style={[styles.gameStyleLabel, round.gameStyle === g.id && styles.gameStyleLabelActive]}>{g.label}</Text>
              <Text style={[styles.gameStyleDesc, round.gameStyle === g.id && styles.gameStyleDescActive]}>{g.desc}</Text>
            </Pressable>
          ))}
        </View>

        <SectionLabel>Tees</SectionLabel>
        <Pressable
          style={styles.teeDropdown}
          onPress={() =>
            Alert.alert(
              'Select tees',
              undefined,
              ASPETUCK.tees.map((t) => ({
                text: `${t.name} (${t.rating}/${t.slope})`,
                onPress: () => setRound({ tee: t.name }),
              })).concat([{ text: 'Cancel', style: 'cancel' }])
            )
          }
        >
          <Text style={styles.teeDropdownLabel}>{tee.name}</Text>
          <Text style={styles.teeDropdownSub}>{tee.rating} / {tee.slope}</Text>
          <Text style={styles.teeDropdownChevron}>▾</Text>
        </Pressable>

        {isMatchPlay && players.length !== 3 && (
          <>
            <SectionLabel>Nassau Stakes (per match)</SectionLabel>
            <View style={styles.stakesRow}>
              {(['front', 'back', 'total'] as const).map((key, i) => (
                <View key={key} style={styles.stakeCol}>
                  <Text style={styles.stakeLabel}>{['Front 9', 'Back 9', 'Overall'][i]}</Text>
                  <View style={styles.stakeInputWrap}>
                    <Text style={styles.dollar}>$</Text>
                    <TextInput
                      style={styles.stakeInput}
                      value={round.stakes[key] ? String(round.stakes[key]) : ''}
                      onChangeText={(t) =>
                        setRound({
                          stakes: { ...round.stakes, [key]: parseInt(t, 10) || 0 },
                        })
                      }
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              ))}
            </View>

            {players.length === 2 ? (
              <>
                <SectionLabel>Match-up</SectionLabel>
                <Card accent={Colors.forest} style={styles.matchCard}>
                  <View style={styles.matchupRow}>
                    <View style={styles.matchupSide}>
                      <Text style={styles.matchupName}>{players[0].name}</Text>
                      <Text style={styles.matchupCh}>CH {courseHandicap(players[0].index, tee)}</Text>
                    </View>
                    <Text style={styles.vs}>vs</Text>
                    <View style={styles.matchupSide}>
                      <Text style={[styles.matchupName, { color: Colors.blue }]}>{players[1].name}</Text>
                      <Text style={styles.matchupCh}>CH {courseHandicap(players[1].index, tee)}</Text>
                    </View>
                  </View>
                </Card>
              </>
            ) : (
              <>
                <SectionLabel>Teams</SectionLabel>
                {teams.map((team, ti) => (
                  <Card key={team.id} accent={ti === 0 ? Colors.forest : Colors.gold} style={styles.teamCard}>
                    <Text style={[styles.teamLabel, { color: ti === 0 ? Colors.forest : Colors.gold }]}>Team {ti + 1}</Text>
                    <View style={styles.teamChips}>
                      {players.map((p) => {
                        const on = team.playerIds.includes(p.id);
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => assignTeam(p.id, ti)}
                            style={[
                              styles.chip,
                              on && (ti === 0 ? styles.chipTeam1 : styles.chipTeam2),
                            ]}
                          >
                            <Text style={[styles.chipText, on && (ti === 0 ? styles.chipTextOn1 : styles.chipTextOn2)]}>{p.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                ))}
              </>
            )}

            <Card>
              <View style={styles.autoPressRow}>
                <View>
                  <Text style={styles.autoPressTitle}>Auto-press</Text>
                  <Text style={styles.autoPressDesc}>New bet on same nine, same amount</Text>
                </View>
                <Toggle value={round.autoPress} onChange={(v) => setRound({ autoPress: v })} />
              </View>
              {round.autoPress && (
                <View style={styles.pressAtRow}>
                  {[1, 2, 3].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setRound({ pressAt: n })}
                      style={[styles.pressAtBtn, round.pressAt === n && styles.pressAtBtnActive]}
                    >
                      <Text style={[styles.pressAtText, round.pressAt === n && styles.pressAtTextActive]}>Down {n}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </>
        )}

        {!isMatchPlay && (
          <>
            <SectionLabel>Skin Value</SectionLabel>
            <View style={styles.skinValueRow}>
              <Text style={styles.dollarLarge}>$</Text>
              <TextInput
                style={styles.skinValueInput}
                value={round.skinValue ? String(round.skinValue) : ''}
                onChangeText={(t) => setRound({ skinValue: parseInt(t, 10) || 0 })}
                keyboardType="number-pad"
              />
              <Text style={styles.perSkin}>per skin</Text>
            </View>
            <View style={styles.note}>
              <Text style={styles.noteText}>
                {players.length} players × ${round.skinValue || 0} = <Text style={styles.noteBold}>${(round.skinValue || 0) * players.length} pot per skin</Text>. Ties carry.
              </Text>
            </View>
          </>
        )}

        <SectionLabel>Side Bets</SectionLabel>
        {round.sideBets.length === 0 && !addingBet && (
          <Text style={styles.noSideBets}>No side bets yet.</Text>
        )}
        {round.sideBets.map((sb) => {
          const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
          return (
            <Card key={sb.id} accent={Colors.sand} style={styles.sideBetCard}>
              <View style={styles.sideBetRow}>
                <View>
                  <Text style={styles.sideBetTitle}>
                    {type?.label}{!type?.noHole ? ` · Hole ${sb.hole}` : ' · 18 holes'}
                  </Text>
                  <Text style={styles.sideBetSub}>${sb.amount} · pot {sb.amount * players.length}</Text>
                </View>
                <Pressable onPress={() => setRound({ sideBets: round.sideBets.filter((s) => s.id !== sb.id) })}>
                  <Text style={styles.removeBtn}>×</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}

        {addingBet ? (
          <Card accent={Colors.gold} style={styles.newBetCard}>
            <Text style={styles.newBetTitle}>New Side Bet</Text>
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.pickerRow}>
              {SIDE_BET_TYPES.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    const eligible = eligibleHoles(t.id, holes);
                    setNewBet((b) => ({ ...b, type: t.id, hole: t.noHole ? 0 : eligible[0] }));
                  }}
                  style={[styles.pickerOpt, newBet.type === t.id && styles.pickerOptActive]}
                >
                  <View style={styles.pickerOptContent}>
                    <Text style={newBet.type === t.id ? styles.pickerOptTextActive : styles.pickerOptText}>{t.label}</Text>
                    <Text style={newBet.type === t.id ? styles.pickerOptDescActive : styles.pickerOptDesc}>{t.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {!SIDE_BET_TYPES.find((t) => t.id === newBet.type)?.noHole && (
              <>
                <Text style={styles.fieldLabel}>HOLE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.holesRow}>
                  {eligibleHoles(newBet.type, holes).map((h) => {
                    const hd = holes[h - 1];
                    const isSelected = newBet.hole === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => setNewBet((b) => ({ ...b, hole: b.hole === h ? 0 : h }))}
                        style={[styles.holeChip, isSelected && styles.holeChipActive]}
                      >
                        <Text style={isSelected ? styles.holeChipTextActive : styles.holeChipText}>H{h} (Par {hd.par})</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
            <Text style={styles.fieldLabel}>AMOUNT PER PLAYER ($)</Text>
            <TextInput
              style={styles.amountInput}
              value={newBet.amount ? String(newBet.amount) : ''}
              onChangeText={(t) => setNewBet((b) => ({ ...b, amount: parseInt(t, 10) || 0 }))}
              keyboardType="number-pad"
            />
            <View style={styles.newBetActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddingBet(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.addBetBtn, !SIDE_BET_TYPES.find((t) => t.id === newBet.type)?.noHole && !newBet.hole && styles.addBetBtnDisabled]}
                onPress={addBet}
                disabled={!SIDE_BET_TYPES.find((t) => t.id === newBet.type)?.noHole ? !newBet.hole : false}
              >
                <Text style={[styles.addBetBtnText, !SIDE_BET_TYPES.find((t) => t.id === newBet.type)?.noHole && !newBet.hole && styles.addBetBtnTextDisabled]}>Add ✓</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Pressable style={styles.addSideBetBtn} onPress={() => setAddingBet(true)}>
            <Text style={styles.addSideBetBtnText}>+ Add Side Bet</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryBtn label="Lock & Tee Off 🏌️" onPress={handleLockAndTeeOff} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 24 },
  gameStyleRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  gameStyleBtn: {
    flex: 1,
    padding: 14,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    borderRadius: 10,
    alignItems: 'center',
  },
  gameStyleBtnActive: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
    borderBottomWidth: 4,
    borderBottomColor: Colors.gold,
  },
  gameStyleIcon: { fontSize: 24, marginBottom: 6 },
  gameStyleLabel: { fontWeight: '700', fontSize: 14, color: Colors.ink },
  gameStyleLabelActive: { color: Colors.cream },
  gameStyleDesc: { fontSize: 11, opacity: 0.7, marginTop: 3, color: Colors.ink },
  gameStyleDescActive: { color: Colors.cream },
  gameStyleBtnDisabled: { opacity: 0.5 },
  teeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.parchment,
    marginBottom: 20,
  },
  teeDropdownLabel: { fontSize: 15, fontWeight: '700', color: Colors.ink, flex: 1 },
  teeDropdownSub: { fontSize: 12, color: Colors.gray, marginRight: 8 },
  teeDropdownChevron: { fontSize: 14, color: Colors.gray },
  stakesRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  stakeCol: { flex: 1, alignItems: 'center' },
  stakeLabel: { color: Colors.gray, fontSize: 11, marginBottom: 4 },
  stakeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.grayLight,
  },
  dollar: { color: Colors.gray, fontSize: 11 },
  stakeInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.forest,
    padding: 0,
  },
  matchCard: { marginBottom: 12 },
  matchupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchupSide: { flex: 1, alignItems: 'center' },
  matchupName: { fontSize: 13, fontWeight: '700', color: Colors.forest },
  matchupCh: { fontSize: 11, color: Colors.gray },
  vs: { fontSize: 18, color: Colors.gold, fontWeight: '700' },
  teamCard: { marginBottom: 12 },
  teamLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  teamChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.white,
  },
  chipTeam1: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  chipTeam2: { borderColor: Colors.gold, backgroundColor: Colors.gold },
  chipText: { fontSize: 13, color: Colors.gray },
  chipTextOn1: { color: Colors.cream, fontWeight: '700' },
  chipTextOn2: { color: Colors.ink, fontWeight: '700' },
  autoPressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  autoPressTitle: { fontSize: 14, fontWeight: '700' },
  autoPressDesc: { color: Colors.gray, fontSize: 12, marginTop: 2 },
  pressAtRow: { flexDirection: 'row', gap: 8 },
  pressAtBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  pressAtBtnActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  pressAtText: { fontSize: 13, color: Colors.ink },
  pressAtTextActive: { color: Colors.cream },
  skinValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    marginBottom: 10,
  },
  dollarLarge: { color: Colors.gray, fontSize: 18 },
  skinValueInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.forest,
    padding: 0,
  },
  perSkin: { color: Colors.gray, fontSize: 14 },
  note: { backgroundColor: Colors.parchment, borderRadius: 8, padding: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.sand, marginBottom: 20 },
  noteText: { fontSize: 12, color: Colors.ink },
  noteBold: { color: Colors.forest, fontWeight: '700' },
  noSideBets: { color: Colors.gray, fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
  sideBetCard: { marginBottom: 10 },
  sideBetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideBetTitle: { fontSize: 14, fontWeight: '700' },
  sideBetSub: { color: Colors.gray, fontSize: 12, marginTop: 2 },
  removeBtn: { color: Colors.gray, fontSize: 20 },
  newBetCard: { marginBottom: 10 },
  newBetTitle: { fontSize: 13, fontWeight: '700', marginBottom: 10, color: Colors.ink },
  fieldLabel: { fontSize: 11, color: Colors.gray, marginBottom: 4 },
  pickerRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pickerOpt: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.parchment,
  },
  pickerOptActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  pickerOptContent: { alignItems: 'flex-start' },
  pickerOptText: { fontSize: 12, color: Colors.ink },
  pickerOptTextActive: { fontSize: 12, color: Colors.cream, fontWeight: '700' },
  pickerOptDesc: { fontSize: 11, color: Colors.gray, marginTop: 2 },
  pickerOptDescActive: { fontSize: 11, color: Colors.cream, marginTop: 2, opacity: 0.9 },
  holesRow: { marginBottom: 10 },
  holeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.parchment,
    marginRight: 8,
  },
  holeChipActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  holeChipText: { fontSize: 12, color: Colors.ink },
  holeChipTextActive: { fontSize: 12, color: Colors.cream, fontWeight: '700' },
  amountInput: {
    borderWidth: 1,
    borderColor: Colors.grayLight,
    borderRadius: 8,
    padding: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.forest,
    backgroundColor: Colors.parchment,
    marginBottom: 12,
  },
  newBetActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: Colors.grayLight, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: Colors.gray },
  addBetBtn: { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.forest, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: Colors.gold },
  addBetBtnDisabled: { backgroundColor: Colors.grayLight, borderBottomColor: Colors.gray },
  addBetBtnText: { fontSize: 13, fontWeight: '700', color: Colors.cream },
  addBetBtnTextDisabled: { color: Colors.gray },
  addSideBetBtn: { width: '100%', paddingVertical: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.grayLight, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  addSideBetBtnText: { color: Colors.gray, fontSize: 13 },
  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: Colors.parchment },
});
