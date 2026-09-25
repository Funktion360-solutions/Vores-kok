import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8081', locale: 'da-DK', launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
});
