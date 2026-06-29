// KOL 采集助手 - 构建脚本
// 从同一源码打包 Chrome 和 Edge 两个版本的 zip
// 用法: node build.js

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const INCLUDE = [
  'manifest.json',
  'background',
  'content',
  'lib',
  'popup',
  'icons',
  'README.md',
  'LICENSE'
];

function patchManifest(original, browser) {
  const manifest = JSON.parse(JSON.stringify(original));
  if (browser === 'edge') {
    manifest.name = manifest.name + ' (Edge)';
  }
  return manifest;
}

function copyToStaging(stagingDir) {
  INCLUDE.forEach(item => {
    const src = path.join(ROOT, item);
    const dest = path.join(stagingDir, item);
    if (!fs.existsSync(src)) {
      console.warn('  [skip] ' + item + ' not found');
      return;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  });
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log('  ok ' + path.basename(outputPath) + ' (' + sizeMB + ' MB)');
      resolve();
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function build() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const version = manifest.version;
  console.log('Building KOL Collector v' + version);

  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const browsers = ['chrome', 'edge'];

  for (const browser of browsers) {
    const stagingDir = path.join(DIST, browser + '-staging');
    const zipName = 'kol-collector-' + browser + '-v' + version + '.zip';
    const zipPath = path.join(DIST, zipName);

    console.log('Packing ' + browser + '...');

    fs.mkdirSync(stagingDir, { recursive: true });
    copyToStaging(stagingDir);

    const patched = patchManifest(manifest, browser);
    fs.writeFileSync(
      path.join(stagingDir, 'manifest.json'),
      JSON.stringify(patched, null, 2)
    );

    await createZip(stagingDir, zipPath);
    fs.rmSync(stagingDir, { recursive: true });
  }

  console.log('Done! Output: dist/');
  console.log('  Chrome: dist/kol-collector-chrome-v' + version + '.zip');
  console.log('  Edge:   dist/kol-collector-edge-v' + version + '.zip');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
