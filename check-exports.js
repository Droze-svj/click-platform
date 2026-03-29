// Fast static analysis: check what each route file exports by reading the file statically
// No module loading = no timeouts

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'server/routes');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllJsFiles(full));
    } else if (file.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const files = getAllJsFiles(routesDir);
const problems = [];
const empty = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const rel = path.relative(__dirname, f);

  // Empty files
  if (content.trim().length < 5) {
    empty.push(rel);
    continue;
  }

  // Files without any module.exports
  if (!content.includes('module.exports')) {
    problems.push({ file: rel, issue: 'NO_MODULE_EXPORTS' });
    continue;
  }

  // Check for bad exports: module.exports = { (plain object, not router)
  // Good patterns: module.exports = router, module.exports = function, module.exports = express.Router()
  // Bad: module.exports = { key: value }
  const exportLines = content.split('\n').filter(l => l.trim().startsWith('module.exports'));

  for (const line of exportLines) {
    const trimmed = line.trim();
    // These are BAD (exporting a plain object):
    // module.exports = {
    // module.exports = { router, something }  <- multi-export
    if (/^module\.exports\s*=\s*\{/.test(trimmed)) {
      // Make sure it's not a router being used
      const rest = trimmed.replace(/^module\.exports\s*=\s*\{/, '').trim();
      // If it contains 'router' it might be a destructuring re-export, which is fine
      // If not, it's likely a plain object
      if (!rest.startsWith('router') && !trimmed.includes('...router')) {
        problems.push({ file: rel, issue: `OBJECT_EXPORT: ${trimmed.substring(0, 80)}` });
      }
      break;
    }
  }
}

console.log('=== EMPTY FILES ===');
if (empty.length === 0) {
  console.log('None');
} else {
  empty.forEach(f => console.log('  📄 ' + f));
}

console.log('\n=== PROBLEMATIC EXPORTS ===');
if (problems.length === 0) {
  console.log('✅ No problems found!');
} else {
  problems.forEach(p => {
    console.log(`  ❌ ${p.file}`);
    console.log(`     → ${p.issue}`);
  });
}

console.log(`\nTotal files checked: ${files.length}`);
console.log(`Empty: ${empty.length}, Problems: ${problems.length}`);
