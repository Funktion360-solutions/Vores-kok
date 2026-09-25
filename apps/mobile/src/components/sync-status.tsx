import { formatDate } from '@vores-kok/domain';
import { Text, View } from 'react-native';
import { useApp } from '@/lib/app-state';
import { useTheme } from '@/lib/theme';

export function SyncStatus() {
  const { online, syncing, syncError, cache } = useApp();
  const { c } = useTheme();
  const pending = cache?.pendingWrites ?? 0;
  const text = !online
    ? `Offline — viser gemte opskrifter${cache?.syncedAt ? ` fra ${formatDate(cache.syncedAt)}` : ''}${pending ? ` · ${pending} ændring venter` : ''}`
    : syncing ? 'Synkroniserer…' : syncError ? `Synkronisering fejlede: ${syncError}` : null;
  if (!text) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: online ? c.sand : c.honeySoft, paddingHorizontal: 16, paddingVertical: 8 }}>
      <Text style={{ color: c.inkSoft, fontSize: 13 }}>{text}</Text>
    </View>
  );
}
