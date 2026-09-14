const fs = require('fs');
const content = fs.readFileSync('/Volumes/CLICK/WHOP AI V3/client/components/editor/views/BasicEditorView.tsx', 'utf-8');

let newContent = content;

// Replace grids
newContent = newContent.replace(/lg:grid-cols-3/g, 'grid-cols-1 sm:grid-cols-2');
newContent = newContent.replace(/md:grid-cols-2/g, 'grid-cols-1 sm:grid-cols-2');
newContent = newContent.replace(/lg:grid-cols-2/g, 'grid-cols-1');
newContent = newContent.replace(/xl:grid-cols-2/g, 'grid-cols-1');
newContent = newContent.replace(/sm:grid-cols-3/g, 'grid-cols-2');
newContent = newContent.replace(/sm:grid-cols-2/g, 'grid-cols-2');

// Fix column spans
newContent = newContent.replace(/lg:col-span-2/g, 'col-span-1 sm:col-span-2');

// Flex behaviors
newContent = newContent.replace(/xl:flex-row/g, '');
newContent = newContent.replace(/xl:items-center/g, '');

// Sizing
newContent = newContent.replace(/xl:min-w-\[[^\]]+\]/g, 'w-full');
newContent = newContent.replace(/md:text-\[4rem\]/g, 'text-[3.5rem]');
newContent = newContent.replace(/min-h-\[1200px\]/g, 'min-h-[800px]');

// Margins and paddings
newContent = newContent.replace(/lg:p-6/g, 'p-6');
newContent = newContent.replace(/md:gap-6/g, 'gap-4');
newContent = newContent.replace(/lg:gap-8/g, 'gap-6');

// Just some cleanup for duplicate or conflicting classes that might have been created
newContent = newContent.replace(/grid-cols-1 grid-cols-1/g, 'grid-cols-1');
newContent = newContent.replace(/flex-col  items-start/g, 'flex-col items-start');

fs.writeFileSync('/Volumes/CLICK/WHOP AI V3/client/components/editor/views/BasicEditorView.tsx', newContent);
console.log("Replaced viewport constraints to make it sidebar-friendly.");
