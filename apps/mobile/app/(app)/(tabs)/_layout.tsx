import { useEffect, useState } from "react";
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
          backgroundColor: "#0d0d0b",
          borderTopColor: "#1e1e16",
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: "#f5c842",
        tabBarInactiveTintColor: "#3a3a32",
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
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
