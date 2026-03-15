import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';

const RULES_BG = '#1c3a28';
const RULES_GOLD = '#b8953a';
const RULES_CREAM = '#f4efe6';
const RULES_WHITE = '#ffffff';

interface AccordionSectionProps {
  title: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}

function AccordionSection({ title, children, expanded, onToggle }: AccordionSectionProps) {
  return (
    <View style={accordionStyles.section}>
      <Pressable style={accordionStyles.header} onPress={onToggle}>
        <Text style={accordionStyles.headerText}>{title}</Text>
        <Text style={accordionStyles.chevron}>{expanded ? '▼' : '▶'}</Text>
      </Pressable>
      {expanded && <View style={accordionStyles.body}>{children}</View>}
    </View>
  );
}

const accordionStyles = StyleSheet.create({
  section: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: RULES_BG,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: RULES_CREAM,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink,
  },
  chevron: {
    fontSize: 12,
    color: Colors.gray,
  },
  body: {
    padding: 16,
    paddingTop: 12,
  },
  bodyText: {
    fontSize: 14,
    color: RULES_WHITE,
    lineHeight: 22,
    marginBottom: 12,
  },
  bodyTextLast: {
    marginBottom: 0,
  },
  bodySubhead: {
    fontSize: 14,
    fontWeight: '700',
    color: RULES_WHITE,
    marginTop: 8,
    marginBottom: 4,
  },
  bodySubheadFirst: {
    marginTop: 0,
  },
});

interface GameRulesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function GameRulesModal({ visible, onClose }: GameRulesModalProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Game Rules</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <AccordionSection
              title="Nassau 🏌️"
              expanded={!!expanded.nassau}
              onToggle={() => toggle('nassau')}
            >
              <Text style={[accordionStyles.bodyText, accordionStyles.bodySubheadFirst]}>
                <Text style={{ fontWeight: '700' }}>The Classic</Text>
              </Text>
              <Text style={accordionStyles.bodyText}>
                Nassau is three bets in one: the Front 9, the Back 9, and the Total 18. Each is a separate match play competition.
              </Text>
              <Text style={[accordionStyles.bodySubhead, accordionStyles.bodySubheadFirst]}>How It Works</Text>
              <Text style={accordionStyles.bodyText}>• 2 players: head-to-head match play</Text>
              <Text style={accordionStyles.bodyText}>• 4 players: 2v2 best ball (each team plays their better ball)</Text>
              <Text style={accordionStyles.bodyText}>• Win a hole by having the lower net score</Text>
              <Text style={accordionStyles.bodyText}>• Front 9 winner is whoever wins more holes on the front</Text>
              <Text style={accordionStyles.bodyText}>• Back 9 winner is whoever wins more holes on the back</Text>
              <Text style={accordionStyles.bodyText}>• Total winner is whoever wins more of the 18 holes overall</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Ties (halved holes) are not counted for either side</Text>
              <Text style={accordionStyles.bodySubhead}>Presses</Text>
              <Text style={accordionStyles.bodyText}>
                A press is an optional side bet that starts a new match within the same nine. If your team is down by the press number (e.g. 2 holes), you can press to start a fresh competition for the remaining holes of that nine. Both teams must agree to press rules before the round.
              </Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                A press starts each time the losing team falls behind by another multiple of the press amount. Once pressed at a given deficit, returning to that deficit after recovering does not trigger another press.
              </Text>
              <Text style={accordionStyles.bodySubhead}>Handicaps</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Net scores are used. Each player's course handicap is calculated from their index, then adjusted relative to the lowest handicap in the group so the best player receives no strokes.
              </Text>
            </AccordionSection>

            <AccordionSection
              title="Skins 🦴"
              expanded={!!expanded.skins}
              onToggle={() => toggle('skins')}
            >
              <Text style={[accordionStyles.bodyText, accordionStyles.bodySubheadFirst]}>
                <Text style={{ fontWeight: '700' }}>The Grind</Text>
              </Text>
              <Text style={accordionStyles.bodyText}>
                Every hole is its own competition. Win a hole outright and you win the skin — and the money that comes with it.
              </Text>
              <Text style={accordionStyles.bodySubhead}>How It Works</Text>
              <Text style={accordionStyles.bodyText}>• 2–4 players, individual (no teams)</Text>
              <Text style={accordionStyles.bodyText}>• Low net score on a hole wins the skin</Text>
              <Text style={accordionStyles.bodyText}>• If two or more players tie for low score, the skin carries over to the next hole</Text>
              <Text style={accordionStyles.bodyText}>• Carry-overs accumulate — a skin worth 1 on hole 1 becomes worth 2 if tied, then 3, etc.</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• At the end of the round, each player's skins are totaled and settlement is calculated</Text>
              <Text style={accordionStyles.bodySubhead}>Stakes</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Set a dollar amount per skin before the round. Each skin is worth that amount from every other player. A player who wins a skin worth 3 (after two carry-overs) wins 3x the stake from each other player.
              </Text>
              <Text style={accordionStyles.bodySubhead}>Handicaps</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Net scores are used. Full handicap applied (no allowance reduction).
              </Text>
            </AccordionSection>

            <AccordionSection
              title="5-3-1 🎯"
              expanded={!!expanded.five31}
              onToggle={() => toggle('five31')}
            >
              <Text style={[accordionStyles.bodyText, accordionStyles.bodySubheadFirst]}>
                <Text style={{ fontWeight: '700' }}>The Points Game</Text>
              </Text>
              <Text style={accordionStyles.bodyText}>
                Three players compete for points on every hole. Low net wins 5, middle wins 3, high wins 1.
              </Text>
              <Text style={accordionStyles.bodySubhead}>How It Works</Text>
              <Text style={accordionStyles.bodyText}>• Exactly 3 players (format doesn't work with other player counts)</Text>
              <Text style={accordionStyles.bodyText}>• Each hole, players are ranked by net score</Text>
              <Text style={accordionStyles.bodyText}>• Low net score: 5 points</Text>
              <Text style={accordionStyles.bodyText}>• Middle net score: 3 points</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• High net score: 1 point</Text>
              <Text style={accordionStyles.bodySubhead}>Tie Rules</Text>
              <Text style={accordionStyles.bodyText}>• Tie for low (two players tied): 4 points each, third player gets 1</Text>
              <Text style={accordionStyles.bodyText}>• Tie for high (two players tied): first place gets 5, tied players get 2 each</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Three-way tie: 3 points each</Text>
              <Text style={accordionStyles.bodySubhead}>Stakes</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Set a dollar value per point. At the end, pairwise settlement: the player with fewer points pays the player with more points (point difference × stake).
              </Text>
              <Text style={accordionStyles.bodySubhead}>Handicaps</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Net scores are used. Full handicap applied (no allowance reduction).
              </Text>
            </AccordionSection>

            <AccordionSection
              title="Wolf 🐺"
              expanded={!!expanded.wolf}
              onToggle={() => toggle('wolf')}
            >
              <Text style={[accordionStyles.bodyText, accordionStyles.bodySubheadFirst]}>
                <Text style={{ fontWeight: '700' }}>The Hunt</Text>
              </Text>
              <Text style={accordionStyles.bodyText}>
                One player per hole is the Wolf. The Wolf watches each opponent tee off and decides whether to take them as a partner — or go it alone against everyone.
              </Text>
              <Text style={accordionStyles.bodySubhead}>How It Works</Text>
              <Text style={accordionStyles.bodyText}>• 3 or 4 players</Text>
              <Text style={accordionStyles.bodyText}>• Players rotate as Wolf each hole in fixed order (Player 1 on hole 1, Player 2 on hole 2, etc.)</Text>
              <Text style={accordionStyles.bodyText}>• The Wolf watches each player tee off in order and must decide immediately after each shot: pick this player as partner, or pass</Text>
              <Text style={accordionStyles.bodyText}>• Once you pass a player, you cannot go back</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• If the Wolf hasn't picked anyone after all others have hit, they automatically become Lone Wolf</Text>
              <Text style={accordionStyles.bodySubhead}>Teams</Text>
              <Text style={accordionStyles.bodyText}>• Wolf + Partner vs. remaining players (best ball on each side)</Text>
              <Text style={accordionStyles.bodyText}>• Winning team has the lower net best ball score</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Ties: hole is halved, no money changes hands</Text>
              <Text style={accordionStyles.bodySubhead}>Lone Wolf</Text>
              <Text style={accordionStyles.bodyText}>Wolf plays solo against all other players. Higher risk, higher reward.</Text>
              <Text style={accordionStyles.bodyText}>• Lone Wolf wins: collects stake from every other player</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Lone Wolf loses: pays every other player</Text>
              <Text style={accordionStyles.bodySubhead}>Blind Wolf</Text>
              <Text style={accordionStyles.bodyText}>Wolf declares before anyone tees off. Automatically Lone Wolf with doubled stakes.</Text>
              <Text style={accordionStyles.bodyText}>• Blind Wolf wins: collects 2x stake from every other player</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Blind Wolf loses: pays 2x stake to every other player</Text>
              <Text style={accordionStyles.bodySubhead}>Stakes</Text>
              <Text style={accordionStyles.bodyText}>Set a dollar amount per hole.</Text>
              <Text style={accordionStyles.bodyText}>Example with $2/hole and 4 players:</Text>
              <Text style={accordionStyles.bodyText}>• Wolf + Partner win: Wolf collects $2 from each loser, Partner collects $2 from each loser</Text>
              <Text style={accordionStyles.bodyText}>• Lone Wolf wins: Wolf collects $2 from all 3 others = $6</Text>
              <Text style={accordionStyles.bodyText}>• Lone Wolf loses: Wolf pays $2 to all 3 others = -$6</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>• Blind Wolf wins: Wolf collects $4 from all 3 others = $12</Text>
              <Text style={accordionStyles.bodySubhead}>Handicaps</Text>
              <Text style={[accordionStyles.bodyText, accordionStyles.bodyTextLast]}>
                Net scores are used. Full handicap applied.
              </Text>
            </AccordionSection>
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
  },
  container: {
    flex: 1,
    backgroundColor: RULES_BG,
    marginTop: 48,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 2,
    borderBottomColor: RULES_GOLD,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: RULES_GOLD,
  },
  closeBtn: {
    fontSize: 24,
    color: RULES_GOLD,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
