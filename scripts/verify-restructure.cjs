const fs = require('fs');
const path = require('path');

console.log('=== CREDAVER RESTRUCTURE AUDIT ===\n');

// 1. Audit href="#" across apps/web/src
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const srcFiles = walk(path.join(__dirname, '..', 'apps', 'web', 'src'));
let hashMatches = [];
srcFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /href\s*=\s*["']#["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    hashMatches.push({ file: path.relative(path.join(__dirname, '..'), file), match: match[0] });
  }
});

console.log(`[1] Audit href="#" links in apps/web/src:`);
console.log(`    Found ${hashMatches.length} occurrences.`);
if (hashMatches.length === 0) {
  console.log('    PASS: Zero href="#" links found.\n');
} else {
  console.error('    FAIL: Found href="#" in:', hashMatches);
  process.exit(1);
}

// 2. Check forbidden strings in built HTML of '/'
// Next.js generates static/prerendered HTML in .next/server/app/index.html or .next/server/app/page.html
const possibleHtmlPaths = [
  path.join(__dirname, '..', 'apps', 'web', '.next', 'server', 'app', 'index.html'),
  path.join(__dirname, '..', 'apps', 'web', '.next', 'server', 'app', 'page.html'),
];

let homeHtmlPath = possibleHtmlPaths.find(p => fs.existsSync(p));

if (!homeHtmlPath) {
  console.log('[2] Built HTML for "/" not yet found (run build first).');
} else {
  console.log(`[2] Built HTML for "/" found at ${path.relative(path.join(__dirname, '..'), homeHtmlPath)}:`);
  const htmlContent = fs.readFileSync(homeHtmlPath, 'utf8');

  const forbiddenStrings = [
    'Execute Live Devnet Payment',
    'Signed Decision Receipts',
    'Five separate concepts',
    'Submit Early Access Request',
    'Issue Agent Mandate'
  ];

  let anyFailed = false;
  forbiddenStrings.forEach(str => {
    const found = htmlContent.includes(str);
    if (found) {
      console.log(`    FAIL: "${str}" was FOUND on built home page.`);
      anyFailed = true;
    } else {
      console.log(`    PASS: "${str}" is NOT on built home page.`);
    }
  });

  if (anyFailed) {
    console.error('\nFAIL: Built home page contains forbidden sections.\n');
    process.exit(1);
  } else {
    console.log('\nPASS: All 5 forbidden section assertions passed!\n');
  }
}
