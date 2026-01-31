/**
 * Profile Screen
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Profile Screen</Text>
      <Text style={styles.subtext}>To be implemented</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  subtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
});
