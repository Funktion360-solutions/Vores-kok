import { Ionicons } from '@expo/vector-icons';
import type { RecipeSummary } from '@vores-kok/database';
import { DIFFICULTY_LABELS, formatMinutes, totalMinutes } from '@vores-kok/domain';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { fonts, useTheme } from '@/lib/theme';

export function RecipeCard({ recipe, source, onPress, selected, compact }: {
  recipe: RecipeSummary; source?: { uri: string; cacheKey: string } | undefined; onPress: () => void; selected?: boolean; compact?: boolean;
}) {
  const { c } = useTheme();
  const time = totalMinutes(recipe);
  const origin = recipe.origin_person_name ?? recipe.origin_text;
  const meta = [time ? formatMinutes(time) : null, recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${recipe.title}${origin ? `, fra ${origin}` : ''}${meta ? `, ${meta}` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 16, backgroundColor: selected ? c.terracottaSoft : pressed ? c.sand : c.paper,
        borderWidth: 1, borderColor: selected ? c.terracotta : c.line })}>
      <View style={{ width: compact ? 64 : 84, height: compact ? 64 : 84, borderRadius: 12, overflow: 'hidden', backgroundColor: c.honeySoft, alignItems: 'center', justifyContent: 'center' }}>
        {source ? <Image source={source} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : <Ionicons name="restaurant-outline" size={28} color={c.terracotta} />}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
        {recipe.category_name ? <Text style={{ fontSize: 12, color: c.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{recipe.category_name}</Text> : null}
        <Text style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: c.ink }} numberOfLines={2}>{recipe.title}</Text>
        {origin ? <Text style={{ color: c.sage, fontSize: 14 }} numberOfLines={1}>♥ {origin}</Text> : null}
        {meta ? <Text style={{ color: c.inkMuted, fontSize: 14 }}>{meta}</Text> : null}
      </View>
      {recipe.is_favorite ? <Ionicons name="star" size={18} color={c.honey} accessibilityLabel="Favorit" /> : null}
    </Pressable>
  );
}
