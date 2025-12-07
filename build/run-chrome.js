const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Determine Chrome executable path
const envPath = process.env.CHROME_PATH || process.argv[2];
const candidates = [];
if (envPath) candidates.push(envPath);
// Common Windows locations
candidates.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
candidates.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
// Edge/Chromium (fallbacks)
candidates.push('C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe');

function findChrome() {
  for (const p of candidates) {
    if (!p) continue;
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return null;
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const distChrome = path.join(projectRoot, 'dist', 'chrome');
  if (!fs.existsSync(distChrome)) {
    console.error('dist/chrome does not exist. Run `npm run build:prod` first.');
    process.exit(1);
  }

  const chromeExe = findChrome();
  if (!chromeExe) {
    console.error('Chrome executable not found. Set CHROME_PATH env var to your chrome.exe path, or pass it as the first arg.');
    console.error('Example: CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" npm run chrome:run');
    process.exit(1);
  }

  // Create a fresh temporary profile directory so no other extensions are present.
  const os = require('os');
  const tmpBase = os.tmpdir();
  const userData = fs.mkdtempSync(path.join(tmpBase, 'trackrak-'));

  // Pre-launch validation: ensure manifest and referenced files exist
  function resolvePath(p) {
    return path.isAbsolute(p) ? p : path.join(distChrome, p);
  }

  try {
    const manifestPath = path.join(distChrome, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('Missing manifest.json in', distChrome);
      process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Check background service worker
    if (manifest.background && manifest.background.service_worker) {
      const bgRel = manifest.background.service_worker;
      const bgAbs = resolvePath(bgRel);
      console.log('Background service_worker ->', bgRel, '->', bgAbs);
      if (!fs.existsSync(bgAbs)) console.warn('Background file missing:', bgAbs);
    }

    // Check content scripts
    if (Array.isArray(manifest.content_scripts)) {
      manifest.content_scripts.forEach((cs) => {
        (cs.js || []).forEach((js) => {
          const jsAbs = resolvePath(js);
          console.log('Content script ->', js, '->', jsAbs);
          if (!fs.existsSync(jsAbs)) console.warn('Content script missing:', jsAbs);
        });
      });
    }

    // Check web_accessible_resources
    if (Array.isArray(manifest.web_accessible_resources)) {
      manifest.web_accessible_resources.forEach((war) => {
        (war.resources || []).forEach((r) => {
          // skip globs
          if (r.indexOf('*') !== -1) return;
          const rAbs = resolvePath(r);
          console.log('Web accessible resource ->', r, '->', rAbs);
          if (!fs.existsSync(rAbs)) console.warn('WAR file missing:', rAbs);
        });
      });
    }
  } catch (err) {
    console.error('Failed to validate extension files:', err && err.stack ? err.stack : err);
  }

  // Print directory listings so it's clear what files will be loaded
  try {
    console.log('Dist folder listing:', distChrome);
    const distFiles = fs.readdirSync(distChrome);
    distFiles.forEach((f) => console.log(' -', f));
    const srcDir = path.join(distChrome, 'src');
    if (fs.existsSync(srcDir)) {
      console.log('Dist/src folder listing:');
      const srcFiles = fs.readdirSync(srcDir);
      srcFiles.forEach((f) => console.log('   -', f));
    }
  } catch (e) {
    console.warn('Failed to list dist folders:', e && e.stack ? e.stack : e);
  }

  // Launch Chrome and open the Extensions page so you can see load errors.
  const args = [
    `--user-data-dir=${userData}`,
    `--load-extension=${path.resolve(distChrome)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-logging=stderr',
    '--v=1',
    'chrome://extensions'
  ];

  console.log('Launching Chrome:');
  console.log('  exe:', chromeExe);
  console.log('  args:', args.join(' '));

  const child = spawn(chromeExe, args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log('Chrome exited with code', code);
  });
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
