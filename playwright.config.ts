import { defineConfig, devices } from '@playwright/test'

// This suite runs against the app's real Supabase + Cloudinary backend — there is no mock
// backend/test project yet — so keep worker count modest and allow a retry, since flakiness
// here is more likely to be a live network hiccup than a broken test.
export default defineConfig({
  testDir: './tests/regression',
  fullyParallel: true,
  workers: 3,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/wanderlist/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/wanderlist/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
