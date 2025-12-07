const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const archiver = require('archiver');
const terser = require('terser');

// Build configuration: allow disabling obfuscation via environment variable
// or command-line flag. Usage examples:
//  - PowerShell: $env:OBFUSCATE='false'; node build/build-prod.js
//  - Unix: OBFUSCATE=false node build/build-prod.js
//  - Or pass `--no-obfuscate` as a CLI arg to disable obfuscation.
const OBFUSCATE_ENV = process.env.OBFUSCATE;
function parseBoolString(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === '' || s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
  return undefined;
}
let OBFUSCATE = parseBoolString(OBFUSCATE_ENV);
if (OBFUSCATE === undefined) OBFUSCATE = false; // default to obfuscate
if (process.argv.includes('--no-obfuscate') || process.argv.includes('--no-obfuscation')) OBFUSCATE = false;
console.log('Build config: obfuscation enabled =', OBFUSCATE);

// Strip comments configuration: default true. Can be toggled via env or CLI.
const STRIP_COMMENTS_ENV = process.env.STRIP_COMMENTS;
let STRIP_COMMENTS = parseBoolString(STRIP_COMMENTS_ENV);
if (STRIP_COMMENTS === undefined) STRIP_COMMENTS = true;
if (process.argv.includes('--no-strip-comments')) STRIP_COMMENTS = false;
console.log('Build config: strip comments =', STRIP_COMMENTS);

// Project root (used for exclude matching)
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Paths under the project root to exclude from obfuscation (relative paths)
// These skip vendor/polyfill files, static assets and styles which should not
// be obfuscated.
// Examples:
//  - 'src/vendor' will skip any files under src/vendor
//  - 'src/vendor/browser-polyfill.min.js' will skip that specific file
const EXCLUDE_PATTERNS = [
  'src/vendor',
  'src/vendor/browser-polyfill.min.js',
  'src/assets',
  'src/styles',
  // Do NOT obfuscate extension background/service worker or other scripts
  // that run in the extension context (service worker background). Obfuscation
  // can introduce constructs (eval/Function) that violate extension CSP
  // and cause service worker registration to fail.
  'src/background.js',
  // 'src/content-script.js' was intentionally excluded previously to avoid
  // breaking the content script. If you want to obfuscate the content
  // script, remove it from this list. We've removed it programmatically
  // below when requested so it will be obfuscated with conservative
  // options.
];

function isExcluded(absolutePath) {
  // Compute path relative to project root and normalize separators.
  // Note: files are copied into `dist/.../src/...` before obfuscation, so
  // the relative path may contain `dist/chrome/src/...` or `dist/firefox/src/...`.
  // We consider a file excluded if any exclude pattern appears anywhere
  // in the relative path (so patterns like `src/vendor` match `dist/chrome/src/vendor/...`).
  const rel = path.relative(PROJECT_ROOT, absolutePath).replace(/\\/g, '/');
  for (const pat of EXCLUDE_PATTERNS) {
    if (rel === pat || rel.startsWith(pat + '/') || rel.includes(pat + '/')) return true;
    // also allow matching when the pattern appears later in the path (e.g. dist/chrome/src/vendor)
    if (rel.includes('/' + pat) || rel.includes(pat)) return true;
  }
  return false;
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    fs.readdirSync(p).forEach((f) => rmrf(path.join(p, f)));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    // ensure dest dir
    const d = path.dirname(dest);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function obfuscateAllJs(root) {
  const items = fs.readdirSync(root, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(root, it.name);
    if (isExcluded(p)) {
      // skip any file or folder that matches an exclude pattern
      // console.log('Skipping excluded path from obfuscation:', p);
      continue;
    }
    if (it.isDirectory()) {
      obfuscateAllJs(p);
      continue;
    }
    if (it.isFile() && p.endsWith('.js')) {
      try {
          const code = fs.readFileSync(p, 'utf8');

          // Default obfuscation options (aggressive)
          let obfOptions = {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: false,
            disableConsoleOutput: true,
            identifierNamesGenerator: 'hexadecimal',
            rotateStringArray: true,
            stringArray: true,
            stringArrayEncoding: ['base64'],
            stringArrayThreshold: 0.75
          };

          // If this is the content script, use more conservative options
          // to reduce the risk of breaking page integration or violating
          // CSP. These options avoid control-flow transformations and
          // dead-code injection which can increase the chance of subtle
          // runtime differences in content scripts that interact with
          // page JS/CSS/DOM.
          if (p.endsWith('content-script.js') || p.endsWith('content-script.min.js')) {
            obfOptions = {
              compact: true,
              controlFlowFlattening: false,
              deadCodeInjection: false,
              debugProtection: false,
              disableConsoleOutput: false,
              identifierNamesGenerator: 'hexadecimal',
              rotateStringArray: false,
              stringArray: false
            };
            console.log('Obfuscating content script with conservative options:', p);
          } else {
            console.log('Obfuscating', p);
          }

          const ob = JavaScriptObfuscator.obfuscate(code, obfOptions);
          fs.writeFileSync(p, ob.getObfuscatedCode(), 'utf8');
      } catch (e) {
        console.error('Failed to obfuscate', p, e && e.message);
      }
    }
  }
}

function stripCommentsAllJs(root) {
  const items = fs.readdirSync(root, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(root, it.name);
    if (it.isDirectory()) {
      stripCommentsAllJs(p);
      continue;
    }
    if (it.isFile() && p.endsWith('.js')) {
      try {
        const code = fs.readFileSync(p, 'utf8');
        // Use terser to remove comments only (no mangle/compress by default)
          let min;
          try {
            min = terser.minify(code, {
              compress: false,
              mangle: false,
              format: {
                comments: false
              }
            });
          } catch (err) {
            console.warn('Terser failed for', p, err && err.message);
            min = { error: err };
          }

          if (min && typeof min.code === 'string') {
            // Clean up blank lines that used to contain comments.
            let out = min.code.replace(/\r\n/g, '\n');
            out = out.replace(/[ \t]+$/gm, '');
            // Remove any lines that are only whitespace (leftover from comments)
            out = out.replace(/\r\n/g, '\n');
            out = out.replace(/[ \t]+$/gm, '');
            out = out.replace(/^\s*$/gm, '');
            // Ensure file ends with a single newline
            if (!out.endsWith('\n')) out += '\n';
            fs.writeFileSync(p, out, 'utf8');
            console.log('Stripped comments from', p);
          } else {
            // Fallback: strip block comments and full-line // comments only.
            // This avoids touching inline comments (e.g. URLs) which could break
            // code if removed naively.
            if (min && min.error) console.warn('Terser error details for', p, min.error && (min.error.message || min.error));
            let stripped = code.replace(/\/\*[\s\S]*?\*\//g, '')
              .replace(/^\s*\/\/.*$/gm, '');
            // Collapse excessive blank lines and trim file edges
            // Remove any lines that are only whitespace (leftover from comments)
            stripped = stripped.replace(/\r\n/g, '\n');
            stripped = stripped.replace(/[ \t]+$/gm, '');
            stripped = stripped.replace(/^\s*$/gm, '');
            // Ensure file ends with a single newline
            if (!stripped.endsWith('\n')) stripped += '\n';
            fs.writeFileSync(p, stripped, 'utf8');
            console.log('Stripped comments (fallback) from', p);
          }
      } catch (e) {
        console.error('Failed to strip comments', p, e && e.message);
      }
    }
  }
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      console.log(`Created zip: ${outPath} (${archive.pointer()} total bytes)`);
      resolve();
    });
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function buildChrome(distRoot) {
  const chromeDist = path.join(distRoot, 'chrome');
  if (!fs.existsSync(chromeDist)) fs.mkdirSync(chromeDist, { recursive: true });

  // copy chrome manifest (root manifest.json)
  const manifestSrc = path.resolve(__dirname, '..', 'manifest.json');
  if (!fs.existsSync(manifestSrc)) throw new Error('manifest.json not found');
  copyRecursive(manifestSrc, path.join(chromeDist, 'manifest.json'));

  // copy src
  copyRecursive(path.resolve(__dirname, '..', 'src'), path.join(chromeDist, 'src'));

  // Optionally strip comments from all JS files in the dist output.
  if (STRIP_COMMENTS) {
    try {
      stripCommentsAllJs(chromeDist);
    } catch (e) {
      console.warn('Failed stripping comments in chrome dist:', e && e.message);
    }
  }

  // Remove Firefox-only files from Chrome package so they are not present
  // (and therefore not obfuscated) in the Chrome build. These files are
  // used only for the Firefox/MV2 test package and should not be shipped
  // with the Chrome MV3 package.
  const firefoxBgInChrome = path.join(chromeDist, 'src', 'background-firefox.js');
  if (fs.existsSync(firefoxBgInChrome)) {
    try {
      fs.unlinkSync(firefoxBgInChrome);
      console.log('Removed Firefox-only file from Chrome dist:', firefoxBgInChrome);
    } catch (e) {
      console.warn('Failed to remove firefox-only file from chrome dist:', e && e.message);
    }
  }

  // If you decide to obfuscate content scripts, be aware these scripts
  // run in the page context and are sensitive to transformations. The
  // build now obfuscates `src/content-script.js` but uses conservative
  // options above to reduce risk. Keep an eye on runtime errors when
  // testing after enabling obfuscation.

  // obfuscate JS files in chromeDist
  if (OBFUSCATE) {
    obfuscateAllJs(chromeDist);
  } else {
    console.log('Skipping obfuscation for Chrome package (OBFUSCATE=false)');
  }
}

function buildFirefox(distRoot) {
  const ffDist = path.join(distRoot, 'firefox');
  if (!fs.existsSync(ffDist)) fs.mkdirSync(ffDist, { recursive: true });

  const ffManifestSrc = path.resolve(__dirname, '..', 'manifest-firefox.json');
  if (!fs.existsSync(ffManifestSrc)) throw new Error('manifest-firefox.json not found');
  copyRecursive(ffManifestSrc, path.join(ffDist, 'manifest.json'));

  copyRecursive(path.resolve(__dirname, '..', 'src'), path.join(ffDist, 'src'));

  // Optionally strip comments from all JS files in the firefox dist output.
  if (STRIP_COMMENTS) {
    try {
      stripCommentsAllJs(ffDist);
    } catch (e) {
      console.warn('Failed stripping comments in firefox dist:', e && e.message);
    }
  }

  if (OBFUSCATE) {
    obfuscateAllJs(ffDist);
  } else {
    console.log('Skipping obfuscation for Firefox package (OBFUSCATE=false)');
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const dist = path.join(projectRoot, 'dist');
  // clean dist
  if (fs.existsSync(dist)) {
    console.log('Removing existing dist...');
    rmrf(dist);
  }
  fs.mkdirSync(dist, { recursive: true });

  console.log('Building Chrome package...');
  buildChrome(dist);

  // create chrome zip
  try {
    const chromeZip = path.join(dist, 'trackrak-chrome.zip');
    console.log('Zipping Chrome package...');
    await zipDirectory(path.join(dist, 'chrome'), chromeZip);
  } catch (e) {
    console.error('Failed creating chrome zip', e && e.message);
  }

  console.log('Building Firefox package...');
  buildFirefox(dist);

  // create firefox zip
  try {
    const firefoxZip = path.join(dist, 'trackrak-firefox.zip');
    console.log('Zipping Firefox package...');
    await zipDirectory(path.join(dist, 'firefox'), firefoxZip);
  } catch (e) {
    console.error('Failed creating firefox zip', e && e.message);
  }

  console.log('Production build complete. Packages in dist/chrome and dist/firefox');
}

main().catch((e) => {
  console.error('Build failed', e && e.stack ? e.stack : e);
  process.exit(1);
});
