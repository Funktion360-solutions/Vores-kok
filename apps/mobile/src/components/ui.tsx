import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { fonts, useTheme } from '@/lib/theme';

export function Title({ children, size = 'xl', style }: { children: ReactNode; size?: 'lg' | 'xl' | 'xxl' | 'display'; style?: StyleProp<TextStyle> }) {
  const { c, fontSizes } = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: fonts.display, fontSize: fontSizes[size], fontWeight: '700', color: c.ink }, style]}>{children}</Text>;
}

export function Body({ children, muted, size = 'md', style, numberOfLines }: { children: ReactNode; muted?: boolean; size?: 'xs' | 'sm' | 'md' | 'lg'; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { c, fontSizes } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontSize: fontSizes[size], color: muted ? c.inkSoft : c.ink, lineHeight: fontSizes[size] * 1.45 }, style]}>{children}</Text>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: Variant; icon?: ComponentProps<typeof Ionicons>['name']; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const { c, touchTarget } = useTheme();
  const bg = { primary: c.terracotta, secondary: c.paper, ghost: 'transparent', danger: c.danger, soft: c.terracottaSoft }[variant];
  const fg = { primary: c.white, secondary: c.ink, ghost: c.inkSoft, danger: c.white, soft: c.terracottaDark }[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [{ minHeight: touchTarget, paddingHorizontal: 18, borderRadius: 999, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: variant === 'secondary' ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color, size = 22 }: { icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void; label: string; color?: string; size?: number }) {
  const { c, touchTarget } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => ({ width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: pressed ? c.sand : 'transparent' })}>
      <Ionicons name={icon} size={size} color={color ?? c.inkSoft} />
    </Pressable>
  );
}

export function Field({ label, error, hint, ...props }: ComponentProps<typeof TextInput> & { label: string; error?: string | undefined; hint?: string }) {
  const { c, touchTarget } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.inkMuted}
        {...props}
        style={[{ minHeight: touchTarget, borderWidth: 1, borderColor: error ? c.danger : c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: c.ink, backgroundColor: c.paper }, props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null, props.style]} />
      {error ? <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 14 }}>{error}</Text> : hint ? <Text style={{ color: c.inkMuted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.paper, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 18, padding: 16 }, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress}
      style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center',
        borderColor: active ? c.terracotta : c.line, backgroundColor: active ? c.terracottaSoft : c.paper }}>
      <Text style={{ color: active ? c.terracottaDark : c.inkSoft, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'success'; children: ReactNode }) {
  const { c } = useTheme();
  const bg = { info: c.honeySoft, danger: c.dangerSoft, success: c.sageSoft }[tone];
  const fg = { info: c.ink, danger: c.danger, success: c.sage }[tone];
  return <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ backgroundColor: bg, borderRadius: 12, padding: 12 }}><Text style={{ color: fg, fontSize: 15 }}>{children}</Text></View>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, borderRadius: 18 }}>
      <Title size="lg">{title}</Title>
      {children ? <Body muted style={{ textAlign: 'center' }}>{children}</Body> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}
