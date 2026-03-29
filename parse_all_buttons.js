const fs = require('fs');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

glob('client/components/**/*.tsx', (err, files) => {
  files.forEach(file => {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      
      traverse(ast, {
        JSXElement(path) {
          const name = path.node.openingElement.name.name;
          if (name === 'button' || (path.node.openingElement.name.object?.name === 'motion' && path.node.openingElement.name.property?.name === 'button')) {
            let parent = path.parentPath;
            while (parent) {
              if (parent.node.type === 'JSXElement') {
                const pName = parent.node.openingElement.name.name;
                if (pName === 'button' || (parent.node.openingElement.name.object?.name === 'motion' && parent.node.openingElement.name.property?.name === 'button')) {
                  console.log(`Nested button in ${file} at line ${path.node.loc.start.line}. Parent button is at line ${parent.node.loc.start.line}`);
                }
              }
              parent = parent.parentPath;
            }
          }
        }
      });
    } catch(e) {}
  });
});
