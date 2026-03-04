// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { LocationProvider } from './src/context/LocationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/constants/config';

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <NavigationContainer>
          <StatusBar style="light" backgroundColor={COLORS.primary} />
          <AppNavigator />
        </NavigationContainer>
      </LocationProvider>
    </AuthProvider>
  );
}