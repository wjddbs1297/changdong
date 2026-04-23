const fs = require('fs');
const path = require('path');

const geonheeFile = 'C:\\\\Users\\\\joung\\\\.gemini\\\\antigravity\\\\brain\\\\61cbb6f8-646f-4333-a1e2-749a5da44d77\\\\media__1775884558202.png';
const jeongyunFile = 'C:\\\\Users\\\\joung\\\\.gemini\\\\antigravity\\\\brain\\\\61cbb6f8-646f-4333-a1e2-749a5da44d77\\\\media__1775884558205.png';

const geonheeB64 = 'data:image/png;base64,' + fs.readFileSync(geonheeFile).toString('base64');
const jeongyunB64 = 'data:image/png;base64,' + fs.readFileSync(jeongyunFile).toString('base64');

const modalPath = path.join(__dirname, 'src', 'components', 'ActivityModal.tsx');
let content = fs.readFileSync(modalPath, 'utf8');

content = content.replace(/const STAMP_JEONGYUN = \".*?\";/g, `const STAMP_JEONGYUN = "${jeongyunB64}";`);
content = content.replace(/const STAMP_GEONHEE = \".*?\";/g, `const STAMP_GEONHEE = "${geonheeB64}";`);
content = content.replace(/const STAMP_GEONHEE  = \".*?\";/g, `const STAMP_GEONHEE  = "${geonheeB64}";`);

fs.writeFileSync(modalPath, content, 'utf8');
console.log('Stamps replaced successfully.');
