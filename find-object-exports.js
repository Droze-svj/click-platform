const fs = require('fs');
const path = require('path');

function checkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            checkDir(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('module.exports = {') || content.includes('module.exports={')) {
                    console.log(`FOUND: ${fullPath}`);
                }
            } catch (err) {
                // Ignore errors
            }
        }
    }
}

const routesDir = path.join(process.cwd(), 'server', 'routes');
if (fs.existsSync(routesDir)) {
    console.log(`Checking ${routesDir}...`);
    checkDir(routesDir);
} else {
    console.log(`Directory not found: ${routesDir}`);
}
