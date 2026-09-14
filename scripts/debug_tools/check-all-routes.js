const fs = require('fs');
const path = require('path');
const express = require('express');

// Mock dotenv
require('dotenv').config({ path: path.join(__dirname, 'server/.env') });

const indexContent = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');

// Regex for app.use(pth, require(route))
const useRegex = /app\.use\(['"](.*?)['"],\s*(require\(['"]\.\/(.*?)['"]\)(?:\.([a-zA-Z0-9_]+))?)\)/g;

let match;
console.log('Testing route exports...');

while ((match = useRegex.exec(indexContent)) !== null) {
  const pth = match[1];
  const reqStr = match[2];
  const relPath = match[3];
  const property = match[4];

  const absPath = path.resolve(__dirname, 'server', relPath + '.js');
  const dirPath = path.resolve(__dirname, 'server', relPath, 'index.js');

  let target = fs.existsSync(absPath) ? absPath : (fs.existsSync(dirPath) ? dirPath : null);

  if (target) {
    console.log(`⏳ Loading ${relPath} (mounted at ${pth})...`);
    try {
      const mod = require(target);
      const middleware = property ? mod[property] : mod;

      if (typeof middleware !== 'function' && !(middleware instanceof express.Router) && !(middleware && middleware.handle)) {
        console.log(`❌ FAIL: ${reqStr} (mounted at ${pth}) returned ${typeof middleware}`);
        console.log(`   Keys:`, Object.keys(middleware || {}));
      } else {
        // console.log(`✅ OK: ${reqStr}`);
      }
    } catch (err) {
      console.log(`⚠️ ERROR loading ${reqStr}: ${err.message}`);
    }
  } else {
    // console.log(`❓ SKIP: Could not find file for ${relPath}`);
  }
}

console.log('Done.');
