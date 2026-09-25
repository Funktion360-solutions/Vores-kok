import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: c.terracotta, tabBarInactiveTintColor: c.inkMuted,
      tabBarStyle: { backgroundColor: c.paper, borderTopColor: c.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      headerStyle: { backgroundColor: c.cream }, headerTitleStyle: { color: c.ink }, sceneStyle: { backgroundColor: c.cream },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Hjem', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="recipes" options={{ title: 'Opskrifter', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="family" options={{ title: 'Familie', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'Mere', tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal" color={color} size={size} /> }} />
    </Tabs>
  );
}
