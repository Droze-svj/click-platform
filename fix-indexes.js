const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'server/models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Pattern for userId: { ... index: true ... }
  if (content.match(/userId\s*:\s*\{[^}]*?index\s*:\s*true[^}]*}/) && content.match(/schema\.index\(\s*{\s*[\"']?userId[\"']?\s*:/)) {
    content = content.replace(/(userId\s*:\s*\{.*?)\bindex\s*:\s*true\s*,?\s*/gs, '$1');
    changed = true;
    console.log('Fixed userId index in', file);
  }

  if (content.match(/expiresAt\s*:\s*\{[^}]*?index\s*:\s*true[^}]*}/) && content.match(/schema\.index\(\s*{\s*[\"']?expiresAt[\"']?\s*:/)) {
    content = content.replace(/(expiresAt\s*:\s*\{.*?)\bindex\s*:\s*true\s*,?\s*/gs, '$1');
    changed = true;
    console.log('Fixed expiresAt index in', file);
  }

  // Cleanup trailing commas before brace
  content = content.replace(/,\s*}/g, '\n  }');

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
