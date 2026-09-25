import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Vores Kok',
  slug: 'vores-kok',
  scheme: 'voreskok',
  version: '0.1.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#FAF6EF',
  ios: {
    bundleIdentifier: 'dk.voreskok.app',
    supportsTablet: true,
    requireFullScreen: false,
    infoPlist: {
      NSCameraUsageDescription: 'Vores Kok bruger kameraet, så du kan fotografere retter og gamle opskriftskort.',
      NSPhotoLibraryUsageDescription: 'Vores Kok bruger dine billeder, når du vælger fotos til en opskrift.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: { package: 'dk.voreskok.app' },
  web: { bundler: 'metro', output: 'single' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-image-picker', { photosPermission: 'Vores Kok bruger dine billeder, når du vælger fotos til en opskrift.', cameraPermission: 'Vores Kok bruger kameraet til fotos af retter og opskriftskort.' }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    // Public values only (anon/publishable key). Never put secrets here.
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://tgqwyheqhquwncyloond.supabase.co',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_GJr1rOaxfEl1RVT88azBcQ_opTNSfu3',
  },
};

export default config;
