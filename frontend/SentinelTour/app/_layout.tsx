import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '@/context/ThemeContext';
import { useTheme } from '@/hooks/useTheme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Inner component reads theme after Provider is mounted
function AppShell() {
  const { C, theme } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.background }}>
      <SafeAreaProvider>
        <StatusBar
          style={theme === 'dark' ? 'light' : 'dark'}
          backgroundColor={C.background}
        />
        <Stack
          screenOptions={{
            headerShown:  false,
            animation:    'fade',
            contentStyle: { backgroundColor: C.background },
          }}
        >
          <Stack.Screen name="index"     />
          <Stack.Screen name="(auth)"    />
          <Stack.Screen name="(tabs)"    />
          <Stack.Screen name="incidents" />
          <Stack.Screen name="devices"   />
          <Stack.Screen name="profile"   />
          <Stack.Screen name="settings"  />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // ThemeProvider is outermost — single Zustand subscription for entire app
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ThemeProvider>
  );
}