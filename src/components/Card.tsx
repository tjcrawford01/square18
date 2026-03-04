import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: string;
}

export function Card({ children, style, accent }: CardProps) {
  return (
    <View style={[styles.card, { borderColor: accent ?? Colors.grayLight }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 2,
  },
});
