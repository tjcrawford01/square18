import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRoundStore } from '../../src/store/roundStore';
import { useCourseStore } from '../../src/store/courseStore';
import { getTeeOrDefault, getHolesForTee } from '../../src/types/course';
import { SIDE_BET_TYPES } from '../../src/data/sideBetTypes';
import { courseHandicap, playingHandicaps, strokesOnHole } from '../../src/engine/handicap';
import { computeSkins } from '../../src/engine/skins';
import { computeFiveThreeOne } from '../../src/engine/fiveThreeOne';
import { Card } from '../../src/components/Card';
import { SectionLabel } from '../../src/components/SectionLabel';
import { ScoreboardPanel } from '../../src/components/ScoreboardPanel';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { ScorecardModal } from '../../src/components/ScorecardModal';
import { Colors } from '../../src/theme/colors';

type PopupMode = 'remind' | 'winner';
interface PopupState {
  mode: PopupMode;
  bets: { id: number; type: string; hole: number | null; amount: number }[];
  index: number;
  nextHole?: number;
}

export default function HoleScreen() {
  const params = useLocalSearchParams<{ hole: string }>();
  const holeNum = Math.min(18, Math.max(1, parseInt(params.hole ?? '1', 10) || 1));
  const router = useRouter();
  const { round, scores, setScores, setCurrentHole, sideBetWinners, setSideBetWinner } = useRoundStore();
  const selectedCourse = useCourseStore((s) => s.selectedCourse);
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [scorecardVisible, setScorecardVisible] = useState(false);

  useEffect(() => {
    setCurrentHole(holeNum);
  }, [holeNum, setCurrentHole]);

  const tee = getTeeOrDefault(selectedCourse, round.tee);
  const holes = getHolesForTee(selectedCourse, round.tee);
  const hd = holes[holeNum - 1] ?? { hole: holeNum, par: 4, si: holeNum, yards: 0 };

  const courseHcps: Record<number, number> = {};
  if (tee) {
    round.players.forEach((p) => {
      courseHcps[p.id] = courseHandicap(p.index ?? 0, tee);
    });
  }
  const hcps = playingHandicaps(courseHcps, round.gameStyle === 'matchplay');

  const setScore = (pid: number, score: number) => {
    const ns = {
      ...scores,
      [pid]: { ...(scores[pid] ?? {}), [holeNum]: score },
    };
    setScores(ns);
    const nowAllScored = round.players.every((p) => (p.id === pid ? score : scores[p.id]?.[holeNum]) != null);
    if (nowAllScored && !popup) {
      const pending = round.sideBets.filter(
        (sb) => sb.hole === holeNum && sb.type !== 'birdie' && sideBetWinners[sb.id] == null
      );
      if (pending.length > 0) setPopup({ mode: 'winner', bets: pending, index: 0 });
    }
  };

  const allScored = round.players.every((p) => scores[p.id]?.[holeNum] != null);
  const sideBetsHere = round.sideBets.filter((sb) => sb.hole === holeNum);
  const skinResults = round.gameStyle === 'skins' ? computeSkins(scores, hcps, round.players.map((p) => p.id), holes) : [];
  const carryHere = skinResults.find((r) => r.hole === holeNum)?.carryover ?? 0;
  const five31Results =
    round.gameStyle === 'fivethreeone' && round.players.length === 3
      ? computeFiveThreeOne(scores, hcps, round.players.map((p) => p.id), holes)
      : [];

  const goNext = () => {
    if (!allScored) return;
    const nextHole = holeNum + 1;
    if (nextHole > 18) {
      router.replace('/settlement');
      return;
    }
    const upcoming = round.sideBets.filter((sb) => sb.hole === nextHole && sb.type !== 'birdie');
    if (upcoming.length > 0) {
      setPopup({ mode: 'remind', bets: upcoming, index: 0, nextHole });
    } else {
      router.push(`/round/${nextHole}`);
    }
  };

  const advanceOrClose = () => {
    if (!popup) return;
    const nextIndex = popup.index + 1;
    if (nextIndex < popup.bets.length) {
      setPopup({ ...popup, index: nextIndex });
    } else {
      if (popup.mode === 'remind' && popup.nextHole) router.push(`/round/${popup.nextHole}`);
      setPopup(null);
    }
  };

  const currentSb = popup?.bets[popup.index];
  const sbType = currentSb ? SIDE_BET_TYPES.find((t) => t.id === currentSb.type) : null;
  const pot = currentSb ? currentSb.amount * round.players.length : 0;
  const chosenWinner = currentSb ? sideBetWinners[currentSb.id] : undefined;
  const winnerPlayer = chosenWinner ? round.players.find((p) => p.id === chosenWinner) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>HOLE</Text>
          <Text style={styles.headerValue}>{holeNum}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>PAR</Text>
          <Text style={styles.headerValue}>{hd.par}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>SI</Text>
          <Text style={[styles.headerValue, styles.siValue]}>{hd.si}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerLabel}>YDS</Text>
          <Text style={styles.headerYds}>{hd.yards}</Text>
        </View>
        <HamburgerMenu
          showViewScorecard
          onViewScorecard={() => setScorecardVisible(true)}
          renderTrigger={(openMenu) => (
            <Pressable onPress={openMenu} style={styles.hamburgerBtn} hitSlop={8}>
              <Text style={styles.hamburgerText}>≡</Text>
            </Pressable>
          )}
        />
      </View>
      <View style={styles.dots}>
        {holes.map((h) => (
          <Pressable
            key={h.hole}
            onPress={() => router.push(`/round/${h.hole}`)}
            style={[
              styles.dot,
              h.hole < holeNum && styles.dotDone,
              h.hole === holeNum && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      {sideBetsHere.length > 0 && (
        <View style={styles.sideBetBanner}>
          <Text>🏅</Text>
          <Text style={styles.sideBetBannerText}>
            {sideBetsHere
              .map((sb) => {
                const t = SIDE_BET_TYPES.find((x) => x.id === sb.type);
                return `${t?.label} · $${sb.amount * round.players.length} pot`;
              })
              .join('  ·  ')}
          </Text>
        </View>
      )}
      {round.gameStyle === 'skins' && carryHere > 0 && (
        <View style={styles.carryBanner}>
          <Text>🔥</Text>
          <Text style={styles.carryBannerText}>
            {carryHere} skin{carryHere > 1 ? 's' : ''} carrying in — ${(carryHere + 1) * round.skinValue * round.players.length} on the line
          </Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionLabel>Enter Scores — Hole {holeNum}</SectionLabel>
        {round.players.map((player, i) => {
          const gs = scores[player.id]?.[holeNum];
          const strokes = strokesOnHole(hcps[player.id], hd.si);
          return (
            <Card key={player.id} accent={gs != null ? Colors.forest : Colors.grayLight} style={styles.scoreCard}>
              <View style={styles.scoreCardRow}>
                <View style={[styles.avatar, i === 0 ? styles.avatarFirst : styles.avatarOther]}>
                  <Text style={[styles.avatarText, i === 0 && styles.avatarTextFirst]}>{player.initials}</Text>
                </View>
                <View style={styles.scoreCardInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <View style={styles.chRow}>
                    <Text style={styles.chText}>CH {hcps[player.id]}</Text>
                    {strokes > 0 && (
                      <View style={styles.strokesBadge}>
                        <Text style={styles.strokesText}>{'●'.repeat(strokes)} +{strokes}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {gs != null && (
                  <Text
                    style={[
                      styles.relativeScore,
                      gs - hd.par < 0 && styles.relativeUnder,
                      gs - hd.par === 0 && styles.relativeEven,
                      gs - hd.par > 0 && styles.relativeOver,
                    ]}
                  >
                    {gs - hd.par === 0 ? 'E' : gs - hd.par > 0 ? `+${gs - hd.par}` : gs - hd.par}
                  </Text>
                )}
              </View>
              <View style={styles.scoreBtns}>
                {[hd.par - 1, hd.par, hd.par + 1, hd.par + 2, hd.par + 3].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setScore(player.id, s)}
                    style={[styles.scoreBtn, gs === s && styles.scoreBtnActive]}
                  >
                    <Text style={[styles.scoreBtnText, gs === s && styles.scoreBtnTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {holeNum > 1 && round.gameStyle !== 'fivethreeone' && (
        <ScoreboardPanel round={round} scores={scores} hcps={hcps} currentHole={holeNum} holes={holes} />
      )}
      {holeNum > 1 && round.gameStyle === 'fivethreeone' && five31Results.length === 3 && (
        <View style={styles.five31Panel}>
          <Text style={styles.five31Title}>
            5-3-1 STANDINGS  (through H{Math.min(holeNum, 18)})
          </Text>
          {five31Results
            .slice()
            .sort((a, b) => b.points - a.points)
            .map((r, i) => {
              const player = round.players.find((p) => p.id === r.playerId);
              if (!player) return null;
              const medals = ['🥇', '🥈', '🥉'];
              const needHint = i === 2 && holeNum >= 9;
              return (
                <View key={r.playerId} style={styles.five31Row}>
                  <Text style={styles.five31Medal}>{medals[i]}</Text>
                  <Text style={styles.five31Name}>{player.name}</Text>
                  <Text style={styles.five31Pts}>{r.points} pts</Text>
                  {needHint && <Text style={styles.five31Hint}> (needs 5s)</Text>}
                </View>
              );
            })}
        </View>
      )}

      <View style={styles.footer}>
        {holeNum > 1 && (
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
        )}
        {holeNum < 18 ? (
          <Pressable
            style={[styles.nextBtn, !allScored && styles.nextBtnDisabled]}
            onPress={goNext}
            disabled={!allScored}
          >
            <Text style={[styles.nextBtnText, !allScored && styles.nextBtnTextDisabled]}>Next Hole →</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.finishBtn} onPress={() => router.replace('/settlement')}>
            <Text style={styles.finishBtnText}>Finish Round ⛳</Text>
          </Pressable>
        )}
      </View>

      <ScorecardModal
        visible={scorecardVisible}
        onClose={() => setScorecardVisible(false)}
        round={{ tee: round.tee, gameStyle: round.gameStyle }}
        courseName={selectedCourse?.name ?? 'Course'}
        players={round.players}
        scores={scores}
        hcps={hcps}
        holes={holes}
      />
      <Modal visible={popup != null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => {}}>
          <View style={[styles.modalSheet, popup?.mode === 'winner' && styles.modalSheetCream]}>
            {popup && currentSb && sbType && (
              <>
                {popup.mode === 'remind' ? (
                  <>
                    <Text style={styles.modalEmoji}>🏅</Text>
                    <Text style={styles.modalSubtitle}>SIDE BET — HOLE {popup.nextHole}</Text>
                    <Text style={styles.modalTitle}>{sbType.label}</Text>
                    <Text style={styles.modalPot}>${pot} pot</Text>
                    <Pressable style={styles.modalPrimaryBtn} onPress={advanceOrClose}>
                      <Text style={styles.modalPrimaryBtnText}>Got it — tee off 🏌️</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalEmoji}>🏅</Text>
                    <Text style={styles.modalSubtitleDark}>HOLE {holeNum} RESULT</Text>
                    <Text style={styles.modalTitleDark}>{sbType.label}</Text>
                    <Text style={styles.modalDescDark}>${pot} pot · who won it?</Text>
                    {!winnerPlayer ? (
                      <>
                        {round.players.map((p) => (
                          <Pressable
                            key={p.id}
                            style={styles.winnerBtn}
                            onPress={() => setSideBetWinner(currentSb.id, p.id)}
                          >
                            <Text style={styles.winnerBtnText}>{p.name}</Text>
                          </Pressable>
                        ))}
                        <Pressable onPress={advanceOrClose}>
                          <Text style={styles.decideEnd}>Decide at the end →</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View style={styles.winnerCard}>
                          <Text style={styles.winnerLabel}>WINNER</Text>
                          <Text style={styles.winnerName}>{winnerPlayer.name}</Text>
                          <Text style={styles.winnerPot}>+${pot}</Text>
                          <Text style={styles.winnerSub}>added to settlement</Text>
                        </View>
                        <Pressable onPress={() => setSideBetWinner(currentSb.id, undefined)}>
                          <Text style={styles.changeWinner}>← Change winner</Text>
                        </Pressable>
                        <Pressable style={styles.savedBtn} onPress={advanceOrClose}>
                          <Text style={styles.savedBtnText}>✓ Saved — Continue Round</Text>
                        </Pressable>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.cream },
  errorCard: {
    margin: 24,
    padding: 24,
    backgroundColor: Colors.parchment,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.sand,
    alignItems: 'center',
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.ink, marginBottom: 12 },
  errorBody: { fontSize: 14, color: Colors.gray, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  errorBtn: {
    backgroundColor: Colors.forest,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  errorBtnText: { fontSize: 16, fontWeight: '700', color: Colors.cream },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: Colors.forest,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerLabel: { color: Colors.rough, fontSize: 9, letterSpacing: 2 },
  headerValue: { color: Colors.cream, fontSize: 44, fontWeight: '700' },
  headerCenter: { alignItems: 'center' },
  headerRight: { alignItems: 'flex-end' },
  siValue: { color: Colors.sand },
  headerYds: { color: Colors.cream, fontSize: 26, fontWeight: '700' },
  hamburgerBtn: { padding: 4, marginLeft: 8 },
  hamburgerText: { color: Colors.cream, fontSize: 24, fontWeight: '700' },
  five31Panel: {
    backgroundColor: Colors.forest,
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 14,
    borderRadius: 10,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  five31Title: { color: Colors.rough, fontSize: 10, letterSpacing: 2, marginBottom: 10 },
  five31Row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  five31Medal: { marginRight: 8 },
  five31Name: { flex: 1, color: Colors.cream, fontWeight: '700', fontSize: 14 },
  five31Pts: { color: Colors.gold, fontWeight: '700', fontSize: 14 },
  five31Hint: { color: Colors.rough, fontSize: 11 },
  dots: { flexDirection: 'row', gap: 3, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: Colors.forest },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotDone: { backgroundColor: Colors.rough },
  dotCurrent: { backgroundColor: Colors.gold },
  sideBetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  sideBetBannerText: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  carryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.red,
    paddingVertical: 7,
    paddingHorizontal: 20,
  },
  carryBannerText: { fontSize: 12, fontWeight: '700', color: Colors.cream },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, paddingHorizontal: 20 },
  scoreCard: { marginBottom: 10 },
  scoreCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarFirst: { backgroundColor: Colors.forest, borderWidth: 2, borderColor: Colors.gold },
  avatarOther: { backgroundColor: Colors.parchment, borderWidth: 2, borderColor: Colors.grayLight },
  avatarText: { fontWeight: '700', fontSize: 12, color: Colors.ink },
  avatarTextFirst: { color: Colors.cream },
  scoreCardInfo: { flex: 1 },
  playerName: { fontSize: 14, fontWeight: '700' },
  chRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 2 },
  chText: { color: Colors.gray, fontSize: 11 },
  strokesBadge: { backgroundColor: Colors.gold, borderRadius: 4, paddingVertical: 1, paddingHorizontal: 6 },
  strokesText: { fontSize: 10, fontWeight: '700', color: Colors.ink },
  relativeScore: { fontSize: 14, fontWeight: '700' },
  relativeUnder: { color: Colors.fairway },
  relativeEven: { color: Colors.gray },
  relativeOver: { color: Colors.red },
  scoreBtns: { flexDirection: 'row', gap: 6 },
  scoreBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBtnActive: { borderColor: Colors.forest, backgroundColor: Colors.forest },
  scoreBtnText: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  scoreBtnTextActive: { color: Colors.cream },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.parchment,
  },
  backBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 2, borderColor: Colors.grayLight, alignItems: 'center' },
  backBtnText: { fontSize: 14, color: Colors.ink },
  nextBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: Colors.forest, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: Colors.gold },
  nextBtnDisabled: { backgroundColor: Colors.grayLight },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: Colors.cream },
  nextBtnTextDisabled: { color: Colors.gray },
  finishBtn: { flex: 2, paddingVertical: 13, borderRadius: 10, backgroundColor: Colors.gold, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: '#8a6a20' },
  finishBtnText: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end', alignItems: 'center' },
  modalSheet: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: Colors.forest,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 4,
    borderTopColor: Colors.gold,
  },
  modalSheetCream: { backgroundColor: Colors.cream },
  modalEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
  modalSubtitle: { color: Colors.rough, fontSize: 10, letterSpacing: 3, marginBottom: 6, textAlign: 'center' },
  modalTitle: { color: Colors.cream, fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  modalPot: { color: Colors.gold, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  modalPrimaryBtn: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#8a6a20',
  },
  modalPrimaryBtnText: { fontSize: 16, fontWeight: '700', color: Colors.ink },
  modalSubtitleDark: { color: Colors.gray, fontSize: 10, letterSpacing: 2, marginBottom: 4, textAlign: 'center' },
  modalTitleDark: { color: Colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  modalDescDark: { color: Colors.gray, fontSize: 13, marginTop: 4, textAlign: 'center' },
  winnerBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.grayLight,
    backgroundColor: Colors.white,
    alignItems: 'center',
    marginBottom: 8,
  },
  winnerBtnText: { fontSize: 15, fontWeight: '700', color: Colors.ink },
  decideEnd: { color: Colors.gray, fontSize: 13, marginTop: 4, textAlign: 'center' },
  winnerCard: {
    backgroundColor: Colors.forest,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  winnerLabel: { color: Colors.rough, fontSize: 10, letterSpacing: 2, marginBottom: 6 },
  winnerName: { color: Colors.cream, fontSize: 28, fontWeight: '700' },
  winnerPot: { color: Colors.gold, fontSize: 20, fontWeight: '700', marginTop: 4 },
  winnerSub: { color: Colors.rough, fontSize: 12, marginTop: 4 },
  changeWinner: { color: Colors.gray, fontSize: 12, marginBottom: 16 },
  savedBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: Colors.forest,
    borderRadius: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  savedBtnText: { fontSize: 15, fontWeight: '700', color: Colors.cream },
});
