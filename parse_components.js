const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('/Volumes/CLICK/WHOP AI V3/client/components/editor/views/BasicEditorView.tsx', 'utf-8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  JSXIdentifier(path) {
    if (path.node.name === 'BrandKit' && path.parent.type === 'JSXOpeningElement') {
      let parent = path.parentPath;
      while (parent) {
        if (parent.node.type === 'JSXElement') {
           const pName = parent.node.openingElement.name.name || (parent.node.openingElement.name.object?.name + '.' + parent.node.openingElement.name.property?.name);
           console.log("BrandKit inside:", pName);
        }
        parent = parent.parentPath;
      }
    }
  }
});
