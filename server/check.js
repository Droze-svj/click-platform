const fs = require('fs');
const path = require('path');

function checkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      checkDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      try {
        const exported = require('./' + file); // Since we run inside server/routes
        if (typeof exported !== 'function' && typeof exported.use !== 'function') {
          if (!exported || !exported.router) {
            
          }
        }
      } catch (e) { /* ignore require errors */ }
    }
  }
}
process.chdir(path.join(__dirname, 'routes'));
checkDir('.');

