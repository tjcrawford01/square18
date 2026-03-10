import React from 'react';
import { Stack } from 'expo-router';

export default function SetupLayout() {
  console.log('[SetupLayout] Rendering');
  return <Stack screenOptions={{ headerShown: false }} />;
}
