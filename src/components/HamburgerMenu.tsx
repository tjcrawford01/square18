import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../theme/colors';
import { GameRulesModal } from './GameRulesModal';
import { HistoryModal } from './HistoryModal';

const FEEDBACK_EMAIL = 'feedback@square18.app';
const FEEDBACK_SUBJECT = 'square18 Feedback';

interface HamburgerMenuProps {
  showViewScorecard?: boolean;
  onViewScorecard?: () => void;
  /** Called when Game Rules is tapped; if not provided, GameRulesModal is shown internally */
  onOpenGameRules?: () => void;
  /** Render prop: (openMenu) => element to show as the hamburger button */
  renderTrigger: (openMenu: () => void) => React.ReactNode;
  /** Show "End Round" when round is in progress */
  showEndRound?: boolean;
  /** Called when End Round is tapped (after user confirms) */
  onEndRound?: () => void;
}

export function HamburgerMenu({ showViewScorecard, onViewScorecard, onOpenGameRules, renderTrigger, showEndRound, onEndRound }: HamburgerMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [gameRulesVisible, setGameRulesVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const openFeedback = () => {
    closeMenu();
    setFeedbackVisible(true);
  };

  const sendFeedback = () => {
    const body = feedbackText.trim() || ' ';
    const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url);
    setFeedbackText('');
    setFeedbackVisible(false);
  };

  const handleViewScorecard = () => {
    closeMenu();
    onViewScorecard?.();
  };

  const openGameRules = () => {
    closeMenu();
    if (onOpenGameRules) {
      onOpenGameRules();
    } else {
      setGameRulesVisible(true);
    }
  };

  const openHistory = () => {
    closeMenu();
    setHistoryVisible(true);
  };

  const handleEndRound = () => {
    closeMenu();
    onEndRound?.();
  };

  return (
    <>
      {renderTrigger(openMenu)}

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View style={styles.menuDropdown}>
            {showViewScorecard && onViewScorecard && (
              <Pressable style={styles.menuItem} onPress={handleViewScorecard}>
                <Text style={styles.menuItemText}>View Scorecard</Text>
              </Pressable>
            )}
            <Pressable style={styles.menuItem} onPress={openGameRules}>
              <Text style={styles.menuItemText}>Game Rules 📖</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={openHistory}>
              <Text style={styles.menuItemText}>History 📊</Text>
            </Pressable>
            {showEndRound && onEndRound && (
              <Pressable style={styles.menuItem} onPress={handleEndRound}>
                <Text style={styles.menuItemText}>End Round ⛳</Text>
              </Pressable>
            )}
            <Pressable style={styles.menuItem} onPress={openFeedback}>
              <Text style={styles.menuItemText}>Feedback</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {!onOpenGameRules && (
        <GameRulesModal visible={gameRulesVisible} onClose={() => setGameRulesVisible(false)} />
      )}

      <HistoryModal visible={historyVisible} onClose={() => setHistoryVisible(false)} />

      <Modal visible={feedbackVisible} transparent animationType="slide">
        <Pressable style={styles.sheetOverlay} onPress={() => setFeedbackVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetAvoid}
          >
            <Pressable style={styles.feedbackSheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.feedbackTitle}>Send Feedback</Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="What's on your mind?"
                placeholderTextColor={Colors.gray}
                multiline
                numberOfLines={4}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />
              <View style={styles.feedbackActions}>
                <Pressable style={styles.feedbackCancel} onPress={() => { setFeedbackText(''); setFeedbackVisible(false); }}>
                  <Text style={styles.feedbackCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.feedbackSend} onPress={sendFeedback}>
                  <Text style={styles.feedbackSendText}>Send</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16,
  },
  menuDropdown: {
    backgroundColor: Colors.cream,
    borderRadius: 8,
    minWidth: 180,
    borderWidth: 1,
    borderColor: Colors.sand,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.grayLight,
  },
  menuItemText: {
    fontSize: 15,
    color: Colors.ink,
    fontWeight: '600',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetAvoid: {
    justifyContent: 'flex-end',
  },
  feedbackSheet: {
    backgroundColor: Colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 36,
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.ink,
    marginBottom: 16,
  },
  feedbackInput: {
    borderWidth: 2,
    borderColor: Colors.grayLight,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  feedbackCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  feedbackCancelText: {
    fontSize: 16,
    color: Colors.gray,
  },
  feedbackSend: {
    backgroundColor: Colors.forest,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  feedbackSendText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.cream,
  },
});
