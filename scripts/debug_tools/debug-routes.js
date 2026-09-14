const fs = require('fs');
const path = require('path');
const express = require('express');

// Mock express app
const app = {
  use: (pth, middleware) => {
    if (pth && middleware) {
      console.log(`Checking route "${pth}"...`);
      if (typeof middleware === 'object' && middleware !== null && !middleware.handle && !(middleware instanceof express.Router)) {
        console.log(`❌ ERROR: Route registered at "${pth}" is an Object, not a function/router.`);
        console.log('Object constructor:', middleware.constructor.name);
        console.log('Object keys:', Object.keys(middleware));
        try {
          console.log('Object stringified (limited):', JSON.stringify(middleware).substring(0, 100));
        } catch (e) {
          console.log('Could not stringify object');
        }
      } else if (typeof middleware === 'function' || (middleware && middleware.handle) || (middleware instanceof express.Router)) {
        console.log(`✅ Route "${pth}" is valid.`);
      } else {
        console.log(`❓ UNKNOWN: Route registered at "${pth}" has type: ${typeof middleware}`);
      }
    }
  }
};

const serverIndexContent = fs.readFileSync(path.join(__dirname, 'server/index.js'), 'utf8');

const routeRegex = /app\.use\(['"](.*?)['"],\s*(?:require\(['"]\.\/(.*?)['"]\)(?:\.([a-zA-Z0-9_]+))?)\)/g;

let match;
console.log('🔍 Scanning for route registrations...');

while ((match = routeRegex.exec(serverIndexContent)) !== null) {
  const routePath = match[1];
  const relPath = match[2];
  const property = match[3];

  const absPath = path.join(__dirname, 'server', relPath + '.js');
  const dirPath = path.join(__dirname, 'server', relPath, 'index.js');

  let targetPath = fs.existsSync(absPath) ? absPath : (fs.existsSync(dirPath) ? dirPath : null);

  if (!targetPath) {
    const altPath = path.join(__dirname, 'server', relPath);
    if (fs.existsSync(altPath)) targetPath = altPath;
  }

  if (targetPath) {
    if (targetPath.includes('auth.js')) {
      console.log(`Loading ${targetPath}...`);
      try {
        delete require.cache[require.resolve(targetPath)];
        let moduleExport = require(targetPath);
        let middleware = property ? moduleExport[property] : moduleExport;
        app.use(routePath, middleware);
      } catch (err) {
        console.log(`⚠️  Error loading ${targetPath}: ${err.message}`);
        console.log(err.stack);
      }
    }
  }
}

console.log('✅ Scan complete.');
