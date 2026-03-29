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
        const exported = require('./' + fullPath);
        // Express middleware should be a function
        if (typeof exported !== 'function' && typeof exported.use !== 'function') {
          // Check if it has a router property
          if (!exported.router && typeof exported !== 'function') {
            console.log('❌ INVALID MODULE EXPORT:', fullPath);
          }
        }
      } catch (e) {
        // Ignore parsing errors for now, looking specifically for bad exports
      }
    }
  }
}
checkDir('server/routes');
console.log('Done checking routes.');
