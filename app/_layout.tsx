import ChatbotIcon from '@/components/ChatbotIcon';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// import { ApiProvider } from '../context/ApiContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../constants/theme';
import { MultiBuilderProvider } from '../context/MultiBuilderContext';

// Configure splash screen
SplashScreen.preventAutoHideAsync()
  .then(result => console.log(`SplashScreen.preventAutoHideAsync() succeeded: ${result}`))
  .catch(console.warn);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const pathname = usePathname();
  const isChatScreen = pathname === '/ChatScreen';

  // Temporary effect to reset chat icon visibility
  useEffect(() => {
    const resetChatIconVisibility = async () => {
      try {
        await AsyncStorage.removeItem('@chat_icon_visible');
        console.log('Chat icon visibility reset');
      } catch (error) {
        console.error('Error resetting chat icon visibility:', error);
      }
    };
    resetChatIconVisibility();
  }, []);

  useEffect(() => {
    if (error) console.log('Error loading fonts:', error);
  }, [error]);

  const onLayoutRootView = useCallback(async () => {
    if (loaded) {
      try {
        await SplashScreen.hideAsync();
        console.log('SplashScreen hidden successfully');
      } catch (e) {
        console.warn('Error hiding splash screen:', e);
      }
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1D24' }} />
    );
  }

  return (
    <SafeAreaProvider>
        <MultiBuilderProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <View 
              style={{ 
                flex: 1, 
                backgroundColor: theme.colors.background 
              }} 
              onLayout={onLayoutRootView}
            >
              <Stack
                initialRouteName="(tabs)" 
                screenOptions={{
                  headerStyle: {
                    backgroundColor: theme.colors.surface,
                  },
                  headerTintColor: theme.colors.accent,
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: theme.colors.background,
                  },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="ChatScreen" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" options={{ headerShown: false }} />
              </Stack>
              <StatusBar style="light" />
              {!isChatScreen && <ChatbotIcon />}
            </View>
          </ThemeProvider>
        </MultiBuilderProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 