/**
 * Click Platform - React Native Mobile App
 * 
 * Foundation for iOS and Android mobile applications
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens (to be implemented)
import HomeScreen from './screens/HomeScreen';
import ContentScreen from './screens/ContentScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import ProfileScreen from './screens/ProfileScreen';

// Services
import { apiClient } from './services/api';
import { authService } from './services/auth';

const Tab = createBottomTabNavigator();

interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
}

export default function App() {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        const user = await authService.getCurrentUser();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user,
        });
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
      });
    }
  };

  if (state.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading Click Platform...</Text>
      </SafeAreaView>
    );
  }

  if (!state.isAuthenticated) {
    // Navigate to login screen (to be implemented)
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.welcomeText}>Welcome to Click Platform</Text>
        <Text style={styles.subtitleText}>Please log in to continue</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#6B7280',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>🏠</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Content"
          component={ContentScreen}
          options={{
            title: 'Content',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>📝</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{
            title: 'Analytics',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>📊</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>👤</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#6B7280',
  },
});
