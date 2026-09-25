import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '@/lib/app-state';
import { useTheme } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Routes signed-out users to login and users without a household to onboarding. */
function Gate() {
  const { ready, session, household } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const { c, dark } = useTheme();

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
    const first = segments[0] as string | undefined;
    const inAuth = first === 'login' || first === 'signup';
    if (!session && !inAuth) router.replace('/login');
    else if (session && inAuth) router.replace('/');
    else if (session && !household && first !== 'onboarding' && first !== 'invite') router.replace('/onboarding');
    else if (session && household && first === 'onboarding') router.replace('/');
  }, [ready, session, household, segments, router]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: c.terracotta, headerStyle: { backgroundColor: c.cream }, headerTitleStyle: { color: c.ink }, contentStyle: { backgroundColor: c.cream }, headerBackTitle: 'Tilbage' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: 'Opret konto' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Kom i gang', headerBackVisible: false }} />
        <Stack.Screen name="recipe/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="recipe/[id]/edit" options={{ title: 'Rediger opskrift', presentation: 'modal' }} />
        <Stack.Screen name="recipe/new" options={{ title: 'Ny opskrift', presentation: 'modal' }} />
        <Stack.Screen name="invite/[token]" options={{ title: 'Invitation' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
