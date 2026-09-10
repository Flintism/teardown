/**
 * Shared browser plumbing for the audit scripts.
 *
 * Uses puppeteer-core against a Chromium already on the machine rather than
 * downloading one — a browser binary is a big dependency for a static site
 * with no other build requirements.
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import http from 'node:http';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function findBrowser() {
  for (const p of CANDIDATES) {
    if (p && existsSync(p)) return p;
  }
  // Edge ships under a versioned EdgeCore directory on some Windows builds.
  try {
    const root = 'C:/Program Files (x86)/Microsoft/EdgeCore';
    if (existsSync(root)) {
      const dirs = execSync(`ls "${root}"`, { shell: 'bash.exe' })
        .toString().trim().split(/\s+/);
      for (const d of dirs) {
        const p = `${root}/${d}/msedge.exe`;
        if (existsSync(p)) return p;
      }
    }
  } catch {}
  throw new Error(
    'No Chromium found. Install Chrome or Edge, or set CHROME_PATH=/path/to/chrome'
  );
}

export const BASE = process.env.AUDIT_URL || 'http://localhost:4321';

export const PAGES = [
  { name: 'Home', path: '/index.html' },
  { name: 'Library', path: '/library.html' },
  { name: 'About', path: '/about.html' },
  { name: 'Comparison', path: '/posts/claude-code-vs-codex.html' },
  { name: 'Tutorial', path: '/posts/claude-code-hooks.html' },
  { name: 'Method', path: '/posts/how-we-test-coding-agents.html' },
];

export function checkServer() {
  // node:http rather than fetch: Node 24's undici asserts on the abrupt
  // connection close that simple Python dev servers produce.
  return new Promise((resolve) => {
    const fail = () => {
      console.error(`\n  Cannot reach ${BASE}`);
      console.error('  Start the server first:  python serve.py\n');
      process.exit(1);
    };
    const req = http.get(BASE + '/index.html', (res) => {
      res.resume();
      if (res.statusCode === 200) resolve();
      else fail();
    });
    req.on('error', fail);
    req.setTimeout(4000, () => { req.destroy(); fail(); });
  });
}

export const LAUNCH = {
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
};
