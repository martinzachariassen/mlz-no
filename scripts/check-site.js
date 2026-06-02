const { existsSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const publicRoot = join(root, 'public');
const requiredFiles = [
  'index.html',
  '404.html',
  'image-slot.js',
  'project-one-mock.svg',
  'favicon.svg',
  'apple-touch-icon.png',
  'og.png',
  'robots.txt',
  'sitemap.xml'
];

const requiredAssetSources = [
  'assets/og.svg',
  'assets/apple-touch-icon.svg'
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  const path = join(publicRoot, file);
  if (!existsSync(path)) {
    fail(`Missing public file: ${file}`);
  } else if (!statSync(path).isFile()) {
    fail(`Expected a file: public/${file}`);
  }
}

for (const file of requiredAssetSources) {
  const path = join(root, file);
  if (!existsSync(path)) {
    fail(`Missing source asset: ${file}`);
  }
}

const htmlFiles = ['index.html', '404.html'];
const referencedLocalAssets = htmlFiles.flatMap(file => {
  const html = readFileSync(join(publicRoot, file), 'utf8');
  const hrefsAndSources = Array.from(html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g))
    .map(([, asset]) => asset);
  const canonicalContentAssets = Array.from(html.matchAll(/content="(https:\/\/mlz\.no\/[^"#?]+)(?:[#?][^"]*)?"/g))
    .map(([, asset]) => asset);

  return [...hrefsAndSources, ...canonicalContentAssets]
    .filter(asset => !asset.includes(':') || asset.startsWith('https://mlz.no/'))
    .map(asset => asset.replace(/^https:\/\/mlz\.no\//, '').replace(/^\//, ''))
    .filter(asset => asset.length > 0);
});

for (const asset of referencedLocalAssets) {
  const path = join(publicRoot, asset);
  if (!existsSync(path)) {
    fail(`Missing referenced asset: /${asset}`);
  }
}

const js = readFileSync(join(publicRoot, 'image-slot.js'), 'utf8');
if (js.includes('<script>') || js.includes('</script>')) {
  fail('Unexpected HTML script tag in public/image-slot.js');
}

if (!process.exitCode) {
  console.log('Site checks passed');
}
