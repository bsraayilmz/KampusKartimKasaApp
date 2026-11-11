import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KasaProvider, useKasa } from '@/lib/kasa';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Gate() {
  const { ready, device } = useKasa();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });
  const fontsDone = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready && fontsDone) SplashScreen.hideAsync();
  }, [ready, fontsDone]);

  if (!ready || !fontsDone) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'fade' }}>
      <Stack.Protected guard={!!device}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!device}>
        <Stack.Screen name="pair" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <KasaProvider>
      <StatusBar style="light" hidden />
      <Gate />
    </KasaProvider>
  );
}
