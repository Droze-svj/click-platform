const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('/Volumes/CLICK/WHOP AI V3/client/components/editor/views/BasicEditorView.tsx', 'utf-8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  JSXElement(path) {
    const parentNameTree = [];
    let p = path.parentPath;
    while(p) {
      if (p.node.type === 'JSXElement') {
         parentNameTree.push(p.node.openingElement.name.name || p.node.openingElement.name.property?.name);
      }
      p = p.parentPath;
    }
    const myName = path.node.openingElement.name.name || path.node.openingElement.name.property?.name;
    
    // Check if I am a component (starts with Capital) inside a button
    if (myName && /^[A-Z]/.test(myName) && parentNameTree.includes('button')) {
      console.log(`Component <${myName}> is nested inside a <button> on line ${path.node.loc.start.line}`);
    }
  }
});
