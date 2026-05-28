import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const cursorArtifactsRoot = process.env.CURSOR_ARTIFACTS_DIR ?? '/opt/cursor/artifacts';

/** Publish screenshots/traces/HTML report to Cursor Cloud artifacts (visible in the agent UI). */
const publishToCursorArtifacts =
  process.env.CURSOR_ARTIFACTS === '1' ||
  Boolean(process.env.CI) ||
  existsSync(cursorArtifactsRoot);

const e2eOutputDir = publishToCursorArtifacts
  ? path.join(cursorArtifactsRoot, 'e2e-test-results')
  : 'test-results';

const playwrightReportDir = publishToCursorArtifacts
  ? path.join(cursorArtifactsRoot, 'playwright-report')
  : 'playwright-report';

export default defineConfig({
  testDir: './e2e',
  outputDir: e2eOutputDir,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: playwrightReportDir }]],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  webServer: {
    command: 'npm run e2e:server',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
