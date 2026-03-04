import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface PrimaryBtnProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}

export function PrimaryBtn({ label, onPress, disabled, color }: PrimaryBtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        disabled && styles.btnDisabled,
        color && !disabled && { backgroundColor: color },
        !disabled && !color && { borderBottomWidth: 3, borderBottomColor: Colors.gold },
      ]}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.forest,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.grayLight,
  },
  text: {
    color: Colors.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  textDisabled: {
    color: Colors.gray,
  },
});
