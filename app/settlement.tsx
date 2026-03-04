import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoundStore } from '../src/store/roundStore';
import { ASPETUCK, getTeeOrDefault } from '../src/data/aspetuck';
import { SIDE_BET_TYPES } from '../src/data/sideBetTypes';
import { courseHandicap } from '../src/engine/handicap';
import { computeMatchSettlement } from '../src/engine/matchPlay';
import { computeSkins } from '../src/engine/skins';
import { countBirdies } from '../src/engine/birdies';
import { computeSideBetNet } from '../src/engine/sideBets';
import { buildSettlementText, venmoDeepLink, venmoLink, iMessageLink } from '../src/engine/settlement';
import { Card } from '../src/components/Card';
import { SectionLabel } from '../src/components/SectionLabel';
import { Colors } from '../src/theme/colors';

export default function SettlementScreen() {
  const router = useRouter();
  const { round, sideBetWinners, setSideBetWinner, resetRound } = useRoundStore();

  const tee = getTeeOrDefault(round.tee);
  const holes = tee.holes;
  const isMatchPlay = round.gameStyle === 'matchplay';

  const hcps: Record<number, number> = {};
  round.players.forEach((p) => {
    const raw = courseHandicap(p.index ?? 0, tee);
    hcps[p.id] = isMatchPlay ? Math.round(raw * 0.85) : raw;
  });

  const t1 = round.teams[0].playerIds;
  const t2 = round.teams[1].playerIds;
  const getNames = (ids: number[]) =>
    ids
      .map((id) => round.players.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(' & ');

  const settlement = isMatchPlay
    ? computeMatchSettlement(round.scores, hcps, t1, t2, round.stakes, round.autoPress, round.pressAt, holes)
    : null;

  const skinResults = !isMatchPlay ? computeSkins(round.scores, hcps, round.players.map((p) => p.id), holes) : [];
  const skinsWon: Record<number, number> = {};
  round.players.forEach((p) => (skinsWon[p.id] = 0));
  skinResults.forEach((r) => {
    if (r.winner != null) skinsWon[r.winner] = (skinsWon[r.winner] ?? 0) + (r.skinsWon ?? 0);
  });
  const perSkin = round.skinValue * round.players.length;
  const skinsSettlement = !isMatchPlay ? { skinResults, skinsWon, perSkin } : null;

  const birdiePool = round.sideBets.find((sb) => sb.type === 'birdie');
  const birdieCounts = birdiePool ? countBirdies(round.scores, round.players.map((p) => p.id), holes) : null;

  const sbNet = computeSideBetNet(
    round.sideBets,
    sideBetWinners as Record<string | number, number | undefined>,
    round.players
  );

  const scorekeeperId = round.players[0]?.id;
  const matchContrib: Record<number, number> = {};
  round.players.forEach((p) => {
    if (isMatchPlay && settlement) {
      const onT1 = t1.includes(p.id);
      matchContrib[p.id] =
        (onT1 ? Math.sign(settlement.net) : -Math.sign(settlement.net)) * Math.abs(settlement.net) / 2;
    } else {
      matchContrib[p.id] = 0;
    }
  });

  const netPerPlayer: Record<number, number> = {};
  if (isMatchPlay) {
    round.players.forEach((p) => {
      netPerPlayer[p.id] = Math.round(matchContrib[p.id] + (sbNet[p.id] ?? 0));
    });
  } else if (skinsSettlement) {
    const totalSkins = skinsSettlement.skinResults.reduce((s, r) => s + (r.skinsWon ?? 0), 0);
    const totalPot = totalSkins * perSkin;
    round.players.forEach((p) => {
      const skinsNet = skinsSettlement.skinsWon[p.id] * perSkin - totalPot / round.players.length;
      netPerPlayer[p.id] = Math.round(skinsNet + (sbNet[p.id] ?? 0));
    });
  } else {
    round.players.forEach((p) => {
      netPerPlayer[p.id] = Math.round(sbNet[p.id] ?? 0);
    });
  }

  const msgText = buildSettlementText(
    round,
    settlement,
    skinsSettlement,
    sideBetWinners as Record<string | number, number | undefined>,
    {
      netPerPlayer,
      matchContrib,
      sbNet,
      birdieCounts: birdieCounts ?? undefined,
    }
  );

  const handleStartNewRound = () => {
    resetRound();
    router.replace('/');
  };

  const openVenmo = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Venmo didn't open",
          "Make sure the Venmo app is installed. You can still use the settlement text to send payment links.",
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert(
        "Venmo didn't open",
        "Make sure the Venmo app is installed. You can still use the settlement text to send payment links.",
        [{ text: 'OK' }]
      );
    }
  };
  const openiMessage = () => Linking.openURL(iMessageLink(msgText));

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>⛳</Text>
        <Text style={styles.heroTitle}>You're Square.</Text>
        <Text style={styles.heroSub}>
          {ASPETUCK.name} · {round.tee} tees · {isMatchPlay ? 'Match Play' : 'Skins'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.scorekeeperNote}>
          <Text style={styles.scorekeeperNoteText}>
            You're the scorekeeper. Use the breakdown below and Venmo buttons to request payment from others, or send the group text so everyone sees the totals.
          </Text>
        </View>
        {isMatchPlay && settlement && (
          <>
            <SectionLabel>Match Results</SectionLabel>
            <Card accent={Colors.forest} style={styles.card}>
              {[
                ['Front 9', settlement.front.result, settlement.fAmt],
                ['Back 9', settlement.back.result, settlement.bAmt],
                ['Overall', settlement.total.result, settlement.tAmt],
              ].map(([label, result, amt]) => (
                <View key={String(label)} style={styles.resultRow}>
                  <Text style={styles.resultLabel}>{label}</Text>
                  <Text style={[styles.resultMid, result === 0 && styles.resultTied, result > 0 && styles.resultWin, result < 0 && styles.resultLose]}>
                    {result === 0 ? 'Tied' : result > 0 ? `${getNames(t1)} wins` : `${getNames(t2)} wins`}
                  </Text>
                  <Text style={[styles.resultAmt, result === 0 && styles.resultTied]}>{result === 0 ? '$0' : `$${Math.abs(amt)}`}</Text>
                </View>
              ))}
              {settlement.pressDetails.map((p, i) => (
                <View key={i} style={styles.resultRow}>
                  <Text style={styles.resultLabel}>🔁 Press H{p.startHole}</Text>
                  <Text style={[styles.resultMid, p.result === 0 && styles.resultTied, p.result > 0 && styles.resultWin, p.result < 0 && styles.resultLose]}>
                    {p.result === 0 ? 'Tied' : p.result > 0 ? `${getNames(t1)} wins` : `${getNames(t2)} wins`}
                  </Text>
                  <Text style={[styles.resultAmt, p.result === 0 && styles.resultTied]}>{p.result === 0 ? '$0' : `$${Math.abs(p.amt)}`}</Text>
                </View>
              ))}
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>
                  {settlement.net === 0 ? 'All Square' : settlement.net > 0 ? `${getNames(t1)} win` : `${getNames(t2)} win`}
                </Text>
                <Text style={styles.netAmt}>${Math.abs(settlement.net)}</Text>
              </View>
            </Card>

          </>
        )}

        {!isMatchPlay && skinsSettlement && (
          <>
            <SectionLabel>Skins Leaderboard</SectionLabel>
            <Card accent={Colors.gold} style={styles.card}>
              {round.players
                .slice()
                .sort((a, b) => skinsWon[b.id] - skinsWon[a.id])
                .map((p, i) => (
                  <View key={p.id} style={styles.skinRow}>
                    <View style={styles.skinLeft}>
                      {i === 0 && skinsWon[p.id] > 0 && <Text>🏆</Text>}
                      <Text style={[styles.skinName, i === 0 && styles.skinNameBold]}>{p.name}</Text>
                    </View>
                    <View style={styles.skinRight}>
                      <Text style={styles.skinCount}>{skinsWon[p.id]} skin{skinsWon[p.id] !== 1 ? 's' : ''}</Text>
                      <Text style={[styles.skinAmt, skinsWon[p.id] > 0 && styles.skinAmtGreen]}>${skinsWon[p.id] * perSkin}</Text>
                    </View>
                  </View>
                ))}
            </Card>

            <SectionLabel>Hole-by-Hole</SectionLabel>
            <Card>
              {skinsSettlement.skinResults.map((r) => {
                if (r.pending) return null;
                const winner = r.winner != null ? round.players.find((p) => p.id === r.winner) : null;
                return (
                  <View key={r.hole} style={styles.holeRow}>
                    <Text style={styles.holeLabel}>Hole {r.hole}</Text>
                    <Text style={styles.holeMid}>
                      {winner ? `${winner.name}${(r.skinsWon ?? 0) > 1 ? ` (${r.skinsWon}🏌️)` : ''}` : r.tied ? 'Tied —' : '—'}
                    </Text>
                    <Text style={[styles.holeAmt, winner && styles.skinAmtGreen]}>{winner ? `$${(r.skinsWon ?? 0) * perSkin}` : 'carry'}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {round.sideBets.length > 0 && (
          <>
            <SectionLabel>Side Bets</SectionLabel>
            {round.sideBets.map((sb) => {
              const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
              const pot = sb.amount * round.players.length;
              const winnerId = sideBetWinners[sb.id];
              const winner = winnerId ? round.players.find((p) => p.id === winnerId) : null;
              let birdieWinner: (typeof round.players)[0] | null = null;
              let birdieLeaders: (typeof round.players) = [];
              let maxBirdies = 0;
              if (sb.type === 'birdie' && birdieCounts) {
                maxBirdies = Math.max(...round.players.map((p) => birdieCounts[p.id]));
                birdieLeaders = round.players.filter((p) => birdieCounts[p.id] === maxBirdies && maxBirdies > 0);
                if (birdieLeaders.length === 1) birdieWinner = birdieLeaders[0];
              }
              const effectiveWinner = sb.type === 'birdie' ? birdieWinner : winner;

              return (
                <Card key={sb.id} accent={effectiveWinner ? Colors.forest : Colors.sand} style={styles.sideBetCard}>
                  <Text style={styles.sideBetTitle}>{type?.label}{!type?.noHole ? ` · Hole ${sb.hole}` : ''}</Text>
                  <Text style={styles.sideBetPot}>${pot} pot</Text>
                  {sb.type === 'birdie' && birdieCounts ? (
                    <View style={styles.birdieSection}>
                      {round.players
                        .slice()
                        .sort((a, b) => birdieCounts[b.id] - birdieCounts[a.id])
                        .map((p) => (
                          <View key={p.id} style={styles.birdieRow}>
                            <Text style={styles.birdieName}>{p.name}</Text>
                            <Text style={[styles.birdieCount, birdieCounts[p.id] > 0 && styles.skinAmtGreen]}>
                              {birdieCounts[p.id]} birdie{birdieCounts[p.id] !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        ))}
                      {birdieWinner ? (
                        <View style={styles.birdieWinnerSection}>
                          <Text style={styles.birdieWinnerText}>🏆 {birdieWinner.name} wins ${pot}</Text>
                          {round.players
                            .filter((p) => p.id !== birdieWinner!.id)
                            .map((payer) => (
                              <Pressable
                                key={payer.id}
                                style={styles.venmoBtnFull}
                                onPress={() => openVenmo(venmoLink(birdieWinner!.venmo, sb.amount, `Square18 Birdie Pool @${ASPETUCK.name}`))}
                              >
                                <Text style={styles.venmoBtnText}>{payer.name} → Pay {birdieWinner!.name} ${sb.amount}</Text>
                              </Pressable>
                            ))}
                        </View>
                      ) : birdieLeaders.length > 1 && maxBirdies > 0 ? (
                        <View style={styles.birdieWinnerSection}>
                          <Text style={styles.birdieWinnerText}>Pot split — ${Math.round(pot / birdieLeaders.length)} each</Text>
                          {round.players
                            .filter((p) => !birdieLeaders.includes(p))
                            .map((payer) =>
                              birdieLeaders.map((winner) => (
                                <Pressable
                                  key={`${payer.id}-${winner.id}`}
                                  style={styles.venmoBtnFull}
                                  onPress={() => openVenmo(venmoLink(winner.venmo, sb.amount, `Square18 Birdie Pool @${ASPETUCK.name}`))}
                                >
                                  <Text style={styles.venmoBtnText}>{payer.name} → Pay {winner.name} ${sb.amount}</Text>
                                </Pressable>
                              ))
                            )}
                        </View>
                      ) : (
                        <Text style={styles.tieText}>No birdies — pot carries or agree with group</Text>
                      )}
                    </View>
                  ) : (
                    <View>
                      {!effectiveWinner ? (
                        <>
                          <Text style={styles.whoWon}>Who won?</Text>
                          <View style={styles.winnerChips}>
                            {round.players.map((p) => (
                              <Pressable key={p.id} style={styles.winnerChip} onPress={() => setSideBetWinner(sb.id, p.id)}>
                                <Text style={styles.winnerChipText}>{p.name}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.birdieWinnerText}>🏆 {effectiveWinner.name} wins ${pot}</Text>
                          {round.players
                            .filter((p) => p.id !== effectiveWinner.id)
                            .map((payer) => (
                              <Pressable
                                key={payer.id}
                                style={styles.venmoBtnFull}
                                onPress={() => openVenmo(venmoLink(effectiveWinner.venmo, sb.amount, `Square18 ${type?.label} @${ASPETUCK.name}`))}
                              >
                                <Text style={styles.venmoBtnText}>{payer.name} → Pay {effectiveWinner.name} ${sb.amount}</Text>
                              </Pressable>
                            ))}
                          <Pressable onPress={() => setSideBetWinner(sb.id, undefined)}>
                            <Text style={styles.changeWinner}>← Change winner</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        )}

        <SectionLabel>Settle Up</SectionLabel>
        {(() => {
          const othersWithNet = round.players.filter(
            (p) => p.id !== scorekeeperId && (netPerPlayer[p.id] ?? 0) !== 0
          );
          if (othersWithNet.length === 0) {
            return (
              <Card accent={Colors.grayLight}>
                <Text style={styles.evenText}>Everyone is even with you.</Text>
              </Card>
            );
          }
          const note = `Square18 @${ASPETUCK.name}`;
          return othersWithNet.map((p) => {
            const net = netPerPlayer[p.id] ?? 0;
            const amount = Math.abs(net);
            const owesYou = net < 0;
            return (
              <Card
                key={p.id}
                accent={owesYou ? Colors.redLight : Colors.forest}
                style={styles.settleCard}
              >
                <View style={styles.settleHeader}>
                  <Text style={styles.payerName}>
                    {owesYou ? `${p.name} owes you $${amount}` : `You owe ${p.name} $${amount}`}
                  </Text>
                  <Text style={styles.owesSub}>match + side bets</Text>
                </View>
                <Pressable
                  style={styles.venmoBtn}
                  onPress={() =>
                    openVenmo(
                      venmoDeepLink(
                        p.venmo,
                        amount,
                        note,
                        owesYou ? 'request' : 'pay'
                      )
                    )
                  }
                >
                  <Text style={styles.venmoBtnText}>
                    {owesYou ? `Request $${amount} from ${p.name}` : `Pay ${p.name} $${amount}`}
                  </Text>
                  <Text style={styles.venmoBtnAmt}>${amount}</Text>
                </Pressable>
              </Card>
            );
          });
        })()}

        <View style={styles.sendSection}>
          <Pressable style={styles.sendBtn} onPress={openiMessage}>
            <Text style={styles.sendBtnText}>📱 Send Group Settlement Text</Text>
          </Pressable>
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>PREVIEW</Text>
            <Text style={styles.previewText}>{msgText}</Text>
          </View>
        </View>

        <Pressable style={styles.newRoundBtn} onPress={handleStartNewRound}>
          <Text style={styles.newRoundBtnText}>Start New Round</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  hero: {
    backgroundColor: Colors.forest,
    paddingVertical: 36,
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Colors.gold,
  },
  heroEmoji: { fontSize: 44, marginBottom: 8 },
  heroTitle: { fontSize: 36, fontWeight: '700', color: Colors.gold },
  heroSub: { color: Colors.rough, fontSize: 12, marginTop: 6 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  scorekeeperNote: {
    backgroundColor: Colors.parchment,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.sand,
  },
  scorekeeperNoteText: {
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 20,
    textAlign: 'center',
  },
  card: { marginBottom: 16 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  resultLabel: { color: Colors.gray, fontSize: 13, minWidth: 60 },
  resultMid: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  resultTied: { color: Colors.gray },
  resultWin: { color: Colors.fairway },
  resultLose: { color: Colors.red },
  resultAmt: { fontSize: 14, fontWeight: '700', color: Colors.gold, minWidth: 36, textAlign: 'right' },
  netRow: { borderTopWidth: 2, borderTopColor: Colors.grayLight, marginTop: 4, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel: { fontWeight: '700', fontSize: 15 },
  netAmt: { color: Colors.gold, fontWeight: '700', fontSize: 22 },
  evenText: { textAlign: 'center', color: Colors.gray, fontSize: 14 },
  settleCard: { marginBottom: 12 },
  settleHeader: { marginBottom: 10 },
  payerName: { fontWeight: '700', fontSize: 15 },
  owes: { color: Colors.red, fontSize: 18, fontWeight: '700' },
  owesSub: { color: Colors.gray, fontSize: 11, marginTop: 2 },
  venmoRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  venmoBtn: { flex: 1, minWidth: 80, backgroundColor: Colors.blue, borderRadius: 8, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#0f2a5a' },
  venmoBtnText: { color: Colors.cream, fontSize: 13, fontWeight: '700' },
  venmoBtnAmt: { color: Colors.cream, fontSize: 11 },
  venmoBtnFull: { backgroundColor: Colors.blue, borderRadius: 8, padding: 8, paddingHorizontal: 12, marginBottom: 4, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#0f2a5a' },
  skinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  skinLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  skinName: { fontSize: 14 },
  skinNameBold: { fontWeight: '700' },
  skinRight: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skinCount: { color: Colors.gray, fontSize: 12 },
  skinAmt: { fontSize: 18, fontWeight: '700', color: Colors.gray },
  skinAmtGreen: { color: Colors.forest },
  holeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: Colors.grayLight },
  holeLabel: { color: Colors.gray, fontSize: 12, minWidth: 56 },
  holeMid: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  holeAmt: { fontSize: 12, fontWeight: '700', color: Colors.gray, minWidth: 44, textAlign: 'right' },
  sideBetCard: { marginBottom: 12 },
  sideBetTitle: { fontWeight: '700', fontSize: 14 },
  sideBetPot: { color: Colors.gray, fontSize: 12, marginTop: 2 },
  birdieSection: { marginTop: 4 },
  birdieRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  birdieName: { fontSize: 13 },
  birdieCount: { fontSize: 13, fontWeight: '700', color: Colors.gray },
  birdieWinnerSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.grayLight, paddingTop: 8 },
  birdieWinnerText: { color: Colors.forest, fontWeight: '700', fontSize: 13, marginBottom: 8 },
  tieText: { color: Colors.gray, fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  whoWon: { color: Colors.gray, fontSize: 12, marginBottom: 8 },
  winnerChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  winnerChip: { flex: 1, minWidth: 70, padding: 8, borderRadius: 8, borderWidth: 2, borderColor: Colors.grayLight, backgroundColor: Colors.parchment, alignItems: 'center' },
  winnerChipText: { fontSize: 12, color: Colors.ink },
  changeWinner: { color: Colors.gray, fontSize: 11, marginTop: 4 },
  sendSection: { marginTop: 16 },
  sendBtn: {
    width: '100%',
    paddingVertical: 18,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#8a6a20',
  },
  sendBtnText: { fontSize: 17, fontWeight: '700', color: Colors.ink },
  preview: { marginTop: 8, backgroundColor: Colors.parchment, borderRadius: 8, padding: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.sand },
  previewLabel: { fontSize: 10, color: Colors.gray, marginBottom: 6, letterSpacing: 1 },
  previewText: { fontSize: 11, color: Colors.ink, lineHeight: 18 },
  newRoundBtn: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    borderRadius: 10,
    alignItems: 'center',
  },
  newRoundBtnText: { color: Colors.gray, fontSize: 14 },
});
