import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const msg = error.message;
    const stack = error.stack ?? '';
    const componentStack = errorInfo.componentStack ?? '';
    Alert.alert(
      'App Error',
      `${msg}\n\n${componentStack.slice(0, 300)}${componentStack.length > 300 ? '...' : ''}`,
      [{ text: 'OK', onPress: () => this.setState({ hasError: false, error: null }) }]
    );
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Pressable style={styles.btn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.btnText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cream,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.ink, marginBottom: 12 },
  message: { fontSize: 14, color: Colors.gray, textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: Colors.forest,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.cream },
});
