const fs = require('fs');
const path = require('path');
const express = require('express');

function checkFile(filePath, mountedPath = '') {
  console.log(`⏳ Testing ${filePath} (mounted at ${mountedPath})...`);
  try {
    const mod = require(filePath);
    if (typeof mod !== 'function' && !(mod instanceof express.Router) && !(mod && mod.handle)) {
      console.log(`❌ FAIL: ${filePath} returned ${typeof mod}`);
      console.log(`   Keys:`, Object.keys(mod || {}));
      return false;
    }

    // If it's a router, try to find nested requires (very basic regex)
    if (mod.stack) {
        // This is harder to do dynamically with express routers without potentially triggering stuff
    }

    return true;
  } catch (err) {
    console.log(`⚠️ ERROR loading ${filePath}: ${err.message}`);
    return false;
  }
}

const rootDir = path.join(__dirname, 'server');

// Files to check requirements in
const entryPoints = [
  path.join(rootDir, 'index.js'),
  path.join(rootDir, 'routes/v1/index.js'),
  path.join(rootDir, 'routes/v2/index.js'),
];

const processed = new Set();

entryPoints.forEach(entryFile => {
  if (!fs.existsSync(entryFile)) return;

  const content = fs.readFileSync(entryFile, 'utf8');
  const useRegex = /require\(['"]\.\/(.*?)['"]\)/g;
  let match;

  while ((match = useRegex.exec(content)) !== null) {
    const relPath = match[1];
    const absPath = path.resolve(path.dirname(entryFile), relPath);

    // Check various extensions
    let target = null;
    if (fs.existsSync(absPath + '.js')) target = absPath + '.js';
    else if (fs.existsSync(absPath + '/index.js')) target = absPath + '/index.js';
    else if (fs.existsSync(absPath)) target = absPath;

    if (target && !processed.has(target)) {
      processed.add(target);
      if (target.includes('/routes/')) {
        checkFile(target, relPath);
      }
    }
  }
});

console.log('Done.');
