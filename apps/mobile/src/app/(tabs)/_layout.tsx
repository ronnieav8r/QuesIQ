import { Tabs } from "expo-router";
import { BookOpen, Clock3, Home, Mic2, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWindowDimensions } from "react-native";

import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const bottom = Math.max(insets.bottom, 8);
  return <Tabs screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, tabBarActiveTintColor: colors.cyan, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.backgroundRaised, borderTopColor: colors.border, height: 60 + bottom + Math.max(0, fontScale - 1) * 24, paddingBottom: bottom, paddingTop: 7 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "700" } }}>
    <Tabs.Screen name="home" options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} />, title: "Home" }} />
    <Tabs.Screen name="practice" options={{ tabBarIcon: ({ color, size }) => <Mic2 color={color} size={size} />, title: "Practice" }} />
    <Tabs.Screen name="story-lab" options={{ tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />, title: "Story Lab" }} />
    <Tabs.Screen name="history" options={{ tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size} />, title: "History" }} />
    <Tabs.Screen name="me" options={{ tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />, title: "Me" }} />
  </Tabs>;
}
