import { useEffect, useState } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const ALL_TABS: Array<{
  name: string;
  label: string;
  icon: IoniconName;
  iconFocused: IoniconName;
}> = [
  { name: "feed",     label: "Feed",     icon: "home-outline",        iconFocused: "home" },
  { name: "channels", label: "Channels", icon: "chatbubbles-outline", iconFocused: "chatbubbles" },
  { name: "boards",   label: "Boards",   icon: "layers-outline",      iconFocused: "layers" },
  { name: "buddies",  label: "Buddies",  icon: "people-outline",      iconFocused: "people" },
  { name: "profile",  label: "Profile",  icon: "person-outline",      iconFocused: "person" },
];

const API = process.env.EXPO_PUBLIC_API_URL ?? "";

// Hardcoded Signoff colors — immune to profile theme (Change 12)
const AMBER_ACTIVE   = "#c8860a";
const MUTED_INACTIVE = "#6a6860";

export default function TabsLayout() {
  const [boardsEnabled, setBoardsEnabled] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/feature-flags/boards`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((data: { enabled: boolean }) => setBoardsEnabled(data.enabled === true))
      .catch(() => setBoardsEnabled(false));
  }, []);

  const tabs = boardsEnabled
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.name !== "boards");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a08",      // Change 9
          borderTopColor: "#1e1e1a",
          borderTopWidth: 0.5,
          height: 60,
        },
        tabBarActiveTintColor: AMBER_ACTIVE,
        tabBarInactiveTintColor: MUTED_INACTIVE,
        tabBarLabelStyle: {
          fontFamily: "DMSans_400Regular",
          fontSize: 10,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color, size }) => (
              <View style={{ alignItems: "center" }}>
                <Ionicons
                  name={focused ? tab.iconFocused : tab.icon}
                  size={size}
                  color={color}
                />
                {/* Active amber dot indicator (Change 9) */}
                {focused && (
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: AMBER_ACTIVE,
                      marginTop: 2,
                    }}
                  />
                )}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
