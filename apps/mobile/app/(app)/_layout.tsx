import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0d0d0b" },
        animation: "slide_from_right",
      }}
    />
  );
}
