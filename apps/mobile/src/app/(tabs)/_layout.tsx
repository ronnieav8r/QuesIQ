import { Tabs } from "expo-router";
import { Clock3, Home, Mic2, UserRound } from "lucide-react-native";

import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.cyan, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.backgroundRaised, borderTopColor: colors.border, height: 68, paddingBottom: 8, paddingTop: 7 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "700" } }}>
    <Tabs.Screen name="home" options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} />, title: "Home" }} />
    <Tabs.Screen name="practice" options={{ tabBarIcon: ({ color, size }) => <Mic2 color={color} size={size} />, title: "Practice" }} />
    <Tabs.Screen name="history" options={{ tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size} />, title: "History" }} />
    <Tabs.Screen name="me" options={{ tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />, title: "Me" }} />
  </Tabs>;
}
