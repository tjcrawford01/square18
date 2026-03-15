import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert, Share } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoundStore } from '../src/store/roundStore';
import { useCourseStore } from '../src/store/courseStore';
import { getTeeOrDefault, getHolesForTee } from '../src/types/course';
import { SIDE_BET_TYPES } from '../src/data/sideBetTypes';
import { courseHandicap, playingHandicaps } from '../src/engine/handicap';
import { computeMatchSettlement } from '../src/engine/matchPlay';
import { computeSkins, computeSkinsNet } from '../src/engine/skins';
import { computeFiveThreeOne, fiveThreeOneSettlement } from '../src/engine/fiveThreeOne';
import { calculateWolf } from '../src/engine/wolf';
import { countBirdies, computeBirdiePoolResult } from '../src/engine/birdies';
import { computeSideBetNet } from '../src/engine/sideBets';
import { getBiggestMoment, getBiggestChoke, getMomentumSwing } from '../src/engine/highlights';
import { buildSettlementText, minTransactions, venmoDeepLink, venmoLink } from '../src/engine/settlement';
import { Card } from '../src/components/Card';
import { SectionLabel } from '../src/components/SectionLabel';
import { ScorecardModal } from '../src/components/ScorecardModal';
import { Colors } from '../src/theme/colors';

export default function SettlementScreen() {
  const router = useRouter();
  const { round, sideBetWinners, setSideBetWinner, resetRound } = useRoundStore();
  const [scorecardVisible, setScorecardVisible] = useState(false);
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
  const is2v2 = isMatchPlay && round.players.length === 4 && round.teams?.[0]?.playerIds?.length === 2 && round.teams?.[1]?.playerIds?.length === 2;
  const birdiePoolResult = birdiePool && birdieCounts
    ? computeBirdiePoolResult(birdieCounts, round.players.map((p) => p.id), birdiePool.amount, is2v2 ? round.teams : undefined)
    : null;

  const nonBirdieSideBets = round.sideBets.filter((sb) => sb.type !== 'birdie');
  const sbNet = computeSideBetNet(
    nonBirdieSideBets,
    sideBetWinners as Record<string | number, number | undefined>,
    round.players,
    is2v2 ? round.teams : undefined
  );
  if (birdiePoolResult) {
    round.players.forEach((p) => {
      sbNet[p.id] = (sbNet[p.id] ?? 0) + (birdiePoolResult.netPerPlayer[p.id] ?? 0);
    });
  }

  const scorekeeperId = round.players[0]?.id;
  const matchContrib: Record<number, number> = {};
  round.players.forEach((p) => {
    if (isMatchPlay && settlement) {
      const onT1 = t1.includes(p.id);
      const teamSize = onT1 ? t1.length : t2.length;
      const opponentCount = onT1 ? t2.length : t1.length;
      // settlement.net is per-person; team total = net × opponents; per player = total / teamSize
      const sign = onT1 ? Math.sign(settlement.net) : -Math.sign(settlement.net);
      matchContrib[p.id] = sign * Math.abs(settlement.net) * opponentCount / Math.max(1, teamSize);
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
    const skinsNet = computeSkinsNet(
      skinsSettlement.skinsWon,
      round.players.map((p) => p.id),
      round.skinValue,
    );
    round.players.forEach((p) => {
      netPerPlayer[p.id] = Math.round((skinsNet[p.id] ?? 0) + (sbNet[p.id] ?? 0));
    });
  } else {
    round.players.forEach((p) => {
      netPerPlayer[p.id] = Math.round(sbNet[p.id] ?? 0);
    });
  }

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
      birdiePoolResult: birdiePoolResult ?? undefined,
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

  const totalPot = Math.round(
    Object.values(netPerPlayer).reduce((sum, n) => sum + Math.max(0, n), 0)
  );

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
        {isMatchPlay && (
          <Text style={styles.heroMatchup}>{getNames(t1)} vs {getNames(t2)}</Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.shareScorecardBtn} onPress={() => setScorecardVisible(true)}>
          <Text style={styles.shareScorecardBtnText}>View Scorecard</Text>
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
                    <Text style={[styles.skinAmt, (wolfNet[p.id] ?? 0) > 0 && styles.skinAmtGreen, (wolfNet[p.id] ?? 0) < 0 && styles.settleNetLose]}>
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
              {(() => {
                const matchRows = numHoles === 'front9'
                  ? [['Front 9', settlement.front.result, settlement.fAmt]]
                  : numHoles === 'back9'
                    ? [['Back 9', settlement.back.result, settlement.bAmt]]
                    : [
                        ['Front 9', settlement.front.result, settlement.fAmt],
                        ['Back 9', settlement.back.result, settlement.bAmt],
                        ['Overall', settlement.total.result, settlement.tAmt],
                      ];
                let displayedTotal = 0;
                return (
                  <>
                    {matchRows.map(([label, result, amt]) => {
                      const displayAmt = result === 0 ? 0 : Math.abs(amt) * (is2v2 ? 2 : 1);
                      displayedTotal += Math.sign(result) * displayAmt;
                      return (
                        <View key={String(label)} style={styles.resultRow}>
                          <Text style={styles.resultLabel}>{label}</Text>
                          <Text style={[styles.resultMid, result === 0 && styles.resultTied, (result > 0 || result < 0) && styles.resultWin]}>
                            {result === 0 ? 'Tied' : result > 0 ? `${getNames(t1)} ${is2v2 ? 'win' : 'wins'}` : `${getNames(t2)} ${is2v2 ? 'win' : 'wins'}`}
                          </Text>
                          <Text style={[styles.resultAmt, result === 0 && styles.resultTied]}>{result === 0 ? '$0' : `$${displayAmt}`}</Text>
                        </View>
                      );
                    })}
                    {settlement.pressDetails.map((p, i) => {
                      const pressDisplayAmt = p.result === 0 ? 0 : Math.abs(p.amt) * (is2v2 ? 2 : 1);
                      displayedTotal += Math.sign(p.result) * pressDisplayAmt;
                      return (
                        <View key={i} style={styles.resultRow}>
                          <Text style={styles.resultLabel}>🔁 Press H{p.startHole}</Text>
                          <Text style={[styles.resultMid, p.result === 0 && styles.resultTied, (p.result > 0 || p.result < 0) && styles.resultWin]}>
                            {p.result === 0 ? 'Tied' : p.result > 0 ? `${getNames(t1)} ${is2v2 ? 'win' : 'wins'}` : `${getNames(t2)} ${is2v2 ? 'win' : 'wins'}`}
                          </Text>
                          <Text style={[styles.resultAmt, p.result === 0 && styles.resultTied]}>{p.result === 0 ? '$0' : `$${pressDisplayAmt}`}</Text>
                        </View>
                      );
                    })}
                    {round.sideBets
                      .filter((sb) => sb.type !== 'birdie' && sideBetWinners[sb.id] != null)
                      .map((sb) => {
                        const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
                        const winnerId = sideBetWinners[sb.id];
                        const winner = winnerId ? round.players.find((p) => p.id === winnerId) : null;
                        const winnerTeam = winnerId && is2v2 ? round.teams.find((t) => t.playerIds.includes(winnerId)) : null;
                        const sbAmt = is2v2 && winnerTeam
                          ? sb.amount * (round.players.length - winnerTeam.playerIds.length)
                          : sb.amount * (round.players.length - 1);
                        const t1WonSb = winnerTeam === round.teams[0];
                        displayedTotal += winnerTeam ? (t1WonSb ? sbAmt : -sbAmt) : 0;
                        const winnerLabel = is2v2 && winnerTeam ? getNames(winnerTeam.playerIds) : (winner?.name ?? '?');
                        const winVerb = is2v2 && winnerTeam ? 'win' : 'wins';
                        return (
                          <View key={sb.id} style={styles.resultRow}>
                            <Text style={styles.resultLabel}>
                              🏅 {type?.label}{sb.hole != null ? ` H${sb.hole}` : ''}
                            </Text>
                            <Text style={[styles.resultMid, styles.resultWin]}>
                              {winnerLabel} {winVerb}
                            </Text>
                            <Text style={styles.resultAmt}>${sbAmt}</Text>
                          </View>
                        );
                      })}
                    {birdiePool && birdiePoolResult && (() => {
                      const bpAmt = birdiePoolResult.winnerIds.length === 0 ? 0 : (is2v2 && birdiePoolResult.winnerIds.length > 0
                        ? birdiePool.amount
                        : birdiePool.amount * (round.players.length - birdiePoolResult.winnerIds.length));
                      const bpWinnerTeam = is2v2 && birdiePoolResult.winnerIds.length > 0
                        ? round.teams.find((t) => birdiePoolResult!.winnerIds.every((id) => t.playerIds.includes(id)))
                        : null;
                      displayedTotal += bpWinnerTeam ? (bpWinnerTeam === round.teams[0] ? bpAmt : -bpAmt) : 0;
                      return (
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>🏅 Birdie Pool</Text>
                          <Text style={[styles.resultMid, birdiePoolResult.winnerIds.length > 0 && styles.resultWin]}>
                            {birdiePoolResult.winnerIds.length === 0
                              ? (birdiePoolResult.birdieCount === 0 ? 'No birdies 🕳️' : (is2v2 ? 'Tied' : 'No birdies 🕳️'))
                              : (is2v2 && birdiePoolResult.winnerIds.length > 0 && (() => {
                                  const wt = round.teams.find((t) =>
                                    birdiePoolResult!.winnerIds.every((id) => t.playerIds.includes(id))
                                  );
                                  return wt ? `${getNames(wt.playerIds)} win` : null;
                                })()) ?? (birdiePoolResult.winnerIds.length === 1
                                ? `${round.players.find((p) => p.id === birdiePoolResult.winnerIds[0])?.name ?? '?'} wins`
                                : `${birdiePoolResult.winnerIds.map((id) => round.players.find((p) => p.id === id)?.name ?? '?').join(' and ')} split`)}
                          </Text>
                          <Text style={styles.resultAmt}>${bpAmt}</Text>
                        </View>
                      );
                    })()}
                    <View style={styles.netRow}>
                      <Text style={styles.netLabel}>
                        {displayedTotal === 0 ? 'All Square' : displayedTotal > 0 ? `${getNames(t1)} ${is2v2 ? 'win' : 'wins'}` : `${getNames(t2)} ${is2v2 ? 'win' : 'wins'}`}
                      </Text>
                      <Text style={styles.netAmt}>${Math.round(Math.abs(displayedTotal))}</Text>
                    </View>
                  </>
                );
              })()}
            </Card>

          </>
        )}

        {!isMatchPlay && skinsSettlement && (
          <>
            <SectionLabel>Skins Leaderboard</SectionLabel>
            <Card accent={Colors.gold} style={styles.card}>
              {(() => {
                const maxSkins = Math.max(...round.players.map((p) => skinsWon[p.id]), 0);
                return round.players
                  .slice()
                  .sort((a, b) => skinsWon[b.id] - skinsWon[a.id])
                  .map((p, i) => (
                    <View key={p.id} style={styles.skinRow}>
                      <View style={styles.skinLeft}>
                        {skinsWon[p.id] === maxSkins && maxSkins > 0 && <Text>🏆</Text>}
                        <Text style={[styles.skinName, i === 0 && styles.skinNameBold]}>{p.name}</Text>
                    </View>
                    <View style={styles.skinRight}>
                      <Text style={styles.skinCount}>{skinsWon[p.id]} skin{skinsWon[p.id] !== 1 ? 's' : ''}</Text>
                      <Text style={[styles.skinAmt, skinsWon[p.id] > 0 && styles.skinAmtGreen]}>${skinsWon[p.id] * perSkin}</Text>
                    </View>
                  </View>
                ));
              })()}
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
                      {winner ? `${winner.name}${(r.skinsWon ?? 0) > 1 ? ` (${r.skinsWon})` : ''}` : r.tied ? 'Tied —' : '—'}
                    </Text>
                    <Text style={[styles.holeAmt, winner && styles.skinAmtGreen]}>{winner ? `$${(r.skinsWon ?? 0) * perSkin}` : 'carry'}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {!isMatchPlay && round.sideBets.length > 0 && (
          <>
            <SectionLabel>Side Bets</SectionLabel>
            <Card accent={Colors.forest} style={styles.card}>
              {round.sideBets
                .filter((sb) => sb.type !== 'birdie' && sideBetWinners[sb.id] != null)
                .map((sb) => {
                  const type = SIDE_BET_TYPES.find((t) => t.id === sb.type);
                  const winnerId = sideBetWinners[sb.id];
                  const winner = winnerId ? round.players.find((p) => p.id === winnerId) : null;
                  const amt = sb.amount * (round.players.length - 1);
                  return (
                    <View key={sb.id} style={styles.resultRow}>
                      <Text style={styles.resultLabel}>🏅 {type?.label}{sb.hole != null ? ` H${sb.hole}` : ''}</Text>
                      <Text style={[styles.resultMid, styles.resultWin]}>{winner?.name ?? '?'} wins</Text>
                      <Text style={styles.resultAmt}>${amt}</Text>
                    </View>
                  );
                })}
              {birdiePool && birdiePoolResult && (
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>🏅 Birdie Pool</Text>
                  <Text style={[styles.resultMid, birdiePoolResult.winnerIds.length > 0 && styles.resultWin]}>
                    {birdiePoolResult.winnerIds.length === 0
                      ? 'No birdies 🕳️'
                      : birdiePoolResult.winnerIds.length === 1
                        ? `${round.players.find((p) => p.id === birdiePoolResult.winnerIds[0])?.name ?? '?'} wins`
                        : `${birdiePoolResult.winnerIds.map((id) => round.players.find((p) => p.id === id)?.name ?? '?').join(' and ')} split`}
                  </Text>
                  <Text style={styles.resultAmt}>
                    {birdiePoolResult.winnerIds.length === 0 ? '$0' : `$${birdiePool.amount * (round.players.length - birdiePoolResult.winnerIds.length)}`}
                  </Text>
                </View>
              )}
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

        {round.players.length === 2 && (() => {
          const transactions = minTransactions(netPerPlayer);
          const note = `square18 @${selectedCourse?.name ?? 'Course'}`;
          const scorekeeperTx = transactions.filter(
            (t) => t.fromId === scorekeeperId || t.toId === scorekeeperId
          );
          if (transactions.length === 0) {
            return (
              <Card accent={Colors.grayLight} style={styles.settleCard}>
                <Text style={styles.evenText}>Everyone is square. 🤝</Text>
              </Card>
            );
          }
          const getPlayer = (id: number) => round.players.find((p) => p.id === id);
          return (
            <>
              <SectionLabel>Settle Up</SectionLabel>
              {scorekeeperTx.map((t, i) => {
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
                    <Text style={styles.payerName}>
                      {owesYou ? `${other.name} owes you $${t.amount}` : `You owe ${other.name} $${t.amount}`}
                    </Text>
                    <Pressable
                      style={[styles.venmoBtn, styles.venmoBtnSpaced]}
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
              })}
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
      <ScorecardModal
        visible={scorecardVisible}
        onClose={() => setScorecardVisible(false)}
        round={{ tee: round.tee, gameStyle: round.gameStyle, numHoles: round.numHoles }}
        courseName={selectedCourse?.name ?? 'Course'}
        players={round.players}
        scores={round.scores}
        hcps={hcps}
        holes={holes}
        wolfDecisions={round.gameStyle === 'wolf' ? round.wolfDecisions : undefined}
      />
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
  heroMatchup: { color: Colors.rough, fontSize: 14, fontWeight: '700', marginTop: 8 },
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
  resultRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  resultLabel: { flex: 2, color: Colors.gray, fontSize: 13 },
  resultMid: { flex: 3, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  resultTied: { color: Colors.gray },
  resultWin: { color: Colors.fairway },
  settleNetLose: { color: Colors.gray },
  resultAmt: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.gold, textAlign: 'right' },
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
  venmoBtnSpaced: { marginTop: 16 },
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
