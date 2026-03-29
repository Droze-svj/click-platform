const fs = require('fs');

const userHtml = fs.readFileSync('user_html.txt', 'utf8');

// The user provided the raw HTML. We need to extract the structure to see what they changed.
// It's a huge block. Let's just write the raw HTML to an artifact for now, maybe we can run Prettier on it and compare.
