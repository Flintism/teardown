// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Playwright drives a Chromium already on this machine rather than downloading
 * its own. `npx playwright install chromium` also works and is more portable —
 * set PW_USE_BUNDLED=1 to prefer it.
 */
function findBrowser() {
  if (process.env.PW_USE_BUNDLED) return undefined;
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of candidates) if (p && existsSync(p)) return p;

  // Edge sometimes lives under a versioned EdgeCore directory on Windows.
  try {
    const root = 'C:/Program Files (x86)/Microsoft/EdgeCore';
    if (existsSync(root)) {
      for (const d of execSync(`ls "${root}"`, { shell: 'bash.exe' })
        .toString().trim().split(/\s+/)) {
        const p = `${root}/${d}/msedge.exe`;
        if (existsSync(p)) return p;
      }
    }
  } catch { /* fall through to the bundled browser */ }
  return undefined;
}

const executablePath = findBrowser();

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,          // one dev server, keep the output readable
  workers: 1,
  reporter: [['list']],
  timeout: 30000,
  expect: { timeout: 5000 },

  use: {
    baseURL: process.env.AUDIT_URL || 'http://localhost:4321',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath, args: ['--no-sandbox', '--disable-gpu'] },
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  // Start the site if it is not already running.
  webServer: {
    command: 'python serve.py 4321',
    url: 'http://localhost:4321/index.html',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
