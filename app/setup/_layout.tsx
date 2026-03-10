import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function SetupErrorFallback() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f4efe6' }}>
      <Text style={{ fontSize: 16, marginBottom: 16, textAlign: 'center', color: '#0f1a14' }}>
        Something went wrong loading this screen.
      </Text>
      <Pressable onPress={() => router.back()} style={{ backgroundColor: '#1c3a28', padding: 12, paddingHorizontal: 24, borderRadius: 8 }}>
        <Text style={{ color: '#f4efe6', fontWeight: '700' }}>Go Back</Text>
      </Pressable>
    </View>
  );
}

export default function SetupLayout() {
  return (
    <ErrorBoundary fallback={<SetupErrorFallback />}>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
