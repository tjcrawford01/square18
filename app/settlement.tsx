import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoundStore } from '../src/store/roundStore';
import { useCourseStore } from '../src/store/courseStore';
import { getTeeOrDefault, getHolesForTee } from '../src/types/course';
import { SIDE_BET_TYPES } from '../src/data/sideBetTypes';
import { courseHandicap, playingHandicaps } from '../src/engine/handicap';
import { computeMatchSettlement } from '../src/engine/matchPlay';
import { computeSkins } from '../src/engine/skins';
import { computeFiveThreeOne, fiveThreeOneSettlement } from '../src/engine/fiveThreeOne';
import { calculateWolf } from '../src/engine/wolf';
import { countBirdies } from '../src/engine/birdies';
import { computeSideBetNet } from '../src/engine/sideBets';
import { getBiggestMoment, getBiggestChoke, getMomentumSwing } from '../src/engine/highlights';
import { buildSettlementText, buildScorecardShareText, minTransactions, venmoDeepLink, venmoLink } from '../src/engine/settlement';
import { Card } from '../src/components/Card';
import { SectionLabel } from '../src/components/SectionLabel';
import { Colors } from '../src/theme/colors';

export default function SettlementScreen() {
  const router = useRouter();
  const { round, sideBetWinners, setSideBetWinner, resetRound } = useRoundStore();
  const selectedCourse = useCourseStore((s) => s.selectedCourse);

  const tee = getTeeOrDefault(selectedCourse, round.tee);
  const allHoles = getHolesForTee(selectedCourse, round.tee);
  const numHoles = round.numHoles ?? '18';
  const firstHole = numHoles === 'back9' ? 10 : 1;
  const lastHole = numHoles === 'front9' ? 9 : 18;
  const holes = allHoles.filter((h) => h.hole >= firstHole && h.hole <= lastHole);
  const isMatchPlay = round.gameStyle === 'matchplay';
  const is531 = round.gameStyle === 'fivethreeone';
  const isWolf = round.gameStyle === 'wolf';

  const courseHcps: Record<number, number> = {};
  if (tee) {
    round.players.forEach((p) => {
      courseHcps[p.id] = courseHandicap(p.index ?? 0, tee);
    });
  }
  const hcps = playingHandicaps(courseHcps, isMatchPlay || isWolf);

  const t1 = round.teams[0].playerIds;
  const t2 = round.teams[1].playerIds;
  const getNames = (ids: number[]) =>
    ids
      .map((id) => round.players.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(' & ');

  const settlement = isMatchPlay
    ? computeMatchSettlement(round.scores, hcps, t1, t2, round.stakes, round.autoPress, round.pressAt, allHoles, numHoles)
    : null;

  const skinResults = !isMatchPlay && !is531 && !isWolf ? computeSkins(round.scores, hcps, round.players.map((p) => p.id), holes) : [];
  const skinsWon: Record<number, number> = {};
  round.players.forEach((p) => (skinsWon[p.id] = 0));
  skinResults.forEach((r) => {
    if (r.winner != null) skinsWon[r.winner] = (skinsWon[r.winner] ?? 0) + (r.skinsWon ?? 0);
  });
  const perSkin = round.skinValue * Math.max(0, round.players.length - 1);
  const skinsSettlement = !isMatchPlay && !is531 && !isWolf ? { skinResults, skinsWon, perSkin } : null;

  const five31Results = is531 && round.players.length === 3
    ? computeFiveThreeOne(round.scores, hcps, round.players.map((p) => p.id), holes)
    : [];
  const five31Settlement =
    five31Results.length === 3 && round.five31Mode != null && round.five31Value != null
      ? fiveThreeOneSettlement(
          five31Results,
          round.five31Mode,
          round.five31Value
        )
      : [];

  const wolfNet =
    isWolf && round.wolfValue != null && round.wolfDecisions
      ? calculateWolf(
          round.players,
          round.scores,
          round.wolfDecisions,
          holes,
          hcps,
          round.wolfValue
        )
      : null;

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
  } else if (is531 && five31Settlement.length > 0) {
    five31Settlement.forEach((r) => {
      netPerPlayer[r.playerId] = r.net + Math.round(sbNet[r.playerId] ?? 0);
    });
    round.players.forEach((p) => {
      if (netPerPlayer[p.id] == null) netPerPlayer[p.id] = Math.round(sbNet[p.id] ?? 0);
    });
  } else if (isWolf && wolfNet) {
    round.players.forEach((p) => {
      netPerPlayer[p.id] = Math.round((wolfNet[p.id] ?? 0) + (sbNet[p.id] ?? 0));
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
    { ...round, courseName: selectedCourse?.name ?? 'Course' },
    settlement,
    skinsSettlement,
    sideBetWinners as Record<string | number, number | undefined>,
    {
      netPerPlayer,
      matchContrib,
      sbNet,
      birdieCounts: birdieCounts ?? undefined,
      five31Results: is531 ? five31Results : undefined,
      wolfNet: isWolf ? wolfNet ?? undefined : undefined,
      highlights,
      dateStr: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
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
  const shareScorecard = () => {
    const message = buildScorecardShareText({
      round: { tee: round.tee, gameStyle: round.gameStyle },
      courseName: selectedCourse?.name ?? 'Course',
      players: round.players,
      scores: round.scores,
      hcps,
      holes,
    });
    Share.share({ message, title: 'Scorecard' });
  };

  const totalPot = Math.round(
    Object.values(netPerPlayer).reduce((sum, n) => sum + Math.max(0, n), 0)
  );
  const highlights = [
    getBiggestMoment(round.players, round.scores, holes),
    getBiggestChoke(round.players, round.scores, holes, hcps),
    getMomentumSwing(round.players, round.scores, holes, round.gameStyle, {
      t1ids: t1,
      t2ids: t2,
      hcps,
      skinResults: skinsSettlement?.skinResults,
    }),
  ];

  useEffect(() => {
    const entry = {
      date: new Date().toISOString(),
      courseName: selectedCourse?.name ?? 'Course',
      gameStyle: round.gameStyle,
      players: round.players.map((p) => ({
        name: p.name,
        netAmount: netPerPlayer[p.id] ?? 0,
      })),
      totalPot,
    };
    AsyncStorage.setItem(`history:${Date.now()}`, JSON.stringify(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save once on mount
  }, []);

  const handleShareResults = () => {
    Share.share({ message: msgText, title: 'square18 Results' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>⛳</Text>
        <Text style={styles.heroTitle}>You're Square.</Text>
        <Text style={styles.heroSub}>
          {selectedCourse?.name ?? 'Course'} · {round.tee} tees · {isMatchPlay ? 'Match Play' : is531 ? '5-3-1' : isWolf ? 'Wolf' : 'Skins'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.shareScorecardBtn} onPress={shareScorecard}>
          <Text style={styles.shareScorecardBtnText}>Share Scorecard</Text>
        </Pressable>
        {isWolf && wolfNet && (
          <>
            <SectionLabel>Wolf Results</SectionLabel>
            <Card accent={Colors.gold} style={styles.card}>
              {round.players
                .slice()
                .sort((a, b) => (wolfNet[b.id] ?? 0) - (wolfNet[a.id] ?? 0))
                .map((p) => (
                  <View key={p.id} style={styles.skinRow}>
                    <View style={styles.skinLeft}>
                      <Text style={[styles.skinName, (wolfNet[p.id] ?? 0) > 0 && styles.skinNameBold]}>{p.name}</Text>
                    </View>
                    <Text style={[styles.skinAmt, (wolfNet[p.id] ?? 0) > 0 && styles.skinAmtGreen, (wolfNet[p.id] ?? 0) < 0 && styles.resultLose]}>
                      {(wolfNet[p.id] ?? 0) >= 0 ? '+' : ''}{Math.round(wolfNet[p.id] ?? 0)}
                    </Text>
                  </View>
                ))}
            </Card>
          </>
        )}

        {is531 && five31Results.length === 3 && (
          <>
            <SectionLabel>5-3-1 Results</SectionLabel>
            <Card accent={Colors.forest} style={styles.card}>
              {five31Results
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((r, i) => {
                  const player = round.players.find((p) => p.id === r.playerId);
                  if (!player) return null;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <View key={r.playerId} style={styles.skinRow}>
                      <View style={styles.skinLeft}>
                        <Text>{medals[i]}</Text>
                        <Text style={styles.skinName}>{player.name}</Text>
                      </View>
                      <Text style={styles.five31Pts}>{r.points} pts</Text>
                    </View>
                  );
                })}
            </Card>
          </>
        )}

        {isMatchPlay && settlement && (
          <>
            <SectionLabel>Match Results</SectionLabel>
            <Card accent={Colors.forest} style={styles.card}>
              {(
                numHoles === 'front9'
                  ? [['Front 9', settlement.front.result, settlement.fAmt]]
                  : numHoles === 'back9'
                    ? [['Back 9', settlement.back.result, settlement.bAmt]]
                    : [
                        ['Front 9', settlement.front.result, settlement.fAmt],
                        ['Back 9', settlement.back.result, settlement.bAmt],
                        ['Overall', settlement.total.result, settlement.tAmt],
                      ]
              ).map(([label, result, amt]) => (
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

        {highlights.filter((h): h is NonNullable<typeof h> => h != null).length > 0 && (
          <>
            <SectionLabel>Highlights</SectionLabel>
            <Card style={styles.card}>
              {highlights.filter((h): h is NonNullable<typeof h> => h != null).map((h, i) => (
                <View key={i} style={styles.highlightRow}>
                  <Text style={styles.highlightEmoji}>{h.emoji}</Text>
                  <View style={styles.highlightText}>
                    <Text style={styles.highlightLabel}>{h.label.replace(h.emoji, '').trim()}</Text>
                    <Text style={styles.highlightDetail}>{h.detail}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {round.sideBets.some((sb) => sb.type !== 'birdie' && !sideBetWinners[sb.id]) && (
          <Card style={styles.sideBetCard}>
            <Text style={styles.sideBetTitle}>Pick winners for side bets</Text>
            {round.sideBets
              .filter((sb) => sb.type !== 'birdie' && !sideBetWinners[sb.id])
              .map((sb) => {
                const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
                return (
                  <View key={sb.id} style={styles.winnerPickRow}>
                    <Text style={styles.whoWon}>{type?.label}{sb.hole != null ? ` (Hole ${sb.hole})` : ''}</Text>
                    <View style={styles.winnerChips}>
                      {round.players.map((p) => (
                        <Pressable key={p.id} style={styles.winnerChip} onPress={() => setSideBetWinner(sb.id, p.id)}>
                          <Text style={styles.winnerChipText}>{p.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
          </Card>
        )}

        <SectionLabel>Settle Up</SectionLabel>
        <Card style={styles.settleCard}>
          {round.players
            .slice()
            .sort((a, b) => (netPerPlayer[b.id] ?? 0) - (netPerPlayer[a.id] ?? 0))
            .map((p) => (
              <View key={p.id} style={styles.settleNetRow}>
                <Text style={styles.settleNetName}>{p.id === scorekeeperId ? 'You' : p.name}</Text>
                <Text style={[styles.settleNetAmt, (netPerPlayer[p.id] ?? 0) > 0 && styles.skinAmtGreen, (netPerPlayer[p.id] ?? 0) < 0 && styles.resultLose]}>
                  {(netPerPlayer[p.id] ?? 0) >= 0 ? '+' : ''}{netPerPlayer[p.id] ?? 0}
                </Text>
              </View>
            ))}
        </Card>
        {(() => {
          const transactions = minTransactions(netPerPlayer);
          const note = `square18 @${selectedCourse?.name ?? 'Course'}`;
          const scorekeeperTx = transactions.filter(
            (t) => t.fromId === scorekeeperId || t.toId === scorekeeperId
          );
          const otherTx = transactions.filter(
            (t) => t.fromId !== scorekeeperId && t.toId !== scorekeeperId
          );
          if (transactions.length === 0) {
            return (
              <Card accent={Colors.grayLight}>
                <Text style={styles.evenText}>Everyone is square. 🤝</Text>
              </Card>
            );
          }
          const getPlayer = (id: number) => round.players.find((p) => p.id === id);
          const showVenmoButtons = round.players.length === 2;
          return (
            <>
              {showVenmoButtons ? (
                scorekeeperTx.map((t, i) => {
                  const otherId = t.fromId === scorekeeperId ? t.toId : t.fromId;
                  const owesYou = t.toId === scorekeeperId;
                  const other = getPlayer(otherId);
                  if (!other) return null;
                  return (
                    <Card
                      key={`sk-${i}`}
                      accent={owesYou ? Colors.redLight : Colors.forest}
                      style={styles.settleCard}
                    >
                      <View style={styles.settleHeader}>
                        <Text style={styles.payerName}>
                          {owesYou ? `${other.name} owes You $${t.amount}` : `You owe ${other.name} $${t.amount}`}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.venmoBtn}
                        onPress={() =>
                          openVenmo(
                            venmoDeepLink(other.venmo, t.amount, note, owesYou ? 'request' : 'pay')
                          )
                        }
                      >
                        <Text style={styles.venmoBtnText}>
                          {owesYou ? `Request $${t.amount} from ${other.name}` : `Pay ${other.name} $${t.amount}`}
                        </Text>
                      </Pressable>
                    </Card>
                  );
                })
              ) : (
                <Card style={styles.settleCard}>
                  {transactions.map((t, i) => {
                    const from = getPlayer(t.fromId);
                    const to = getPlayer(t.toId);
                    if (!from || !to) return null;
                    const fromLabel = from.id === scorekeeperId ? 'You' : from.name;
                    const toLabel = to.id === scorekeeperId ? 'You' : to.name;
                    return (
                      <Text key={i} style={styles.otherDebtText}>
                        {fromLabel} owes {toLabel} ${t.amount}
                      </Text>
                    );
                  })}
                </Card>
              )}
            </>
          );
        })()}

        <View style={styles.sendSection}>
          <Pressable style={styles.shareResultsBtn} onPress={handleShareResults}>
            <Text style={styles.shareResultsBtnText}>Share Results 🏌️</Text>
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
  shareScorecardBtn: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.forest,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareScorecardBtnText: { fontSize: 14, fontWeight: '700', color: Colors.cream },
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
  settleUpNote: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settleUpNoteText: {
    fontSize: 12,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  settleCard: { marginBottom: 12 },
  settleNetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  settleNetName: { fontSize: 15, fontWeight: '600' },
  settleNetAmt: { fontSize: 16, fontWeight: '700', color: Colors.gray },
  settleHeader: { marginBottom: 10 },
  winnerPickRow: { marginBottom: 12 },
  payerName: { fontWeight: '700', fontSize: 15 },
  owes: { color: Colors.red, fontSize: 18, fontWeight: '700' },
  owesSub: { color: Colors.gray, fontSize: 11, marginTop: 2 },
  otherDebtText: { fontSize: 14, color: Colors.ink, marginBottom: 4 },
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
  five31Pts: { fontSize: 18, fontWeight: '700', color: Colors.forest },
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
  shareResultsBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 14,
    backgroundColor: Colors.forest,
    borderRadius: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  shareResultsBtnText: { fontSize: 16, fontWeight: '700', color: Colors.cream },
  highlightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  highlightEmoji: { fontSize: 24, marginRight: 10 },
  highlightText: { flex: 1 },
  highlightLabel: { fontSize: 14, fontWeight: '700', color: Colors.ink },
  highlightDetail: { fontSize: 13, color: Colors.gray, marginTop: 2 },
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
