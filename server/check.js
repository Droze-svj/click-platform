const fs = require('fs');
const path = require('path');

// Resolve the absolute and safe routes folder
const ROUTES_DIR = path.resolve(__dirname, 'routes');

function checkDir(dir) {
  const resolvedDir = path.resolve(dir);
  // Ensure the directory is within our routes root directory
  if (!resolvedDir.startsWith(ROUTES_DIR) && resolvedDir !== ROUTES_DIR) {
    return;
  }
  
  if (!fs.existsSync(resolvedDir)) return;
  const files = fs.readdirSync(resolvedDir);
  for (const file of files) {
    const fullPath = path.resolve(resolvedDir, file);
    if (!fullPath.startsWith(ROUTES_DIR)) {
      continue;
    }
    
    if (fs.statSync(fullPath).isDirectory()) {
      checkDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      try {
        const relativeToRoutes = path.relative(ROUTES_DIR, fullPath);
        // Safely dynamic require using routes root
        const exported = require(path.resolve(ROUTES_DIR, relativeToRoutes));
        if (typeof exported !== 'function' && typeof exported.use !== 'function') {
          if (!exported || !exported.router) {
            // Unused block
          }
        }
      } catch (e) { /* ignore require errors */ }
    }
  }
}

checkDir(ROUTES_DIR);


