import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.gray,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
});
