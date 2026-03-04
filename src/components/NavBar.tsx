import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../theme/colors';

interface NavBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightEl?: React.ReactNode;
}

export function NavBar({ title, subtitle, onBack, rightEl }: NavBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={styles.container}>
      {onBack !== undefined && (
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
      )}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightEl ?? <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.forest,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: Colors.gold,
  },
  backBtn: {
    padding: 0,
  },
  backText: {
    color: Colors.rough,
    fontSize: 20,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: Colors.cream,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: Colors.rough,
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  placeholder: {
    width: 24,
  },
});
