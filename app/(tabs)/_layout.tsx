import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { theme } from "../../constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#1C2732", // Dark background
        },
        tabBarActiveTintColor: "#8BCEA9", // Match the green accent color used in ChatbotIcon
        tabBarInactiveTintColor: theme.colors.text.secondary,
        headerStyle: {
          backgroundColor: "#1C2732", // Dark background
        },
        headerTintColor: "#FFFFFF", // White text
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShown: false, // Hide the header for all tab screens
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "News here",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="MultiBuilderScreen"
        options={{
          title: "Multi Builder",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="OCTDataScreen"
        options={{
          title: "OCT",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-compare-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="aflTab"
        options={{
          title: "AFL",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" size={size} color={color} />
          ),
          href: null, // This makes the tab accessible via navigation but not visible in the tab bar
        }}
      />
    </Tabs>
  );
}
