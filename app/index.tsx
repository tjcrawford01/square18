import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';

export default function SplashScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>⛳</Text>
        <Text style={styles.title}>Square18</Text>
        <Text style={styles.tagline}>Set it · Play it · Square it</Text>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={() => router.push('/setup/players')}>
          <Text style={styles.buttonText}>Start a Round at Aspetuck 🏌️</Text>
        </Pressable>
        <Text style={styles.course}>Aspetuck Valley CC · Weston, CT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.forest,
    paddingHorizontal: 32,
    paddingVertical: 56,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    marginTop: 48,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.cream,
  },
  tagline: {
    color: Colors.gold,
    fontSize: 20,
    marginTop: 12,
    letterSpacing: 4,
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.ink,
  },
  course: {
    color: Colors.gray,
    fontSize: 12,
    marginTop: 12,
  },
});

