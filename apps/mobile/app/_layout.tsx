import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useFonts } from "expo-font";
import { DMSans_400Regular, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import { ThemeProvider } from "@/lib/theme";
import { getSession, type Session } from "@/lib/session";
import { setSoketiAuth } from "@/lib/soketi";
import { createTables } from "@/lib/db/localMessages";
import { createPostsTable } from "@/lib/db/localPosts";
import * as Notifications from "expo-notifications";
import {
  setupNotificationHandlers,
  handleNotificationResponse,
  registerForPushNotifications,
} from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

// Set up foreground notification display rules immediately at module load.
setupNotificationHandlers();

// ---------------------------------------------------------------------------
// Auth guard — runs after every navigation segment change.
// Redirects unauthenticated users to login; redirects authed users away from
// the auth screens.
// ---------------------------------------------------------------------------

function AuthGuard({ session }: { session: Session | null | undefined }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return; // still initializing

    const inAuth = segments[0] === "(auth)";

    if (!session && !inAuth) {
      router.replace("/(auth)/login");
    } else if (session && inAuth) {
      router.replace("/(app)/(tabs)/feed");
    }
  }, [session, segments, router]);

  return null;
}

// ---------------------------------------------------------------------------
// Root layout — mounts once, wraps the entire app.
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_700Bold,
    VT323_400Regular,
  });

  // Initialize SQLite tables, load session, and set up push notifications.
  useEffect(() => {
    async function init() {
      await createTables();
      await createPostsTable();
      const s = await getSession();
      setSession(s);
      if (s) {
        setSoketiAuth(s.token);
        // Re-fetch and update push token on every app launch while logged in.
        registerForPushNotifications().catch(() => {});
      }
    }
    init();
  }, []);

  // Wire up notification tap → navigation. Must run after expo-router is ready.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );
    // Handle cold-start notification (app was not running when tapped)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });
    return () => sub.remove();
  }, []);

  // Hide splash once fonts are loaded and session check is complete.
  useEffect(() => {
    if (fontsLoaded && session !== undefined) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, session]);

  const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StripeProvider publishableKey={stripeKey}>
            <AuthGuard session={session} />
            <Stack screenOptions={{ headerShown: false }} />
            <StatusBar style="light" />
          </StripeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
