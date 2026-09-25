import { colors, darkColors, fontSizes, radii, spacing, touchTarget } from '@vores-kok/ui';
import { useColorScheme, useWindowDimensions } from 'react-native';

export type Palette = typeof colors;

export function useTheme() {
  const scheme = useColorScheme();
  const c = (scheme === 'dark' ? darkColors : colors) as Palette;
  return { c, radii, spacing, fontSizes, touchTarget, dark: scheme === 'dark' };
}

/** Layout class: iPad / large screens get split views and wider content. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= 600;
  return { width, height, isTablet, isWide: width >= 900, landscape: width > height };
}

export const fonts = {
  // System fonts keep Dynamic Type working; serif display via Georgia on iOS.
  display: 'Georgia',
};
