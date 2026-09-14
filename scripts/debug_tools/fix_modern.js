const fs = require('fs');
const content = fs.readFileSync('/Volumes/CLICK/WHOP AI V3/client/components/ModernVideoEditor.tsx', 'utf-8');

let newContent = content;

newContent = newContent.replace(/p-4 lg:p-6 custom-scrollbar/g, 'p-4 custom-scrollbar');

fs.writeFileSync('/Volumes/CLICK/WHOP AI V3/client/components/ModernVideoEditor.tsx', newContent);
console.log("Updated ModernVideoEditor.tsx");
