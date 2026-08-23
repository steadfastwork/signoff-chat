import { useRef } from "react";
import { StyleSheet, View, ActivityIndicator, BackHandler, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewNavigation } from "react-native-webview";

// SIGNOFF mobile = the deployed retro web client in a WebView. All auth/messaging
// runs server-side via the gateway, so the shell needs no native logic.
const APP_URL = "https://www.signoff.chat";

export default function Index() {
  const ref = useRef<WebView>(null);
  const canGoBack = useRef(false);

  // Android hardware back → navigate the WebView back when possible.
  if (Platform.OS === "android") {
    BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        ref.current?.goBack();
        return true;
      }
      return false;
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
      <WebView
        ref={ref}
        source={{ uri: APP_URL }}
        style={styles.web}
        originWhitelist={["https://*"]}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        pullToRefreshEnabled
        startInLoadingState
        onNavigationStateChange={(nav: WebViewNavigation) => {
          canGoBack.current = nav.canGoBack;
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#f2cf5b" size="large" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#3f4778" },
  web: { flex: 1, backgroundColor: "#3f4778" },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3f4778",
  },
});
