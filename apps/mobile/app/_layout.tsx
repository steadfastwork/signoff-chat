import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

// Thin shell: the SIGNOFF client is the deployed web app rendered in a WebView
// (see app/index.tsx). Native screens were removed in the OSCAR reframe.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#3f4778" } }} />
    </SafeAreaProvider>
  );
}
